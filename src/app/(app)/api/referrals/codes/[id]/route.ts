import { isSameOriginRequest } from "@/lib/http";
import {
  requireStardanceReferralSession,
  stardanceReferralErrorResponse,
} from "@/lib/stardance-referrals-http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import {
  archiveStardanceReferralCodeForUser,
  renameStardanceReferralCodeForUser,
  StardanceReferralCodeError,
} from "@/lib/stardance-referrals";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof StardanceReferralCodeError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return stardanceReferralErrorResponse(error, fallback);
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/referrals/codes/[id]">,
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
    const body: unknown = await request.json().catch(() => null);
    const payload: Record<string, unknown> | null =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? Object.fromEntries(Object.entries(body))
        : null;

    const rawLabel = typeof payload?.label === "string" ? payload.label : "";
    const referralCode = await renameStardanceReferralCodeForUser(session.sub, id, rawLabel);
    return Response.json({ referralCode });
  } catch (error) {
    return errorResponse(error, "Failed to rename referral code.");
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/referrals/codes/[id]">,
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
    const referralCode = await archiveStardanceReferralCodeForUser(session.sub, id);
    return Response.json({ referralCode });
  } catch (error) {
    return errorResponse(error, "Failed to archive referral code.");
  }
}
