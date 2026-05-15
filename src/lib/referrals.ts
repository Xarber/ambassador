import sql from "@/lib/database/client";

export type ReferralLinkRow = {
  id: string;
  user_id: string;
  code: string;
  name: string;
  kind: "primary" | "secondary";
  created_at: Date;
  updated_at: Date;
};

export class ReferralLinkError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ReferralLinkError";
  }
}

async function generateReferralCode() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const code = `AMB-${Array.from(bytes, (byte) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789"[byte % 35]).join("")}`;
    const existing = (await sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM referral_links WHERE code = ${code}
        UNION ALL
        SELECT 1 FROM posters WHERE referral_code = ${code}
      ) AS exists
    `).at(0);

    if (existing?.exists !== true) {
      return code;
    }
  }

  throw new Error("Failed to generate a unique referral code.");
}

export async function createDefaultReferralLinkForUser(userId: string) {
  const existing = (await sql<ReferralLinkRow[]>`
    SELECT *
    FROM referral_links
    WHERE user_id = ${userId} AND kind = 'primary'
    LIMIT 1
  `).at(0);

  if (existing !== undefined) {
    return existing;
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const [created] = await sql<ReferralLinkRow[]>`
      INSERT INTO referral_links (id, user_id, code, name, kind)
      VALUES (${crypto.randomUUID()}, ${userId}, ${await generateReferralCode()}, 'Default', 'primary')
      ON CONFLICT DO NOTHING
      RETURNING *
    `;

    if (created !== undefined) {
      return created;
    }

    const raced = (await sql<ReferralLinkRow[]>`
      SELECT *
      FROM referral_links
      WHERE user_id = ${userId} AND kind = 'primary'
      LIMIT 1
    `).at(0);

    if (raced !== undefined) {
      return raced;
    }
  }

  throw new Error("Failed to create a default referral link.");
}

export async function listReferralLinksForUser(userId: string) {
  await createDefaultReferralLinkForUser(userId);

  return sql<ReferralLinkRow[]>`
    SELECT *
    FROM referral_links
    WHERE user_id = ${userId}
    ORDER BY
      CASE WHEN kind = 'primary' THEN 0 ELSE 1 END,
      created_at ASC,
      id ASC
  `;
}

export async function createSecondaryReferralLinkForUser(userId: string, rawName: string) {
  const name = rawName.trim();

  if (name === "") {
    throw new ReferralLinkError("Referral link name is required.", 400);
  }

  if (name.length > 80) {
    throw new ReferralLinkError("Referral link name must be 80 characters or fewer.", 400);
  }

  await createDefaultReferralLinkForUser(userId);

  const duplicateName = (await sql<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1
      FROM referral_links
      WHERE user_id = ${userId}
        AND LOWER(name) = LOWER(${name})
    ) AS exists
  `).at(0);

  if (duplicateName?.exists === true) {
    throw new ReferralLinkError("A referral link with that name already exists.", 409);
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const [created] = await sql<ReferralLinkRow[]>`
      INSERT INTO referral_links (id, user_id, code, name, kind)
      VALUES (${crypto.randomUUID()}, ${userId}, ${await generateReferralCode()}, ${name}, 'secondary')
      ON CONFLICT DO NOTHING
      RETURNING *
    `;

    if (created !== undefined) {
      return created;
    }

    const raced = (await sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1
        FROM referral_links
        WHERE user_id = ${userId}
          AND LOWER(name) = LOWER(${name})
      ) AS exists
    `).at(0);

    if (raced?.exists === true) {
      throw new ReferralLinkError("A referral link with that name already exists.", 409);
    }
  }

  throw new Error("Failed to create a referral link.");
}

export async function findReferralLinkByCode(code: string) {
  const link = (await sql<ReferralLinkRow[]>`
    SELECT *
    FROM referral_links
    WHERE code = ${code.trim().toUpperCase()}
    LIMIT 1
  `).at(0);

  return link ?? null;
}
