import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SafeguardsClient } from "@/components/admin/safeguards-client";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { listSafeguardStates, SAFEGUARD_KEYS } from "@/lib/safeguards";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.safeguards.metadata.title");
}

export default async function AdminSafeguardsPage() {
  const [t] = await Promise.all([getTranslations(), ensureSchema()]);
  const safeguards = await listSafeguardStates();
  const stateByKey = new Map(safeguards.map((state) => [state.key, state]));

  return (
    <div className="space-y-6">
      <h1 className="text-4xl text-white">{t("admin.safeguards.title")}</h1>

      <SafeguardsClient
        errorMessage={t("admin.safeguards.errors.update-failed")}
        columns={{
          toggle: t("admin.safeguards.columns.toggle"),
          flag: t("admin.safeguards.columns.flag"),
          description: t("admin.safeguards.columns.description"),
        }}
        controls={[
          {
            key: SAFEGUARD_KEYS.onboardingEnabled,
            title: t("admin.safeguards.onboarding.title"),
            description: t("admin.safeguards.onboarding.description"),
            enabled: stateByKey.get(SAFEGUARD_KEYS.onboardingEnabled)?.enabled ?? true,
            enableAction: t("admin.safeguards.onboarding.enable"),
            disableAction: t("admin.safeguards.onboarding.disable"),
          },
          {
            key: SAFEGUARD_KEYS.shirtOrderingEnabled,
            title: t("admin.safeguards.shirt-ordering.title"),
            description: t("admin.safeguards.shirt-ordering.description"),
            enabled: stateByKey.get(SAFEGUARD_KEYS.shirtOrderingEnabled)?.enabled ?? true,
            enableAction: t("admin.safeguards.shirt-ordering.enable"),
            disableAction: t("admin.safeguards.shirt-ordering.disable"),
          },
        ]}
      />
    </div>
  );
}
