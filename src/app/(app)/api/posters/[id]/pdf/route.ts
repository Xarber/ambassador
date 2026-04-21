import { getPosterPdfForUser } from "@/lib/posters/service";
import { posterErrorResponse, requirePosterSession } from "@/lib/posters/http";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/posters/[id]/pdf">) {
  try {
    const session = await requirePosterSession();
    const { id } = await context.params;
    const { poster, pdf } = await getPosterPdfForUser(session.sub, id);
    const safeReferralCode = poster.referral_code.replace(/[^a-zA-Z0-9_-]/g, "");
    const filename = safeReferralCode !== "" ? `poster-${safeReferralCode}.pdf` : "poster.pdf";

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return posterErrorResponse(error, "Failed to generate poster PDF.", 404);
  }
}
