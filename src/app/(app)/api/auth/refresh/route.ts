import { redirect } from "next/navigation";

import { getSafeRedirectPath } from "@/lib/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = getSafeRedirectPath(url.searchParams.get("next"), "/settings");

  redirect(`/api/auth/login?next=${encodeURIComponent(nextPath)}`);
}
