import { getPosterGroupZipForUser } from "@/lib/posters/service";
import { posterErrorResponse, requirePosterSession } from "@/lib/posters/http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/poster-groups/[id]/zip">) {
  try {
    const session = await requirePosterSession();
    const rateLimit = await checkRateLimit({
      scope: "poster-download",
      key: getRateLimitKey(session.sub),
      limit: 1_000,
    });

    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const { id } = await context.params;
    const { group, posters, zip } = await getPosterGroupZipForUser(session.sub, id);
    if (posters.length === 0) {
      return Response.json({ error: "No posters to download." }, { status: 404 });
    }
    const safeName = (group.name ?? `group-${group.id}`).replace(/[^a-z0-9-_]+/gi, "-");

    return new Response(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="posters-${safeName}.zip"`,
      },
    });
  } catch (error) {
    return posterErrorResponse(error, "Failed to generate poster group ZIP.", 404);
  }
}
