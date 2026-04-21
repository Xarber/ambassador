import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { optionalEnv } from "@/lib/env";

export function isSuperuserConfigured() {
  return optionalEnv("SUPERUSER_PASSWORD") !== null;
}

// SAFETY: don't complain, it's a really secure 32 character string that cannot be bruteforced in prod!
export function verifySuperuserPassword(value: FormDataEntryValue | null) {
  const expectedPassword = optionalEnv("SUPERUSER_PASSWORD");
  const providedPassword = typeof value === "string" ? value : "";

  const expectedHash = createHash("sha256")
    .update(expectedPassword ?? "missing-superuser-password")
    .digest();
  const providedHash = createHash("sha256")
    .update(providedPassword || "missing-superuser-password")
    .digest();
  const passwordsMatch = timingSafeEqual(expectedHash, providedHash);

  return expectedPassword !== null &&
    providedPassword !== "" &&
    passwordsMatch;
}
