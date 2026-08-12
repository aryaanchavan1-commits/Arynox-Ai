import { isAdminUser, createAdminSession, adminCreds } from "@/lib/config";

export const runtime = "nodejs";

const attempts = new Map(); // ip -> {count, at}

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const a = attempts.get(ip);
    if (a && Date.now() - a.at < 10 * 60 * 1000 && a.count >= 10) {
      return Response.json({ error: "Too many attempts — wait 10 minutes." }, { status: 429 });
    }
    const body = await req.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    if (!username || !password) return Response.json({ error: "Enter username and password." }, { status: 400 });

    if (isAdminUser(username, password)) {
      attempts.delete(ip);
      const token = createAdminSession(username);
      return Response.json({ ok: true, token, username });
    }
    attempts.set(ip, { count: (a?.count || 0) + 1, at: a?.at || Date.now() });
    return Response.json({ error: "Wrong username or password." }, { status: 401 });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
