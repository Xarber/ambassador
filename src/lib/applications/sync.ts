import sql from "@/lib/database/client";
import {
  type AirtableApplicationRecord,
  getAirtableApplicationFieldValue,
  listAirtableApplicationRecords,
} from "@/lib/applications/airtable";
import {
  APPLICATION_STATUS_PENDING_REVIEW,
  isRejectedPermanentlyApplicationStatus,
  normalizeApplicationStatus,
} from "@/lib/applications/status";

type SyncApplicationsResult = {
  inserted: number;
  matchedUsers: number;
  processed: number;
  unmatchedApplications: number;
  updated: number;
};

type SyncApplicationsOptions = {
  signal?: AbortSignal;
};

type LinkApplicationsToUserInput = {
  email?: string | null;
  hcaId?: string | null;
  slackId?: string | null;
  userId: string;
};

type MatchedUser = {
  hca_id: string;
  id: string;
};

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;

  throw signal.reason instanceof Error ? signal.reason : new Error("Airtable sync was aborted");
}

async function findMatchedUser(record: AirtableApplicationRecord): Promise<MatchedUser | null> {
  const slackIdValue = getAirtableApplicationFieldValue(record.fields, "slackId");
  const slackId = typeof slackIdValue === "string" && slackIdValue.trim() ? slackIdValue.trim() : null;

  if (slackId) {
    const [user] = await sql<MatchedUser[]>`
      SELECT id, hca_id
      FROM users
      WHERE slack_id = ${slackId}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `;

    if (user) return user;
  }

  const emailValue = getAirtableApplicationFieldValue(record.fields, "email");
  const email = typeof emailValue === "string" && emailValue.trim() ? emailValue.trim() : null;

  if (!email) return null;

  const [user] = await sql<MatchedUser[]>`
    SELECT id, hca_id
    FROM users
    WHERE LOWER(email) = LOWER(${email})
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `;

  return user ?? null;
}

async function syncPermanentRejectionStateForUser(userId: string) {
  const [latestApplication] = await sql<
    Array<{ rejection_reason: string | null; status: string | null }>
  >`
    SELECT status, rejection_reason
    FROM applications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;

  if (!latestApplication) return;

  if (isRejectedPermanentlyApplicationStatus(latestApplication.status)) {
    await sql`
      UPDATE users
      SET permanently_rejected_at = COALESCE(permanently_rejected_at, NOW()),
          permanent_rejection_note = ${latestApplication.rejection_reason},
          updated_at = NOW()
      WHERE id = ${userId}
    `;

    return;
  }

  await sql`
    UPDATE users
    SET permanently_rejected_at = NULL,
        permanent_rejection_note = NULL,
        updated_at = NOW()
    WHERE id = ${userId}
  `;
}

export async function linkApplicationsToUser(input: LinkApplicationsToUserInput) {
  const slackId = input.slackId?.trim() || null;
  const email = input.email?.trim() || null;
  const hcaId = input.hcaId?.trim() || null;
  const hasSlackId = slackId !== null;
  const hasEmail = email !== null;

  if (!slackId && !email && !hcaId) return 0;

  const matchedApplications = await sql<Array<{ id: string }>>`
    UPDATE applications
    SET user_id = ${input.userId},
        applicant_hca_id = COALESCE(${hcaId}, applicant_hca_id),
        applicant_email = COALESCE(applicant_email, ${email}),
        applicant_slack_id = COALESCE(applicant_slack_id, ${slackId}),
        updated_at = NOW()
    WHERE (user_id IS NULL OR user_id = ${input.userId})
      AND (
        (${hasSlackId} AND applicant_slack_id = ${slackId})
        OR (${hasEmail} AND LOWER(applicant_email) = LOWER(${email}))
      )
    RETURNING id
  `;

  await sql`
    UPDATE applications
    SET applicant_hca_id = COALESCE(${hcaId}, applicant_hca_id),
        applicant_email = COALESCE(applicant_email, ${email}),
        applicant_slack_id = COALESCE(applicant_slack_id, ${slackId}),
        updated_at = NOW()
    WHERE user_id = ${input.userId}
  `;

  if (matchedApplications.length > 0) {
    await syncPermanentRejectionStateForUser(input.userId);
  }

  return matchedApplications.length;
}

export async function syncAirtableApplicationsToPostgres(
  options: SyncApplicationsOptions = {},
): Promise<SyncApplicationsResult> {
  throwIfAborted(options.signal);

  const records = await listAirtableApplicationRecords({ signal: options.signal });
  const result: SyncApplicationsResult = {
    inserted: 0,
    matchedUsers: 0,
    processed: records.length,
    unmatchedApplications: 0,
    updated: 0,
  };

  const matchedUserIds = new Set<string>();
  const touchedUserIds = new Set<string>();

  for (const record of records) {
    throwIfAborted(options.signal);

    const matchedUser = await findMatchedUser(record);
    throwIfAborted(options.signal);

    const [existingApplication] = await sql<
      Array<{ id: string; user_id: string | null }>
    >`
      SELECT id, user_id
      FROM applications
      WHERE airtable_record_id = ${record.id}
      LIMIT 1
    `;
    throwIfAborted(options.signal);

    const fieldValues = Object.fromEntries(
      ([
        "status",
        "preferredName",
        "firstName",
        "lastName",
        "rejectionReason",
        "email",
        "slackId",
        "phone",
        "birthdate",
        "addressLine1",
        "addressLine2",
        "addressCity",
        "addressState",
        "addressZip",
        "addressCountry",
        "githubUrl",
        "portfolioUrl",
        "applicationFirstThingDo",
        "applicationBestPlacePoster",
        "idvStatus",
      ] as const).map((key) => {
        const value = getAirtableApplicationFieldValue(record.fields, key);

        return [key, typeof value === "string" && value.trim() ? value.trim() : null];
      }),
    ) as Record<
      | "status"
      | "preferredName"
      | "firstName"
      | "lastName"
      | "rejectionReason"
      | "email"
      | "slackId"
      | "phone"
      | "birthdate"
      | "addressLine1"
      | "addressLine2"
      | "addressCity"
      | "addressState"
      | "addressZip"
      | "addressCountry"
      | "githubUrl"
      | "portfolioUrl"
      | "applicationFirstThingDo"
      | "applicationBestPlacePoster"
      | "idvStatus",
      string | null
    >;
    const status =
      normalizeApplicationStatus(fieldValues.status) ||
      APPLICATION_STATUS_PENDING_REVIEW;
    const applicationName =
      [fieldValues.preferredName ?? fieldValues.firstName, fieldValues.lastName]
        .filter((value): value is string => Boolean(value))
        .join(" ") ||
      null;
    const rejectionReason = fieldValues.rejectionReason;
    const userId = matchedUser?.id ?? existingApplication?.user_id ?? null;
    const payload = record.fields;
    const createdAt = new Date(record.createdTime).toISOString();
    const syncedAt = new Date().toISOString();

    if (userId) {
      touchedUserIds.add(userId);
      matchedUserIds.add(userId);
    } else {
      result.unmatchedApplications += 1;
    }

    if (existingApplication) {
      await sql`
        UPDATE applications
        SET user_id = ${userId},
            status = ${status},
            name = ${applicationName},
            applicant_email = ${fieldValues.email},
            applicant_slack_id = ${fieldValues.slackId},
            applicant_hca_id = ${matchedUser?.hca_id ?? null},
            applicant_phone = ${fieldValues.phone},
            date_of_birth = ${fieldValues.birthdate},
            address_line_1 = ${fieldValues.addressLine1},
            address_line_2 = ${fieldValues.addressLine2},
            address_city = ${fieldValues.addressCity},
            address_state = ${fieldValues.addressState},
            address_zip = ${fieldValues.addressZip},
            address_country = ${fieldValues.addressCountry},
            github_url = ${fieldValues.githubUrl},
            portfolio_url = ${fieldValues.portfolioUrl},
            application_first_thing_do = ${fieldValues.applicationFirstThingDo},
            application_best_place_poster = ${fieldValues.applicationBestPlacePoster},
            idv_status = ${fieldValues.idvStatus},
            rejection_reason = ${rejectionReason},
            decision_note = ${rejectionReason},
            airtable_created_time = ${createdAt},
            airtable_last_synced_at = ${syncedAt},
            airtable_payload = ${JSON.stringify(payload)},
            updated_at = NOW()
        WHERE id = ${existingApplication.id}
      `;
      throwIfAborted(options.signal);

      result.updated += 1;
      continue;
    }

    await sql`
      INSERT INTO applications (
        id,
        user_id,
        status,
        name,
        applicant_email,
        applicant_slack_id,
        applicant_hca_id,
        applicant_phone,
        date_of_birth,
        address_line_1,
        address_line_2,
        address_city,
        address_state,
        address_zip,
        address_country,
        github_url,
        portfolio_url,
        application_first_thing_do,
        application_best_place_poster,
        idv_status,
        rejection_reason,
        decision_note,
        airtable_record_id,
        airtable_created_time,
        airtable_last_synced_at,
        airtable_payload,
        created_at,
        updated_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${userId},
        ${status},
        ${applicationName},
        ${fieldValues.email},
        ${fieldValues.slackId},
        ${matchedUser?.hca_id ?? null},
        ${fieldValues.phone},
        ${fieldValues.birthdate},
        ${fieldValues.addressLine1},
        ${fieldValues.addressLine2},
        ${fieldValues.addressCity},
        ${fieldValues.addressState},
        ${fieldValues.addressZip},
        ${fieldValues.addressCountry},
        ${fieldValues.githubUrl},
        ${fieldValues.portfolioUrl},
        ${fieldValues.applicationFirstThingDo},
        ${fieldValues.applicationBestPlacePoster},
        ${fieldValues.idvStatus},
        ${rejectionReason},
        ${rejectionReason},
        ${record.id},
        ${createdAt},
        ${syncedAt},
        ${JSON.stringify(payload)},
        ${createdAt},
        NOW()
      )
    `;
    throwIfAborted(options.signal);

    result.inserted += 1;
  }

  throwIfAborted(options.signal);
  await Promise.all(
    Array.from(touchedUserIds, (userId) => syncPermanentRejectionStateForUser(userId)),
  );

  result.matchedUsers = matchedUserIds.size;

  return result;
}
