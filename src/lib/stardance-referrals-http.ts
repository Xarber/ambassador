import "server-only";

import { ensureSchema } from "@/lib/database/ensure-schema";
import sql from "@/lib/database/client";
import { getSafeguards } from "@/lib/safeguards";
import { getSession } from "@/lib/session";
import { canAccessStardanceReferrals } from "@/lib/stardance-referrals";

type StardanceReferralAccessRow = {
  manual_dashboard_state: string | null;
  latest_application_status: string | null;
};

export class StardanceReferralRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StardanceReferralRequestError";
  }
}

async function getStardanceReferralAccessState(userId: string) {
  return (await sql<StardanceReferralAccessRow[]>`
    SELECT
      manual_dashboard_state,
      (
        SELECT status
        FROM applications
        WHERE user_id = users.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) AS latest_application_status
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `).at(0) ?? null;
}

export async function requireStardanceReferralSession() {
  const session = await getSession();

  if (!session) {
    throw new StardanceReferralRequestError("Unauthorized", 401);
  }

  await ensureSchema();
  const [user, safeguards] = await Promise.all([
    getStardanceReferralAccessState(session.sub),
    getSafeguards(),
  ]);

  if (
    user === null ||
    !canAccessStardanceReferrals({
      latestApplicationStatus: user.latest_application_status ?? null,
      manualDashboardState: user.manual_dashboard_state ?? null,
    })
  ) {
    throw new StardanceReferralRequestError("Forbidden", 403);
  }

  if (!safeguards.referralsEnabled) {
    throw new StardanceReferralRequestError("Coming soon!", 403);
  }

  return session;
}

export function stardanceReferralErrorResponse(error: unknown, fallback: string) {
  if (error instanceof StardanceReferralRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error) {
    console.error(error);
  }

  return Response.json({ error: fallback }, { status: 400 });
}
