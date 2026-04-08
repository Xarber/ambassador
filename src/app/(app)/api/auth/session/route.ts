import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return Response.json({ isAuthenticated: false, isAdmin: false });
  }

  return Response.json({
    isAuthenticated: true,
    isAdmin: Boolean(session.isAdmin),
  });
}
