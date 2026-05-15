import { getPosterGroupPdfForUser } from "@/lib/posters/service";
import { posterErrorResponse, requirePosterSession } from "@/lib/posters/http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/poster-groups/[id]/pdf">) {
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
    const { group, pdf } = await getPosterGroupPdfForUser(session.sub, id);
    const safeName = (group.name ?? `group-${group.id}`).replace(/[^a-z0-9-_]+/gi, "-");

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="posters-${safeName}.pdf"`,
      },
    });
  } catch (error) {
    return posterErrorResponse(error, "Failed to generate poster group PDF.", 404);
  }
}
