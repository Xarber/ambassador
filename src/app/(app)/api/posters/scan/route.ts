import {
  isSameOriginRequest,
  jsonError,
  parseProofLocationFromFormData,
  posterErrorResponse,
  requirePosterSession,
  validateImageUpload,
} from "@/lib/posters/http";
import { scanAnyUserPoster } from "@/lib/posters/service";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const session = await requirePosterSession();
    const rateLimit = await checkRateLimit({
      scope: "poster-checker",
      key: getRateLimitKey(session.sub),
      limit: 10_000,
    });

    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const formData = await request.formData();
    const file = formData.get("proof");

    if (!(file instanceof File)) {
      return jsonError("A proof image is required.");
    }

    const fileValidation = validateImageUpload(file);
    if (fileValidation) {
      return jsonError(fileValidation.message, fileValidation.status);
    }

    const location = parseProofLocationFromFormData(formData);

    const result = await scanAnyUserPoster({
      userId: session.sub,
      file,
      ...location,
    });

    return Response.json(result);
  } catch (error) {
    return posterErrorResponse(error, "Failed to scan poster.");
  }
}
