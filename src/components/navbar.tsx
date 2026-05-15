import Image from "next/image";
import { getTranslations } from "next-intl/server";

import Icon from "@hackclub/icons";

import { cn } from "@/lib/utils";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export async function Navbar({
  isAdmin = false,
  balanceCents = 0,
  showPostersLink = false,
  showReferralsLink = false,
  showBottomBorder = true,
}: {
  isAdmin?: boolean;
  balanceCents?: number;
  showPostersLink?: boolean;
  showReferralsLink?: boolean;
  showBottomBorder?: boolean;
}) {
  const t = await getTranslations();
  const balance = usdFormatter.format(balanceCents / 100);

  return (
    <nav
      className={cn(
        "bg-[var(--topbar)] px-3 py-4 sm:px-6",
        showBottomBorder && "border-b border-foreground/10",
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
        <a href="/dashboard" className="flex shrink-0 items-center gap-3">
          <Image
            src="/dashboard-logo.avif"
            alt={t("app.navbar.logo-alt")}
            width={787}
            height={798}
            className="h-9 w-auto"
            sizes="2.25rem"
          />
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="inline-flex h-9 items-center rounded-lg px-2 text-sm tracking-wide text-acceptance sm:px-3 sm:text-base">
            {balance}
          </span>
          {isAdmin && (
            <a
              href="/admin"
              className="inline-flex h-9 items-center rounded-lg px-2 text-sm tracking-wide text-accent transition-opacity hover:opacity-70 sm:px-3 sm:text-base"
            >
              {t("app.navbar.admin-link")}
            </a>
          )}
          {showPostersLink ? (
            <a
              href="/posters"
              className="inline-flex h-9 items-center rounded-lg px-2 text-sm tracking-wide text-white transition-opacity hover:opacity-70 sm:px-3 sm:text-base"
            >
              {t("app.navbar.posters-link")}
            </a>
          ) : null}
          {showReferralsLink ? (
            <a
              href="/referrals"
              className="inline-flex h-9 items-center rounded-lg px-2 text-sm tracking-wide text-white transition-opacity hover:opacity-70 sm:px-3 sm:text-base"
            >
              {t("app.navbar.referrals-link")}
            </a>
          ) : null}
          <a
            href="/settings"
            aria-label={t("app.navbar.settings-label")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-70"
          >
            <Icon glyph="settings" size={20} />
          </a>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              aria-label={t("app.navbar.sign-out-label")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-70"
            >
              <Icon glyph="door-leave" size={20} />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
