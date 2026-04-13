import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import sql from "@/lib/database/client";
import { canAccessPosters, getPosterAccessState } from "@/lib/posters/access";
import { getSession } from "@/lib/session";
import { ensureUserAddressSchema } from "@/lib/database/user-address-schema";

import SettingsClient from "./SettingsClient";

type SettingsUserRow = {
  display_name: string;
  email: string | null;
  hca_first_name: string | null;
  hca_last_name: string | null;
  slack_name: string | null;
  verification_status: string | null;
  ambassador_region: string | null;
  hca_country: string | null;
  country_name: string | null;
  country_code: string | null;
  balance_cents: number | null;
  is_admin: boolean | null;
};

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("settings.metadata.title");
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const t = await getTranslations();
  await ensureUserAddressSchema();

  const [settingsUser, posterAccessState] = await Promise.all([
    sql<SettingsUserRow[]>`
      SELECT
        display_name, email, hca_first_name, hca_last_name,
        slack_id, slack_name, verification_status,
        ambassador_region, hca_country, country_name, country_code,
        balance_cents, is_admin
      FROM users WHERE id = ${session.sub}
    `.then((rows) => rows.at(0) ?? null),
    getPosterAccessState(session.sub),
  ]);

  if (!settingsUser) {
    redirect("/");
  }

  const canAccessAdmin = Boolean(session.impersonator) || Boolean(settingsUser.is_admin ?? session.isAdmin);
  const showPostersLink = canAccessPosters({
    latestApplicationStatus: posterAccessState.latest_application_status,
    manualDashboardState: posterAccessState.manual_dashboard_state,
  });

  return (
    <main className="page-shell">
      <Navbar
        isAdmin={canAccessAdmin}
        balanceCents={settingsUser.balance_cents ?? 0}
        showPostersLink={showPostersLink}
      />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-4xl text-white">{t("settings.heading")}</h1>
        <hr className="mt-6 border-white/10" />

        <SettingsClient
          displayName={settingsUser.display_name}
          email={settingsUser.email ?? session.email ?? ""}
          firstName={settingsUser.hca_first_name ?? ""}
          lastName={settingsUser.hca_last_name ?? ""}
          slackName={settingsUser.slack_name ?? ""}
          verificationStatus={settingsUser.verification_status ?? ""}
          currentRegion={settingsUser.ambassador_region}
          detectedRegions={[
            settingsUser.hca_country,
            settingsUser.country_name,
            settingsUser.country_code,
          ]}
        />
      </div>
    </main>
  );
}
