import { getUserFromToken } from "@/lib/supabase";
import { isAdminEmail, claimAdmin, isPremium } from "@/lib/access";

export const runtime = "nodejs";

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const user = token ? await getUserFromToken(token) : null;
  const email = user?.email || "";
  if (email) claimAdmin(email);
  const until = isPremium(email);
  return Response.json({
    email,
    isAdmin: isAdminEmail(email),
    premium: until > 0,
    premiumUntil: until > 0 ? until : 0,
    authed: !!user,
  });
}
