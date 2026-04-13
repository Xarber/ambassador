import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

type AirtableIdRef = {
  id: string;
  name: string;
};

export type ApplicationFieldKey =
  | "id"
  | "status"
  | "rejectionReason"
  | "preferredName"
  | "firstName"
  | "lastName"
  | "email"
  | "slackId"
  | "birthdate"
  | "addressLine1"
  | "addressLine2"
  | "addressCity"
  | "addressState"
  | "addressZip"
  | "addressCountry"
  | "phone"
  | "githubUrl"
  | "portfolioUrl"
  | "applicationFirstThingDo"
  | "applicationBestPlacePoster"
  | "idvEligible"
  | "idvStatus"
  | "ambassadors";

export type AmbassadorFieldKey =
  | "id"
  | "preferredName"
  | "firstName"
  | "lastName"
  | "email"
  | "slackId"
  | "application"
  | "onboarding"
  | "onboardingComplete"
  | "hcbEmail"
  | "hcbGrantLink"
  | "tshirtSent"
  | "syncRoster"
  | "headshot"
  | "bio";

type OnboardingFieldKey = "id" | "ambassador" | "hcbEmail" | "headshot" | "bio";
type SyncRosterFieldKey = "id" | "ambassador" | "email";

type AirtableTableKey = "applications" | "ambassadors" | "onboarding" | "syncRoster";

type AirtableFieldKeysByTable = {
  applications: ApplicationFieldKey;
  ambassadors: AmbassadorFieldKey;
  onboarding: OnboardingFieldKey;
  syncRoster: SyncRosterFieldKey;
};

type AirtableTableSchema<TFieldKey extends string> = {
  id: string;
  name: string;
  primaryField: AirtableIdRef;
  views: Record<string, AirtableIdRef>;
  fields: Record<TFieldKey, AirtableIdRef>;
};

type AirtableSchema = {
  base: {
    id: string;
  };
  tables: {
    applications: AirtableTableSchema<ApplicationFieldKey>;
    ambassadors: AirtableTableSchema<AmbassadorFieldKey>;
    onboarding: AirtableTableSchema<OnboardingFieldKey>;
    syncRoster: AirtableTableSchema<SyncRosterFieldKey>;
  };
};

const AIRTABLE_TABLE_ENV_KEYS: Record<AirtableTableKey, string> = {
  applications: "AIRTABLE_APPLICATIONS_TABLE_ID",
  ambassadors: "AIRTABLE_AMBASSADORS_TABLE_ID",
  onboarding: "AIRTABLE_ONBOARDING_TABLE_ID",
  syncRoster: "AIRTABLE_SYNC_ROSTER_TABLE_ID",
};

const airtableSchema = parse(
  readFileSync(path.join(process.cwd(), "src/lib/airtable.yaml"), "utf8"),
) as AirtableSchema;

function getAirtableField<TTable extends AirtableTableKey>(
  tableKey: TTable,
  fieldKey: AirtableFieldKeysByTable[TTable],
) {
  return (airtableSchema.tables[tableKey].fields as Record<string, AirtableIdRef>)[fieldKey];
}

export function getAirtableBaseId() {
  return process.env.AIRTABLE_BASE_ID?.trim() || airtableSchema.base.id;
}

export function getAirtableTableId<TTable extends AirtableTableKey>(tableKey: TTable) {
  const envKey = AIRTABLE_TABLE_ENV_KEYS[tableKey];
  return process.env[envKey]?.trim() || airtableSchema.tables[tableKey].id;
}

export function getAirtableFieldId<TTable extends AirtableTableKey>(
  tableKey: TTable,
  fieldKey: AirtableFieldKeysByTable[TTable],
) {
  return getAirtableField(tableKey, fieldKey).id;
}

export function getAirtableFieldValue<TTable extends AirtableTableKey>(
  fields: Record<string, unknown>,
  tableKey: TTable,
  fieldKey: AirtableFieldKeysByTable[TTable],
) {
  const field = getAirtableField(tableKey, fieldKey);
  return fields[field.id] ?? fields[field.name];
}
