"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SafeguardKey } from "@/lib/safeguards";

type SafeguardControl = {
  key: SafeguardKey;
  title: string;
  description: string;
  enabled: boolean;
  enableAction: string;
  disableAction: string;
};

export function SafeguardsClient({
  controls,
  columns,
  errorMessage,
}: {
  controls: SafeguardControl[];
  columns: { toggle: string; flag: string; description: string };
  errorMessage: string;
}) {
  const router = useRouter();
  const [states, setStates] = useState(() =>
    Object.fromEntries(controls.map((control) => [control.key, control.enabled])),
  );
  const [pendingKey, setPendingKey] = useState<SafeguardKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleSafeguard(control: SafeguardControl) {
    if (pendingKey !== null) return;

    const currentEnabled = states[control.key] ?? control.enabled;
    const nextEnabled = !currentEnabled;
    setPendingKey(control.key);
    setError(null);
    setStates((current) => ({ ...current, [control.key]: nextEnabled }));

    try {
      const response = await fetch("/api/admin/safeguards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: control.key,
          enabled: nextEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to update safeguard");
      }

      router.refresh();
    } catch {
      setStates((current) => ({ ...current, [control.key]: currentEnabled }));
      setError(errorMessage);
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <>
      <div className="overflow-x-auto border border-white/10 bg-card p-3 md:p-4">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white">
              <th className="px-5 py-4 font-body text-base text-secondary">{columns.flag}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{columns.description}</th>
              <th className="px-5 py-4 font-body text-base text-secondary text-center">{columns.toggle}</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((control) => {
              const enabled = states[control.key] ?? control.enabled;
              const pending = pendingKey === control.key;

              return (
                <tr key={control.key} className="border-b border-white last:border-b-0">
                  <td className="px-5 py-4 font-body text-base text-white">{control.title}</td>
                  <td className="px-5 py-4 font-body text-sm text-foreground">{control.description}</td>
                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      data-slot="icon-link"
                      aria-label={enabled ? control.disableAction : control.enableAction}
                      title={enabled ? control.disableAction : control.enableAction}
                      className="inline-flex cursor-pointer appearance-none border-0 bg-transparent p-0 text-base leading-none outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ color: enabled ? "var(--acceptance)" : "var(--primary)" }}
                      disabled={pending || pendingKey !== null}
                      onClick={() => void toggleSafeguard(control)}
                    >
                      {enabled ? "\u25CF" : "\u25CB"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error ? <p className="font-body text-sm text-primary">{error}</p> : null}
    </>
  );
}
