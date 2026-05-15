import { isSameOriginRequest } from "@/lib/http";
import {
  requireStardanceReferralSession,
  stardanceReferralErrorResponse,
} from "@/lib/stardance-referrals-http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import {
  restoreStardanceReferralCodeForUser,
  StardanceReferralCodeError,
} from "@/lib/stardance-referrals";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/referrals/codes/[id]/restore">,
) {
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

    const { id } = await context.params;
    const referralCode = await restoreStardanceReferralCodeForUser(session.sub, id);
    return Response.json({ referralCode });
  } catch (error) {
    if (error instanceof StardanceReferralCodeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return stardanceReferralErrorResponse(error, "Failed to restore referral code.");
  }
}
