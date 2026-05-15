import { forbidden, unauthorized } from "next/navigation";

import { AdminTabs } from "@/components/admin/admin-tabs";
import { Navbar } from "@/components/navbar";
import { canAccessPosters, getPosterAccessState } from "@/lib/posters/access";
import { getSafeguards } from "@/lib/safeguards";
import { getActorSession } from "@/lib/session";
import { canAccessStardanceReferrals } from "@/lib/stardance-referrals";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getActorSession();
  if (!session) unauthorized();

  const [user, safeguards] = await Promise.all([
    getPosterAccessState(session.sub),
    getSafeguards(),
  ]);
  if (user === null || user.is_admin !== true) forbidden();
  const showPostersLink = safeguards.postersEnabled && canAccessPosters({
    latestApplicationStatus: user.latest_application_status ?? null,
    manualDashboardState: user.manual_dashboard_state ?? null,
  });
  const showReferralsLink = safeguards.referralsEnabled && canAccessStardanceReferrals({
    latestApplicationStatus: user.latest_application_status ?? null,
    manualDashboardState: user.manual_dashboard_state ?? null,
  });

  return (
    <div className="page-shell">
      <Navbar
        isAdmin
        balanceCents={user.balance_cents ?? 0}
        showPostersLink={showPostersLink}
        showReferralsLink={showReferralsLink}
      />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <AdminTabs />
        {children}
      </div>
    </div>
  );
}
