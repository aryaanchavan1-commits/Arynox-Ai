import { adminListUsers, adminPatchMetadata, refreshSession, passwordSession, similarity, randomPassword, validateDescriptor, MATCH_THRESHOLD } from "@/lib/faces";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const d = body?.d;
    if (!validateDescriptor(d)) {
      return Response.json({ error: "Face scan failed — try again with better light." }, { status: 400 });
    }

    const users = await adminListUsers();
    let best = null;
    let bestScore = 0;
    for (const u of users) {
      const face = u?.user_metadata?.face;
      if (!face || !Array.isArray(face.d)) continue;
      const s = similarity(d, face.d);
      if (s > bestScore) { bestScore = s; best = { user: u, face }; }
    }

    if (!best || bestScore < MATCH_THRESHOLD) {
      return Response.json({
        error: "Face not recognised. Try again with better light, or sign in with email/password. New here? Create an account with your face.",
      }, { status: 404 });
    }

    const u = best.user;
    let session = null;
    try {
      session = await refreshSession(best.face.rt);
    } catch {
      // Stored refresh token expired or rotated away — mint a fresh one via a reset password.
      const newPass = randomPassword();
      await adminPatchMetadata(u.id, {}); // touch to confirm admin rights
      const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
          apikey: process.env.SUPABASE_SECRET_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: newPass }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error("session renewal failed");
      session = await passwordSession(u.email, newPass);
    }
    if (!session?.access_token) throw new Error("Could not create session");

    adminPatchMetadata(u.id, {
      full_name: u.user_metadata?.full_name || u.email?.split("@")[0] || "User",
      face: { v: 1, d: best.face.d, rt: session.refresh_token || "" },
    }).catch(() => {});

    return Response.json({
      access_token: session.access_token,
      user: {
        id: u.id,
        email: u.email || "",
        name: u.user_metadata?.full_name || u.email?.split("@")[0] || "User",
      },
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
