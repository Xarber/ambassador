import type { Metadata } from "next";
import { forbidden, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { canAccessPosters, getPosterAccessState } from "@/lib/posters/access";
import { listPosterCampaigns } from "@/lib/posters/config";
import { listPosterDataForUser } from "@/lib/posters/service";
import { getSafeguards } from "@/lib/safeguards";
import { getSession } from "@/lib/session";
import { canAccessStardanceReferrals } from "@/lib/stardance-referrals";

import { PostersClient } from "./PostersClient";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("posters.metadata.title");
}

export default async function PostersPage() {
  const session = await getSession();
  if (!session) redirect("/");
  await ensureSchema();
  const t = await getTranslations();

  const [user, safeguards] = await Promise.all([
    getPosterAccessState(session.sub),
    getSafeguards(),
  ]);
  const canAccessAdmin = Boolean(session.impersonator) || Boolean(user?.is_admin ?? session.isAdmin);
  const canUsePosters = canAccessPosters({
    latestApplicationStatus: user?.latest_application_status ?? null,
    manualDashboardState: user?.manual_dashboard_state ?? null,
  });

  if (!canUsePosters) {
    forbidden();
  }

  const showReferralsLink = safeguards.referralsEnabled && canAccessStardanceReferrals({
    latestApplicationStatus: user?.latest_application_status ?? null,
    manualDashboardState: user?.manual_dashboard_state ?? null,
  });

  if (!safeguards.postersEnabled || user === null || user.posters_enabled !== true) {
    return (
      <main className="page-shell">
        <Navbar
          isAdmin={canAccessAdmin}
          balanceCents={user?.balance_cents ?? 0}
          showPostersLink={safeguards.postersEnabled && user?.posters_enabled === true}
          showReferralsLink={showReferralsLink}
        />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <h1 className="font-sub text-4xl text-foreground">{t("posters.unavailable")}</h1>
        </div>
      </main>
    );
  }

  const data = await listPosterDataForUser(session.sub);

  const campaigns = listPosterCampaigns();

  const allPosters = [
    ...data.standalonePosters,
    ...data.groups.flatMap((g) => g.posters),
  ];
  const totalPosters = allPosters.length;
  const verifiedCount = allPosters.filter((p) => p.verification_status === "success").length;
  const pendingCount = allPosters.filter((p) => p.verification_status === "pending").length;

  return (
    <main className="page-shell">
      <Navbar
        isAdmin={canAccessAdmin}
        balanceCents={user.balance_cents ?? 0}
        showPostersLink
        showReferralsLink={showReferralsLink}
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-6 sm:mb-10">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3 sm:gap-x-8">
            <h1 className="font-sub text-4xl text-foreground">{t("posters.heading")}</h1>
            {totalPosters > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-2xl leading-none font-medium text-foreground">{totalPosters}</span>
                  <span className="font-body text-sm leading-none text-muted-foreground">{t("posters.stats.total")}</span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-2xl leading-none font-medium text-acceptance">{verifiedCount}</span>
                  <span className="font-body text-sm leading-none text-muted-foreground">{t("posters.stats.verified")}</span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-2xl leading-none font-medium text-accent">{pendingCount}</span>
                  <span className="font-body text-sm leading-none text-muted-foreground">{t("posters.stats.pending")}</span>
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 text-base text-muted-foreground">{t("posters.subheading")}</p>
        </header>
        <PostersClient
          initialCampaignSlug={campaigns[0]?.slug ?? null}
          campaigns={campaigns}
          initialData={data}
        />
      </div>
    </main>
  );
}
