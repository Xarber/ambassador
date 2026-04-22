import sql from "@/lib/database/client";

export const SAFEGUARD_KEYS = {
  onboardingEnabled: "onboarding_enabled",
  shirtOrderingEnabled: "shirt_ordering_enabled",
} as const;

export type SafeguardKey = (typeof SAFEGUARD_KEYS)[keyof typeof SAFEGUARD_KEYS];

export type Safeguards = {
  onboardingEnabled: boolean;
  shirtOrderingEnabled: boolean;
};

type SafeguardRow = {
  key: string;
  enabled: boolean | null;
  updated_at: string | null;
  updated_by_user_id: string | null;
};

export type SafeguardState = {
  key: SafeguardKey;
  enabled: boolean;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

const DEFAULT_SAFEGUARDS: Safeguards = {
  onboardingEnabled: true,
  shirtOrderingEnabled: true,
};

export function isSafeguardKey(value: unknown): value is SafeguardKey {
  return (
    value === SAFEGUARD_KEYS.onboardingEnabled ||
    value === SAFEGUARD_KEYS.shirtOrderingEnabled
  );
}

export async function getSafeguards(): Promise<Safeguards> {
  const rows = await listSafeguardStates();

  return rows.reduce<Safeguards>((state, row) => {
    if (row.key === SAFEGUARD_KEYS.onboardingEnabled) {
      return { ...state, onboardingEnabled: row.enabled };
    }

    if (row.key === SAFEGUARD_KEYS.shirtOrderingEnabled) {
      return { ...state, shirtOrderingEnabled: row.enabled };
    }

    return state;
  }, DEFAULT_SAFEGUARDS);
}

export async function listSafeguardStates(): Promise<SafeguardState[]> {
  const rows = await sql<SafeguardRow[]>`
    SELECT key, enabled, updated_at, updated_by_user_id
    FROM app_safeguards
    WHERE key = ANY(${SAFEGUARD_KEY_LIST}::text[])
    ORDER BY key ASC
  `;
  const rowByKey = new Map(rows.map((row) => [row.key, row]));

  return [
    toSafeguardState(SAFEGUARD_KEYS.onboardingEnabled, rowByKey.get(SAFEGUARD_KEYS.onboardingEnabled)),
    toSafeguardState(SAFEGUARD_KEYS.shirtOrderingEnabled, rowByKey.get(SAFEGUARD_KEYS.shirtOrderingEnabled)),
  ];
}

export async function setSafeguard(input: {
  key: SafeguardKey;
  enabled: boolean;
  updatedByUserId: string | null;
}) {
  const row = (await sql<SafeguardRow[]>`
    INSERT INTO app_safeguards (key, enabled, updated_by_user_id)
    VALUES (${input.key}, ${input.enabled}, ${input.updatedByUserId})
    ON CONFLICT (key) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
    RETURNING key, enabled, updated_at, updated_by_user_id
  `).at(0);

  return toSafeguardState(input.key, row);
}

const SAFEGUARD_KEY_LIST = [
  SAFEGUARD_KEYS.onboardingEnabled,
  SAFEGUARD_KEYS.shirtOrderingEnabled,
];

function getDefaultEnabled(key: SafeguardKey) {
  if (key === SAFEGUARD_KEYS.onboardingEnabled) {
    return DEFAULT_SAFEGUARDS.onboardingEnabled;
  }

  return DEFAULT_SAFEGUARDS.shirtOrderingEnabled;
}

function toSafeguardState(
  key: SafeguardKey,
  row: SafeguardRow | undefined,
): SafeguardState {
  return {
    key,
    enabled: row?.enabled ?? getDefaultEnabled(key),
    updatedAt: row?.updated_at ?? null,
    updatedByUserId: row?.updated_by_user_id ?? null,
  };
}
