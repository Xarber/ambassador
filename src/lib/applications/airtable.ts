import {
  AirtableError,
  AirtableRecord,
  createAirtableClient,
} from "@/lib/airtable";
import {
  type ApplicationFieldKey,
  getAirtableBaseId,
  getAirtableFieldId,
  getAirtableFieldValue,
  getAirtableTableId,
} from "@/lib/airtable-schema";
import {
  APPLICATION_STATUS_ACCEPTED,
  type ApplicationStatus,
} from "@/lib/applications/status";

export type AirtableApplicationFields = Record<string, unknown>;
export type AirtableApplicationRecord = AirtableRecord<AirtableApplicationFields>;

type ApplicationReviewSyncInput = {
  airtableRecordId?: string | null;
  status: ApplicationStatus;
  note?: string | null;
};

type AirtableReadOptions = {
  signal?: AbortSignal;
};

function getAirtableApplicationsClient() {
  return createAirtableClient(getAirtableBaseId());
}

export function getAirtableApplicationsTableId() {
  return getAirtableTableId("applications");
}

export function getAirtableApplicationFieldId(fieldKey: ApplicationFieldKey) {
  return getAirtableFieldId("applications", fieldKey);
}

export function getAirtableApplicationFieldValue(
  fields: Record<string, unknown>,
  key: ApplicationFieldKey,
) {
  return getAirtableFieldValue(fields, "applications", key);
}

export async function listAirtableApplicationRecords(options: AirtableReadOptions = {}) {
  const client = getAirtableApplicationsClient();

  if (!client) return [];

  const records: AirtableApplicationRecord[] = [];
  let offset: string | undefined;

  do {
    const response = await client.listRecords<Record<string, unknown>>(
      getAirtableApplicationsTableId(),
      {
        offset,
        pageSize: 100,
        sort: [{ field: getAirtableApplicationFieldId("id"), direction: "asc" }],
      },
      {
        ...options,
        returnFieldsByFieldId: true,
      },
    );

    records.push(...response.records);
    offset = response.offset;
  } while (offset);

  return records;
}

export async function syncApplicationReviewDecisionToAirtable(
  input: ApplicationReviewSyncInput,
) {
  const client = getAirtableApplicationsClient();
  const recordId = input.airtableRecordId?.trim();

  if (!client || !recordId) return null;

  try {
    await client.updateRecord(getAirtableApplicationsTableId(), recordId, {
      [getAirtableApplicationFieldId("status")]: input.status,
      [getAirtableApplicationFieldId("rejectionReason")]:
        input.status === APPLICATION_STATUS_ACCEPTED ? null : input.note?.trim() || null,
    });
  } catch (error) {
    if (error instanceof AirtableError && error.status === 404) {
      throw new Error(`Unable to find Airtable application record ${recordId}`);
    }

    throw error;
  }

  return {
    recordId,
    syncedAt: new Date(),
  };
}
