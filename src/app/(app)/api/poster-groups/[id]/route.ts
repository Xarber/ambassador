import {
  addPostersToGroupForUser,
  deletePosterGroupForUser,
  getPosterGroupForUserOrThrow,
} from "@/lib/posters/service";
import { isSameOriginRequest, posterErrorResponse, requirePosterSession } from "@/lib/posters/http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/poster-groups/[id]">) {
  try {
    const session = await requirePosterSession();
    const { id } = await context.params;
    const data = await getPosterGroupForUserOrThrow(session.sub, id);
    return Response.json(data);
  } catch (error) {
    return posterErrorResponse(error, "Failed to load poster group.", 404);
  }
}

export async function POST(request: Request, context: RouteContext<"/api/poster-groups/[id]">) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const session = await requirePosterSession();
    const rateLimit = await checkRateLimit({
      scope: "poster-create",
      key: getRateLimitKey(session.sub),
      limit: 1_000,
    });

    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const { id } = await context.params;
    const body = await request.json();
    const payload: Record<string, unknown> | null =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? Object.fromEntries(Object.entries(body))
        : null;
    const result = await addPostersToGroupForUser({
      userId: session.sub,
      groupId: id,
      count: typeof payload?.count === "number" && Number.isFinite(payload.count) ? payload.count : 1,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return posterErrorResponse(error, "Failed to add posters to group.", 400);
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/poster-groups/[id]">) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const session = await requirePosterSession();
    const rateLimit = await checkRateLimit({
      scope: "poster-write",
      key: getRateLimitKey(session.sub),
      limit: 1_000,
    });

    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const { id } = await context.params;
    const result = await deletePosterGroupForUser(session.sub, id);
    return Response.json(result);
  } catch (error) {
    return posterErrorResponse(error, "Failed to delete poster group.", 400);
  }
}
