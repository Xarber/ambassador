import sql from "@/lib/database/client";
import { getAmbassadorOnboardingStatus } from "@/lib/ambassadors/airtable";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { loadUserHackClubAddresses } from "@/lib/hca-addresses";
import { readHcaAccessToken } from "@/lib/hca-access-token";
import { isSameOriginRequest } from "@/lib/http";
import { getSession } from "@/lib/session";
import { canAccessShirts } from "@/lib/shirt/access";
import {
  canPlaceAnotherShirtOrder,
  isShirtSize,
  ORDER_STATUS_PENDING,
  SHIRT_SKU_PREFIX,
  shirtSku,
} from "@/lib/shop";

type ShirtOrderUserRow = {
  id: string;
  hca_addresses: unknown;
  hca_access_token: string | null;
  manual_dashboard_state: string | null;
};

type ShirtOrderApplicationRow = {
  status: string;
  airtable_record_id: string | null;
  airtable_payload: unknown | null;
};

type ShirtOrderRow = {
  id: string;
  status: string;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureSchema();

  const body: unknown = await request.json().catch(() => null);

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "invalid_size" }, { status: 400 });
  }

  const sizeValue = body.size;
  if (!isShirtSize(sizeValue)) {
    return Response.json({ error: "invalid_size" }, { status: 400 });
  }
  const size = sizeValue;
  const addressIndexValue = body.addressIndex;

  const user = (await sql<ShirtOrderUserRow[]>`
    SELECT id, hca_addresses, hca_access_token, manual_dashboard_state
    FROM users
    WHERE id = ${session.sub}
  `).at(0);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const latestApp = (await sql<ShirtOrderApplicationRow[]>`
    SELECT status, airtable_record_id, airtable_payload
    FROM applications
    WHERE user_id = ${session.sub}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).at(0) ?? null;
  if (!canAccessShirts({
    latestApplicationStatus: latestApp?.status ?? null,
    manualDashboardState: user.manual_dashboard_state,
  })) {
    return Response.json({ error: "not_ambassador" }, { status: 403 });
  }

  const onboardingStatus = await getAmbassadorOnboardingStatus({
    applicationAirtableRecordId: latestApp?.airtable_record_id ?? null,
    applicationAirtablePayload: latestApp?.airtable_payload ?? null,
  });

  if (!onboardingStatus.hasAmbassadorRecord || !onboardingStatus.onboardingComplete) {
    return Response.json({ error: "onboarding_incomplete" }, { status: 403 });
  }

  const { addresses, needsAddressRefresh } = await loadUserHackClubAddresses({
    userId: session.sub,
    storedAddresses: user.hca_addresses,
    accessToken: readHcaAccessToken(user.hca_access_token),
  });

  if (needsAddressRefresh) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (addresses.length === 0) {
    return Response.json({ error: "no_address" }, { status: 400 });
  }

  const requestedIndex =
    typeof addressIndexValue === "number" &&
    Number.isInteger(addressIndexValue) &&
    addressIndexValue >= 0
      ? addressIndexValue
      : 0;
  const addressIndex = Math.min(Math.max(requestedIndex, 0), addresses.length - 1);
  const address = addresses[addressIndex];

  const latestOrder = (await sql<ShirtOrderRow[]>`
    SELECT id, status
    FROM orders
    WHERE user_id = ${session.sub} AND sku LIKE ${`${SHIRT_SKU_PREFIX}%`}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).at(0) ?? null;
  if (latestOrder && !canPlaceAnotherShirtOrder(latestOrder.status)) {
    return Response.json({ error: "already_ordered" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const sku = shirtSku(size);

  const details = JSON.stringify({ type: "ambassador-shirt" });
  const serializedAddress = JSON.stringify(address);

  const created = await sql.begin(async (transaction) => {
    const lockedUser = (await transaction<Pick<ShirtOrderUserRow, "id">[]>`
      SELECT id
      FROM users
      WHERE id = ${session.sub}
      LIMIT 1
      FOR UPDATE
    `).at(0);

    if (!lockedUser) {
      return { ok: false as const, status: 401, error: "unauthorized" };
    }

    const lockedLatestOrder = (await transaction<ShirtOrderRow[]>`
      SELECT id, status
      FROM orders
      WHERE user_id = ${session.sub} AND sku LIKE ${`${SHIRT_SKU_PREFIX}%`}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).at(0) ?? null;

    if (lockedLatestOrder && !canPlaceAnotherShirtOrder(lockedLatestOrder.status)) {
      return { ok: false as const, status: 409, error: "already_ordered" };
    }

    await transaction`
      INSERT INTO orders (id, user_id, status, sku, variant, quantity, address, details)
      VALUES (
        ${id},
        ${session.sub},
        ${ORDER_STATUS_PENDING},
        ${sku},
        ${size},
        1,
        CAST(${serializedAddress} AS JSONB),
        CAST(${details} AS JSONB)
      )
    `;

    return { ok: true as const };
  });

  if (!created.ok) {
    return Response.json({ error: created.error }, { status: created.status });
  }

  return Response.json({ ok: true, id });
}
