import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import {
  isAcceptedApplicationStatus,
} from "@/lib/applications/status";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSession } from "@/lib/session";
import {
  buildWarehouseTrackingUrl,
  ORDER_STATUS_APPROVED,
  ORDER_STATUS_PENDING,
  ORDER_STATUS_REJECTED,
} from "@/lib/shop";
import { normalizeHackClubAddresses } from "@/lib/settings";

import ShopClient, { type ShopOrderState } from "./ShopClient";

type UserRow = {
  balance_cents: number | null;
  is_admin: boolean | null;
  hca_addresses: unknown;
  selected_address_index: number | null;
};

type ApplicationRow = {
  status: string | null;
};

type OrderRow = {
  id: string;
  status: string;
  variant: string | null;
  warehouse_order_id: string | null;
  rejection_note: string | null;
};

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("shop.metadata.title");
}

export default async function ShopPage() {
  const session = await getSession();
  if (!session) redirect("/");

  await ensureSchema();
  const t = await getTranslations();

  const [[user], [latestApp], [existingOrderRow]] = await Promise.all([
    sql<UserRow[]>`
      SELECT balance_cents, is_admin, hca_addresses, selected_address_index
      FROM users
      WHERE id = ${session.sub}
      LIMIT 1
    `,
    sql<ApplicationRow[]>`
      SELECT status
      FROM applications
      WHERE user_id = ${session.sub}
      ORDER BY created_at DESC
      LIMIT 1
    `,
    sql<OrderRow[]>`
      SELECT id, status, variant, warehouse_order_id, rejection_note
      FROM orders
      WHERE user_id = ${session.sub} AND sku LIKE 'Swa/Shirt/HC/%'
      ORDER BY created_at DESC
      LIMIT 1
    `,
  ]);

  const addresses = normalizeHackClubAddresses(user?.hca_addresses);
  const selectedAddressIndex =
    addresses.length > 0 &&
    Number.isInteger(user?.selected_address_index) &&
    (user?.selected_address_index ?? 0) >= 0
      ? Math.min(user?.selected_address_index ?? 0, addresses.length - 1)
      : 0;
  const existingOrder: ShopOrderState | null = existingOrderRow
    ? {
        id: existingOrderRow.id,
        status: existingOrderRow.status,
        size: existingOrderRow.variant,
        warehouseUrl: existingOrderRow.warehouse_order_id
          ? buildWarehouseTrackingUrl(existingOrderRow.warehouse_order_id)
          : null,
        rejectionNote: existingOrderRow.rejection_note,
      }
    : null;
  const isAmbassador = isAcceptedApplicationStatus(latestApp?.status);

  return (
    <main className="page-shell">
      <Navbar isAdmin={Boolean(user?.is_admin)} balanceCents={user?.balance_cents ?? 0} />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header>
          <h1 className="text-4xl text-white">{t("shop.heading")}</h1>
          <p className="mt-2 text-base text-muted-foreground">{t("shop.subheading")}</p>
        </header>

        {isAmbassador ? (
          <ShopClient
            addresses={addresses}
            selectedAddressIndex={selectedAddressIndex}
            existingOrder={existingOrder}
            statusKeys={{
              pending: ORDER_STATUS_PENDING,
              approved: ORDER_STATUS_APPROVED,
              rejected: ORDER_STATUS_REJECTED,
            }}
          />
        ) : (
          <p className="mt-8 font-body text-base text-white">{t("shop.not-ambassador")}</p>
        )}
      </div>
    </main>
  );
}
