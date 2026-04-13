import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

import sql from "@/lib/database/client";
import { isProduction, requireEnv } from "@/lib/env";

const COOKIE_NAME = "ambassador_token";
const IMPERSONATION_COOKIE_NAME = "ambassador_impersonation";
const IMPERSONATION_COOKIE_MAX_AGE_SECONDS = 43200;
const SECRET = new TextEncoder().encode(requireEnv("JWT_SECRET"));

export type TokenPayload = {
  sub: string;
  email?: string;
  displayName: string;
  slackId?: string;
  isAdmin: boolean;
};

type ImpersonationTokenPayload = {
  type: "impersonation";
  actor: TokenPayload;
  subject: TokenPayload;
  startedAt: string;
};

export type SessionPayload = TokenPayload & {
  impersonator?: TokenPayload;
  impersonationStartedAt?: string;
};

async function signToken(payload: Record<string, unknown>): Promise<string> {
  return signTokenWithExpiry(payload, "30d");
}

async function signTokenWithExpiry(
  payload: Record<string, unknown>,
  expirationTime: string,
): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(SECRET);
}

async function verifyJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function createToken(payload: TokenPayload): Promise<string> {
  return signToken(payload);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  const payload = await verifyJwt(token);
  if (
    !payload ||
    typeof payload.sub !== "string" ||
    typeof payload.displayName !== "string" ||
    typeof payload.isAdmin !== "boolean" ||
    (payload.email !== undefined && typeof payload.email !== "string") ||
    (payload.slackId !== undefined && typeof payload.slackId !== "string")
  ) {
    return null;
  }

  return {
    sub: payload.sub,
    email: payload.email,
    displayName: payload.displayName,
    slackId: payload.slackId,
    isAdmin: payload.isAdmin,
  };
}

export async function createImpersonationToken(payload: {
  actor: TokenPayload;
  subject: TokenPayload;
  startedAt: string;
}): Promise<string> {
  return signTokenWithExpiry(
    {
      type: "impersonation",
      actor: payload.actor,
      subject: payload.subject,
      startedAt: payload.startedAt,
    },
    "12h",
  );
}

export async function verifyImpersonationToken(
  token: string,
): Promise<ImpersonationTokenPayload | null> {
  const payload = await verifyJwt(token);
  const actor = payload?.actor;
  const subject = payload?.subject;

  if (
    !payload ||
    payload.type !== "impersonation" ||
    typeof payload.startedAt !== "string" ||
    typeof actor !== "object" ||
    actor === null ||
    Array.isArray(actor) ||
    typeof actor.sub !== "string" ||
    typeof actor.displayName !== "string" ||
    typeof actor.isAdmin !== "boolean" ||
    (actor.email !== undefined && typeof actor.email !== "string") ||
    (actor.slackId !== undefined && typeof actor.slackId !== "string") ||
    typeof subject !== "object" ||
    subject === null ||
    Array.isArray(subject) ||
    typeof subject.sub !== "string" ||
    typeof subject.displayName !== "string" ||
    typeof subject.isAdmin !== "boolean" ||
    (subject.email !== undefined && typeof subject.email !== "string") ||
    (subject.slackId !== undefined && typeof subject.slackId !== "string")
  ) {
    return null;
  }

  return {
    type: "impersonation",
    actor: {
      sub: actor.sub,
      email: actor.email,
      displayName: actor.displayName,
      slackId: actor.slackId,
      isAdmin: actor.isAdmin,
    },
    subject: {
      sub: subject.sub,
      email: subject.email,
      displayName: subject.displayName,
      slackId: subject.slackId,
      isAdmin: subject.isAdmin,
    },
    startedAt: payload.startedAt,
  };
}

export async function setSession(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 2592000,
  });
}

export async function setImpersonationSession(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: IMPERSONATION_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function getActorSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie) return null;
  return verifyToken(cookie.value);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const actorCookie = cookieStore.get(COOKIE_NAME);
  if (!actorCookie) return null;

  const actorSession = await verifyToken(actorCookie.value);
  if (!actorSession) return null;

  const impersonationCookie = cookieStore.get(IMPERSONATION_COOKIE_NAME);
  if (!impersonationCookie) {
    return actorSession;
  }

  const impersonation = await verifyImpersonationToken(impersonationCookie.value);
  if (!impersonation) {
    return actorSession;
  }

  const actorUser = (await sql<{ is_admin: boolean | null }[]>`
    SELECT is_admin
    FROM users
    WHERE id = ${actorSession.sub}
    LIMIT 1
  `).at(0);

  if (!actorUser?.is_admin || impersonation.actor.sub !== actorSession.sub) {
    return actorSession;
  }

  return {
    ...impersonation.subject,
    impersonator: actorSession,
    impersonationStartedAt: impersonation.startedAt,
  };
}

export async function clearImpersonationSession() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE_NAME);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(IMPERSONATION_COOKIE_NAME);
}
