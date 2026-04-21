import {
  isSameOriginRequest,
  jsonError,
  posterErrorResponse,
  requirePosterSession,
  validateImageUpload,
} from "@/lib/posters/http";
import { readQrCodesFromImageBuffer } from "@/lib/posters/qr";
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
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("An image file is required.");
    }

    const fileValidation = validateImageUpload(file);
    if (fileValidation) {
      return jsonError(fileValidation.message, fileValidation.status);
    }

    const results = await readQrCodesFromImageBuffer(Buffer.from(await file.arrayBuffer()));
    return Response.json({ results, count: results.length });
  } catch (error) {
    return posterErrorResponse(error, "Failed to read QR codes.");
  }
}
