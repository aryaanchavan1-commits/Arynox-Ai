import { SUPABASE_URL, SUPABASE_SECRET_KEY, getUserFromToken } from "@/lib/supabase";

export const runtime = "nodejs";

const LABELS = {
  chat: "Chat messages",
  images: "Images created",
  code: "Code runs",
  live_vision: "Live vision asks",
  whatsapp: "WhatsApp messages",
  email: "Emails sent",
  github: "GitHub calls",
  web: "Web searches",
};

const headers = () => ({
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  apikey: SUPABASE_SECRET_KEY,
  "Content-Type": "application/json",
});

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const user = token ? await getUserFromToken(token) : null;
  if (!user) return Response.json({ error: "sign in required" }, { status: 401 });
  const usage = user.usage || {};
  const today = new Date().toISOString().slice(0, 10);
  return Response.json({ usage, labels: LABELS, today });
}

export async function POST(req) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const user = token ? await getUserFromToken(token) : null;
    if (!user) return Response.json({ error: "sign in required" }, { status: 401 });
    const body = await req.json();
    const action = String(body.action || "").replace(/[^a-z_]/g, "");
    if (!action || !LABELS[action]) return Response.json({ error: "unknown action" }, { status: 400 });

    const usage = user.usage || {};
    const today = new Date().toISOString().slice(0, 10);
    const day = usage.days || {};
    day[today] = day[today] || {};
    day[today][action] = (day[today][action] || 0) + 1;
    const total = {
      chat: (usage.chat || 0) + (action === "chat" ? 1 : 0),
      images: (usage.images || 0) + (action === "images" ? 1 : 0),
      code: (usage.code || 0) + (action === "code" ? 1 : 0),
      live_vision: (usage.live_vision || 0) + (action === "live_vision" ? 1 : 0),
      whatsapp: (usage.whatsapp || 0) + (action === "whatsapp" ? 1 : 0),
      email: (usage.email || 0) + (action === "email" ? 1 : 0),
      github: (usage.github || 0) + (action === "github" ? 1 : 0),
      web: (usage.web || 0) + (action === "web" ? 1 : 0),
    };
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ user_metadata: { ...user.meta, usage: { ...usage, days: day, ...total } } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return Response.json({ error: "could not save usage" }, { status: 500 });
    return Response.json({ ok: true, total });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 200) }, { status: 500 });
  }
}
