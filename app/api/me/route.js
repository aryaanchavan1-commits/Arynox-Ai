import { getUserFromToken } from "@/lib/supabase";
import { isPremium, isBlocked, trackUser } from "@/lib/access";
import { verifyAdminSession } from "@/lib/config";

export const runtime = "nodejs";

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const session = verifyAdminSession(token);
  if (session) {
    return Response.json({ authed: true, isAdmin: true, admin: true, username: session.username, email: "", premium: true, premiumUntil: Date.now() + 3650 * 24 * 60 * 60 * 1000, blocked: false });
  }
  const user = token ? await getUserFromToken(token) : null;
  const email = user?.email || "";
  if (email) {
    trackUser(email, user.name);
  }
  const until = isPremium(email);
  return Response.json({
    email,
    isAdmin: false,
    premium: until > 0,
    premiumUntil: until > 0 ? until : 0,
    authed: !!user,
    blocked: isBlocked(email),
  });
}
