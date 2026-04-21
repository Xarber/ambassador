import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { getActorSession } from "@/lib/session";
import { isSuperuserConfigured, verifySuperuserPassword } from "@/lib/superuser";

type AdminMutationResult =
  | {
      ok: true;
      previousIsAdmin: boolean | null;
    }
  | {
      ok: false;
      error: "forbidden" | "not_found";
      status: 403 | 404;
    };

function redirectWithSuperuserStatus(
  request: Request,
  formData: FormData,
  id: string,
  status: string,
) {
  const url = getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/users/${id}`);
  url.searchParams.set("superuser", status);
  return Response.redirect(url, 303);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getActorSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = await checkRateLimit({
    scope: "superuser-password",
    key: getRateLimitKey(session.sub),
    limit: 200,
  });

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const { id } = await params;
  const formData = await request.formData();

  if (!isSuperuserConfigured()) {
    return redirectWithSuperuserStatus(request, formData, id, "missing");
  }

  const existingUser = (await sql<{ id: string; is_admin: boolean | null }[]>`
    SELECT id, is_admin
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `).at(0) ?? null;

  if (existingUser === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (!verifySuperuserPassword(formData.get("superuserPassword"))) {
    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: id,
      action: "user_admin_password_rejected",
      metadata: {
        attemptedAction: "promote_admin",
      },
    });
    revalidatePath("/admin/audit-log");

    return redirectWithSuperuserStatus(request, formData, id, "invalid");
  }

  const result = await sql.begin(async (transaction): Promise<AdminMutationResult> => {
    const lockedUsers = await transaction<{ id: string; is_admin: boolean | null }[]>`
      SELECT id, is_admin
      FROM users
      WHERE id = ${session.sub} OR id = ${id}
      ORDER BY id
      FOR UPDATE
    `;
    const actor = lockedUsers.find((user) => user.id === session.sub) ?? null;
    const target = lockedUsers.find((user) => user.id === id) ?? null;

    if (actor?.is_admin !== true) {
      return { ok: false, error: "forbidden", status: 403 };
    }

    if (target === null) {
      return { ok: false, error: "not_found", status: 404 };
    }

    await transaction`
      UPDATE users
      SET is_admin = TRUE,
          updated_at = NOW()
      WHERE id = ${id}
    `;

    return { ok: true, previousIsAdmin: target.is_admin };
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  if (result.previousIsAdmin !== true) {
    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: id,
      action: "user_promoted_to_admin",
      metadata: {
        previousIsAdmin: Boolean(result.previousIsAdmin),
        nextIsAdmin: true,
      },
    });
  }

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit-log");

  return Response.redirect(getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/users/${id}`), 303);
}
