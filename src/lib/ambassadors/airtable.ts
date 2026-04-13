import { AirtableClient, AirtableError, createAirtableClient } from "@/lib/airtable";
import {
  getAirtableApplicationFieldId,
  getAirtableApplicationsTableId,
} from "@/lib/applications/airtable";
import {
  getAirtableBaseId,
  getAirtableFieldId,
  getAirtableFieldValue,
  getAirtableTableId,
} from "@/lib/airtable-schema";

function getAirtableAmbassadorsClient() {
  return createAirtableClient(getAirtableBaseId());
}

export function getAirtableAmbassadorsTableId() {
  return getAirtableTableId("ambassadors");
}

function getAirtableAmbassadorFieldId(
  fieldKey: "onboardingComplete" | "tshirtSent",
) {
  return getAirtableFieldId("ambassadors", fieldKey);
}

function getAirtableAmbassadorFieldValue(
  fields: Record<string, unknown>,
  fieldKey: "onboardingComplete",
) {
  return getAirtableFieldValue(fields, "ambassadors", fieldKey);
}

async function getRecordById(
  client: AirtableClient,
  tableId: string,
  recordId: string,
) {
  try {
    return await client.getRecord<Record<string, unknown>>(tableId, recordId, {
      returnFieldsByFieldId: true,
    });
  } catch (error) {
    if (error instanceof AirtableError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export type AmbassadorOnboardingStatus = {
  hasAmbassadorRecord: boolean;
  onboardingComplete: boolean;
};

function getAmbassadorRecordIdsFromApplicationPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const fields = payload as Record<string, unknown>;
  const linkedRecordIds = fields[getAirtableApplicationFieldId("ambassadors")] ?? fields.ambassadors;

  return Array.isArray(linkedRecordIds)
    ? linkedRecordIds.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

async function getAmbassadorRecordIds(input: {
  client: AirtableClient;
  applicationAirtableRecordId?: string | null;
  applicationAirtablePayload?: unknown;
}) {
  const applicationAirtableRecordId = input.applicationAirtableRecordId?.trim();
  let ambassadorRecordIds = getAmbassadorRecordIdsFromApplicationPayload(
    input.applicationAirtablePayload,
  );

  if (ambassadorRecordIds.length === 0 && applicationAirtableRecordId) {
    try {
      const applicationRecord = await getRecordById(
        input.client,
        getAirtableApplicationsTableId(),
        applicationAirtableRecordId,
      );

      ambassadorRecordIds = applicationRecord
        ? getAmbassadorRecordIdsFromApplicationPayload(applicationRecord.fields)
        : [];
    } catch (error) {
      if (error instanceof AirtableError) {
        console.warn(
          `[airtable] unable to load application record ${applicationAirtableRecordId}: ${error.message}`,
        );
      } else {
        console.warn("[airtable] unable to load application record for ambassador sync", error);
      }
    }
  }

  return ambassadorRecordIds;
}

export async function getAmbassadorOnboardingStatus(input: {
  applicationAirtableRecordId?: string | null;
  applicationAirtablePayload?: unknown;
}): Promise<AmbassadorOnboardingStatus> {
  const applicationAirtableRecordId = input.applicationAirtableRecordId?.trim();
  const client = getAirtableAmbassadorsClient();
  const cachedAmbassadorRecordIds = getAmbassadorRecordIdsFromApplicationPayload(
    input.applicationAirtablePayload,
  );

  if (!client) {
    return {
      hasAmbassadorRecord: cachedAmbassadorRecordIds.length > 0,
      onboardingComplete: false,
    };
  }

  const ambassadorRecordIds = await getAmbassadorRecordIds({
    client,
    applicationAirtableRecordId,
    applicationAirtablePayload: input.applicationAirtablePayload,
  });

  if (ambassadorRecordIds.length === 0) {
    return {
      hasAmbassadorRecord: false,
      onboardingComplete: false,
    };
  }

  const ambassadorRecords = (
    await Promise.all(
      ambassadorRecordIds.map(async (recordId) => {
        try {
          return await getRecordById(client, getAirtableAmbassadorsTableId(), recordId);
        } catch (error) {
          if (error instanceof AirtableError) {
            console.warn(
              `[airtable] unable to load ambassador record ${recordId}: ${error.message}`,
            );
            return null;
          }

          throw error;
        }
      }),
    )
  ).filter((record): record is NonNullable<typeof record> => Boolean(record));

  if (ambassadorRecords.length === 0) {
    return {
      hasAmbassadorRecord: true,
      onboardingComplete: false,
    };
  }

  const onboardingComplete = ambassadorRecords.some((record) => {
    return Boolean(getAirtableAmbassadorFieldValue(record.fields, "onboardingComplete"));
  });

  return {
    hasAmbassadorRecord: true,
    onboardingComplete,
  };
}

export async function syncAmbassadorTshirtSentToAirtable(input: {
  applicationAirtableRecordId?: string | null;
  applicationAirtablePayload?: unknown;
  sent: boolean;
}) {
  const client = getAirtableAmbassadorsClient();

  if (!client) return null;

  const ambassadorRecordIds = await getAmbassadorRecordIds({
    client,
    applicationAirtableRecordId: input.applicationAirtableRecordId,
    applicationAirtablePayload: input.applicationAirtablePayload,
  });

  if (ambassadorRecordIds.length === 0) return null;

  let updatedCount = 0;

  await Promise.all(
    ambassadorRecordIds.map(async (recordId) => {
      try {
        await client.updateRecord(getAirtableAmbassadorsTableId(), recordId, {
          [getAirtableAmbassadorFieldId("tshirtSent")]: input.sent,
        });
        updatedCount += 1;
      } catch (error) {
        if (error instanceof AirtableError) {
          console.warn(
            `[airtable] unable to sync ambassador tshirt-sent for ${recordId}: ${error.message}`,
          );
          return;
        }

        throw error;
      }
    }),
  );

  return {
    recordIds: ambassadorRecordIds,
    updatedCount,
    syncedAt: new Date(),
  };
}
