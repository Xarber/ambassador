import { isSameOriginRequest } from "@/lib/http";
import {
  requireStardanceReferralSession,
  stardanceReferralErrorResponse,
} from "@/lib/stardance-referrals-http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import {
  createStardanceReferralCodeForUser,
  listStardanceReferralCodesForUser,
  StardanceReferralCodeError,
} from "@/lib/stardance-referrals";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireStardanceReferralSession();
    const codes = await listStardanceReferralCodesForUser(session.sub);
    return Response.json({ codes });
  } catch (error) {
    return stardanceReferralErrorResponse(error, "Failed to load referral codes.");
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const session = await requireStardanceReferralSession();
    const rateLimit = await checkRateLimit({
      scope: "stardance-referral-code-write",
      key: getRateLimitKey(session.sub),
      limit: 500,
    });

    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const body: unknown = await request.json().catch(() => null);
    const payload: Record<string, unknown> | null =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? Object.fromEntries(Object.entries(body))
        : null;

    const referralCode = await createStardanceReferralCodeForUser(
      session.sub,
      typeof payload?.label === "string" ? payload.label : "",
    );

    return Response.json({ referralCode }, { status: 201 });
  } catch (error) {
    if (error instanceof StardanceReferralCodeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return stardanceReferralErrorResponse(error, "Failed to create referral code.");
  }
}
