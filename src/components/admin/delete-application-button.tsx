"use client";

import { buttonVariants } from "@/components/ui/button";

export function DeleteApplicationButton({
  applicationId,
  label,
}: {
  applicationId: string;
  label: string;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("Delete this application from our side? It will resync from Airtable on the next sync.")) {
      e.preventDefault();
    }
  }

  return (
    <form
      action={`/api/admin/applications/${applicationId}/delete`}
      method="POST"
      className="max-w-xl space-y-3"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="redirectTo" value="/admin/applications" />
      <button className={buttonVariants({ size: "app" })}>
        {label}
      </button>
    </form>
  );
}
