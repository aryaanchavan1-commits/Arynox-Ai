import { adminCreateUser, passwordSession, adminPatchMetadata, randomPassword, validateDescriptor } from "@/lib/faces";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const d = body?.d;
    if (!validateDescriptor(d)) {
      return Response.json({ error: "Face scan failed — try again with better light." }, { status: 400 });
    }
    const name = String(body?.name || "").trim().slice(0, 40);
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 120);
    const finalEmail = email || `face_${Math.random().toString(36).slice(2, 10)}@arynox.ai`;

    const password = randomPassword();
    let user;
    try {
      user = await adminCreateUser({ email: finalEmail, password, fullName: name });
    } catch (err) {
      if (/already|registered|duplicate/i.test(String(err?.message || ""))) {
        return Response.json({ error: "This email is already registered — sign in with it or use Google instead." }, { status: 409 });
      }
      throw err;
    }

    const session = await passwordSession(finalEmail, password);
    if (!session?.access_token) throw new Error("Could not create session");

    await adminPatchMetadata(user.id, {
      full_name: name || finalEmail.split("@")[0],
      face: { v: 1, d, rt: session.refresh_token || "" },
    }).catch(() => {});

    return Response.json({
      access_token: session.access_token,
      user: { id: user.id, email: user.email, name: name || finalEmail.split("@")[0] },
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
