import { getUserFromToken } from "@/lib/supabase";
import { isAdminEmail, grantPremium, revokePremium, listPremium, listVisitors, clearVisitors } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const user = token ? await getUserFromToken(token) : null;
    if (!isAdminEmail(user?.email)) return Response.json({ error: "admin only" }, { status: 403 });

    const body = await req.json();
    const action = body?.action;
    const email = String(body?.email || "").trim();

    if (action === "grant") {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "valid email required" }, { status: 400 });
      const days = Math.max(1, Math.min(3650, Number(body?.days) || 30));
      const res = grantPremium(email, days);
      return Response.json({ ok: true, result: `💎 Pro granted to ${res.email}`, until: res.until, list: listPremium() });
    }
    if (action === "revoke") {
      revokePremium(email);
      return Response.json({ ok: true, result: `Pro removed for ${email}`, list: listPremium() });
    }
    if (action === "list") {
      return Response.json({ ok: true, list: listPremium() });
    }
    if (action === "visitors") {
      const all = !!body?.all;
      return Response.json({ ok: true, visitors: listVisitors(user.email, all) });
    }
    if (action === "clear_visitors") {
      clearVisitors(user.email);
      return Response.json({ ok: true, result: "Visitor log cleared" });
    }
    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
