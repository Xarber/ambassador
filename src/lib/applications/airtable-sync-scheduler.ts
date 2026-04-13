import { syncAirtableApplicationsToPostgres } from "@/lib/applications/sync";
import { ensureSchema } from "@/lib/database/ensure-schema";

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 15_000;

const LEGACY_ENV_KEYS = {
  intervalMs: "DEV_AIRTABLE_SYNC_INTERVAL_MS",
  timeoutMs: "DEV_AIRTABLE_SYNC_TIMEOUT_MS",
} as const;

declare global {
  var __airtableSyncSchedulerStarted: boolean | undefined;
}

function isEnabled(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;

  return fallback;
}

function readStringEnv(name: string, legacyName?: string) {
  const value = process.env[name]?.trim();
  if (value) return value;

  const legacyValue = legacyName ? process.env[legacyName]?.trim() : "";
  if (legacyValue) {
    console.warn(`[airtable-sync] ${legacyName} is deprecated. Use ${name} instead.`);
    return legacyValue;
  }

  return "";
}

async function runSync(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Airtable sync exceeded timeout_ms=${timeoutMs}`));
  }, timeoutMs);
  const startedAt = Date.now();

  try {
    await ensureSchema();
    const result = await syncAirtableApplicationsToPostgres({
      signal: controller.signal,
    });
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[airtable-sync] ok (${elapsedMs}ms) ${[
        `processed=${result.processed}`,
        `inserted=${result.inserted}`,
        `updated=${result.updated}`,
        `unmatched=${result.unmatchedApplications}`,
        `matchedUsers=${result.matchedUsers}`,
      ].join(" ")}`,
    );
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    console.error(
      `[airtable-sync] failed (${elapsedMs}ms) ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function startAirtableSyncScheduler() {
  if (globalThis.__airtableSyncSchedulerStarted) {
    return;
  }

  globalThis.__airtableSyncSchedulerStarted = true;

  if (!isEnabled(process.env.AIRTABLE_SYNC_AUTOSTART, true)) {
    console.log("[airtable-sync] autostart disabled");
    return;
  }

  if (!process.env.AIRTABLE_PAT?.trim()) {
    console.log("[airtable-sync] disabled because AIRTABLE_PAT is not set");
    return;
  }

  const intervalMs = (() => {
    const value = readStringEnv("AIRTABLE_SYNC_INTERVAL_MS", LEGACY_ENV_KEYS.intervalMs);
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS;
  })();
  const timeoutMs = (() => {
    const value = readStringEnv("AIRTABLE_SYNC_TIMEOUT_MS", LEGACY_ENV_KEYS.timeoutMs);
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
  })();

  let inFlight = false;

  const tick = async () => {
    if (inFlight) return;

    inFlight = true;

    try {
      await runSync(timeoutMs);
    } finally {
      inFlight = false;
    }
  };

  console.log(`[airtable-sync] running every ${Math.round(intervalMs / 1000)}s`);
  void tick();

  const intervalId = setInterval(() => {
    void tick();
  }, intervalMs);

  const shutdown = (signal: string) => {
    clearInterval(intervalId);
    console.log(`[airtable-sync] stopping (${signal})`);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}
