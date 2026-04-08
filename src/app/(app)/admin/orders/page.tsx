import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getTranslatedPageMetadata } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.orders.metadata.title");
}

export default async function AdminOrdersPage() {
  const t = await getTranslations();

  return (
    <div>
      <h1 className="mb-6 text-4xl text-white">{t("admin.orders.title")}</h1>
      <div>
        <p className="font-body text-xl text-white">{t("admin.orders.empty")}</p>
      </div>
    </div>
  );
}
