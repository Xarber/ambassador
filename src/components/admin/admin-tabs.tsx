"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

export function AdminTabs() {
  const t = useTranslations("admin.tabs");
  const pathname = usePathname();

  return (
    <div className="mb-8 flex items-center gap-6 border-b border-white pb-4">
      {[
        { href: "/admin", label: t("dashboard") },
        { href: "/admin/audit-log", label: t("audit-log") },
        { href: "/admin/safeguards", label: t("flags") },
        { href: "/admin/users", label: t("users") },
        { href: "/admin/orders", label: t("orders") },
        { href: "/admin/applications", label: t("applications") },
      ].map((tab) => {
        const active =
          tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "text-lg font-bold text-white"
                : "text-lg text-secondary hover:text-white"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
