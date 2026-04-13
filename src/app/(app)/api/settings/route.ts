import sql from "@/lib/database/client";
import { SUPPORTED_AMBASSADOR_REGIONS } from "@/lib/settings";
import { isSameOriginRequest } from "@/lib/http";
import { getSession } from "@/lib/session";
import { ensureUserAddressSchema } from "@/lib/database/user-address-schema";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureUserAddressSchema();

  const body: unknown = await request.json().catch(() => null);

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const updates: string[] = [];
  const ambassadorRegionValue = body.ambassadorRegion;

  if (typeof ambassadorRegionValue === "string") {
    const ambassadorRegion = ambassadorRegionValue.trim();

    if (!SUPPORTED_AMBASSADOR_REGIONS.some((region) => region === ambassadorRegion)) {
      return Response.json({ error: "invalid_region" }, { status: 400 });
    }

    updates.push("region");
    await sql`
      UPDATE users SET ambassador_region = ${ambassadorRegion}, updated_at = NOW()
      WHERE id = ${session.sub}
    `;
  }

  return Response.json({ ok: true, updated: updates });
}
