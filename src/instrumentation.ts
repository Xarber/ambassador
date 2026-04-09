export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startAirtableSyncScheduler } = await import(
    "@/lib/applications/airtable-sync-scheduler"
  );

  startAirtableSyncScheduler();
}
