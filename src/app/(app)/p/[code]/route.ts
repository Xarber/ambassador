import { resolvePublicPosterScan } from "@/lib/posters/service";
import { checkRateLimit, getIpRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/p/[code]">) {
  const rateLimit = await checkRateLimit({
    scope: "poster-redirect",
    key: getIpRateLimitKey(request),
    limit: 5_000,
  });

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const { code } = await context.params;
  const resolved = await resolvePublicPosterScan(code);

  if (!resolved) {
    return Response.redirect(process.env.CURRENT_DOMAIN ?? "http://localhost:7171", 302);
  }

  return Response.redirect(resolved.redirectUrl, 302);
}
