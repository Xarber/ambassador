import type { Metadata } from "next";
import { forbidden, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { canAccessPosters } from "@/lib/posters/access";
import { getSafeguards } from "@/lib/safeguards";
import { getSession } from "@/lib/session";
import {
  canAccessStardanceReferrals,
  listArchivedStardanceReferralCodesForUser,
  listStardanceReferralCodesForUser,
  listStardanceReferralsForUser,
  seedFakeStardanceReferralsForUser,
} from "@/lib/stardance-referrals";

import { ReferralsClient } from "./ReferralsClient";

type ReferralsAccessRow = {
  balance_cents: number | null;
  is_admin: boolean | null;
  posters_enabled: boolean | null;
  manual_dashboard_state: string | null;
  latest_application_status: string | null;
};

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("referrals.metadata.title");
}

export default async function ReferralsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  await ensureSchema();
  const [t, safeguards] = await Promise.all([getTranslations(), getSafeguards()]);

  const user = (await sql<ReferralsAccessRow[]>`
    SELECT
      balance_cents,
      is_admin,
      posters_enabled,
      manual_dashboard_state,
      (
        SELECT status
        FROM applications
        WHERE user_id = users.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) AS latest_application_status
    FROM users
    WHERE id = ${session.sub}
    LIMIT 1
  `).at(0) ?? null;

  const canUseReferrals = canAccessStardanceReferrals({
    latestApplicationStatus: user?.latest_application_status ?? null,
    manualDashboardState: user?.manual_dashboard_state ?? null,
  });

  if (!canUseReferrals) {
    forbidden();
  }

  const canAccessAdmin =
    Boolean(session.impersonator) || Boolean(user?.is_admin ?? session.isAdmin);
  const showPostersLink =
    safeguards.postersEnabled &&
    user?.posters_enabled === true &&
    canAccessPosters({
      latestApplicationStatus: user?.latest_application_status ?? null,
      manualDashboardState: user?.manual_dashboard_state ?? null,
    });

  if (!safeguards.referralsEnabled) {
    return (
      <main className="page-shell">
        <Navbar
          isAdmin={canAccessAdmin}
          balanceCents={user?.balance_cents ?? 0}
          showPostersLink={showPostersLink}
          showReferralsLink={false}
        />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <h1 className="text-4xl text-white">{t("referrals.unavailable")}</h1>
        </div>
      </main>
    );
  }

  const referralCodes = await listStardanceReferralCodesForUser(session.sub);
  await seedFakeStardanceReferralsForUser(session.sub);
  const [archivedReferralCodes, referrals] = await Promise.all([
    listArchivedStardanceReferralCodesForUser(session.sub),
    listStardanceReferralsForUser(session.sub),
  ]);

  return (
    <main className="page-shell">
      <Navbar
        isAdmin={canAccessAdmin}
        balanceCents={user?.balance_cents ?? 0}
        showPostersLink={showPostersLink}
        showReferralsLink
      />
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pb-28 sm:pt-12">
        <header className="mb-6 sm:mb-10">
          <h1 className="text-4xl text-white">{t("referrals.heading")}</h1>
          <p className="mt-2 text-base text-muted-foreground">{t("referrals.subheading")}</p>
        </header>
        <ReferralsClient
          referralCodes={referralCodes}
          archivedReferralCodes={archivedReferralCodes}
          referrals={referrals}
        />
      </div>
    </main>
  );
}
