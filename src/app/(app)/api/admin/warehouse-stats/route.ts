import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";
import { buildEmptyShirtStockBySize, type ShirtStockBySize } from "@/lib/shop";
import { loadShirtStockBySize, WarehouseApiClient } from "@/lib/warehouse";

type LinkedOrderRow = {
  warehouse_order_id: string;
};

type CachedStats = {
  expenditure: {
    contents: number;
    labor: number;
    postage: number;
    total: number;
  };
  completedOrders: number;
  stockBySize: ShirtStockBySize;
};

let cached: { data: CachedStats; expiresAt: number } | null = null;

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getActorSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (cached !== null && Date.now() < cached.expiresAt) {
    return Response.json(cached.data);
  }

  const [warehouseOrders, linkedOrderRows, stockBySize] = await Promise.all([
    new WarehouseApiClient().listOrders(),
    sql<LinkedOrderRow[]>`
      SELECT warehouse_order_id
      FROM orders
      WHERE warehouse_order_id IS NOT NULL
    `,
    loadShirtStockBySize().catch(() => buildEmptyShirtStockBySize()),
  ]);

  const ambassadorOrderIds = new Set(
    linkedOrderRows.map((r) => r.warehouse_order_id),
  );

  let contentsCost = 0;
  let laborCost = 0;
  let postageCost = 0;
  let completedCount = 0;

  for (const order of warehouseOrders) {
    if (order.status === "mailed" && ambassadorOrderIds.has(order.id)) {
      contentsCost += Number(order.contents_cost ?? 0);
      laborCost += Number(order.labor_cost ?? 0);
      postageCost += Number(order.postage_cost ?? 0);
      completedCount++;
    }
  }

  const data: CachedStats = {
    expenditure: {
      contents: contentsCost,
      labor: laborCost,
      postage: postageCost,
      total: contentsCost + laborCost + postageCost,
    },
    completedOrders: completedCount,
    stockBySize,
  };

  cached = { data, expiresAt: Date.now() + 5 * 60 * 1000 };

  return Response.json(data);
}
