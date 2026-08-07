export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

export async function getUserFromToken(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user?.id) return null;
    return {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
    };
  } catch {
    return null;
  }
}

export async function ownerFromRequest(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const user = await getUserFromToken(token);
  return user ? user.id : null;
}
