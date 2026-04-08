import { getTranslations } from "next-intl/server";
import {
  getApplicationStatusMeta,
  normalizeApplicationStatus,
} from "@/lib/applications/status";
import { pillVariants } from "@/components/ui/pill";

export async function StatusBadge({ status }: { status: string | null | undefined }) {
  const t = await getTranslations();
  const applicationStatusMeta = getApplicationStatusMeta(t);
  const normalizedStatus = normalizeApplicationStatus(status);
  const meta = normalizedStatus
    ? applicationStatusMeta[normalizedStatus]
    : {
        label: status ?? t("common.unknown"),
        tone: "black" as const,
      };

  return (
    <span className={pillVariants({ tone: meta.tone })}>
      {meta.label}
    </span>
  );
}
