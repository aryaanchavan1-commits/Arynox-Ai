import { grantPremium, revokePremium, listPremium, listVisitors, clearVisitors, listUsers, blockUser, unblockUser, removeUser, trackUser } from "@/lib/access";
import { verifyAdminSession, cfgList, setCfg, envDump, cfg, isAdminUser, adminCreds } from "@/lib/config";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "@/lib/supabase";

export const runtime = "nodejs";

async function adminFromRequest(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const session = verifyAdminSession(token);
  if (session) return { kind: "user", username: session.username };
  return null;
}

export async function POST(req) {
  try {
    const admin = await adminFromRequest(req);
    if (!admin) return Response.json({ error: "admin only" }, { status: 403 });

    const body = await req.json();
    const action = body?.action;
    const email = String(body?.email || "").trim().toLowerCase();

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
    if (action === "list") return Response.json({ ok: true, list: listPremium() });
    if (action === "visitors") return Response.json({ ok: true, visitors: listVisitors(email, !!body?.all) });
    if (action === "clear_visitors") { clearVisitors(email); return Response.json({ ok: true, result: "Visitor log cleared" }); }

    if (action === "users") return Response.json({ ok: true, users: listUsers() });
    if (action === "block") {
      if (!email) return Response.json({ error: "email required" }, { status: 400 });
      trackUser(email, body?.name || email);
      blockUser(email);
      return Response.json({ ok: true, result: `🔒 ${email} is blocked`, users: listUsers() });
    }
    if (action === "unblock") {
      unblockUser(email);
      return Response.json({ ok: true, result: `Unblocked ${email}`, users: listUsers() });
    }
    if (action === "remove") {
      if (!email) return Response.json({ error: "email required" }, { status: 400 });
      let removedFromSupabase = false;
      if (SUPABASE_SECRET_KEY && SUPABASE_URL) {
        try {
          const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(email)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, apikey: SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
            signal: AbortSignal.timeout(15000),
          });
          removedFromSupabase = r.ok || r.status === 404;
        } catch {}
      }
      removeUser(email);
      return Response.json({
        ok: true,
        result: `🗑 ${email} removed${removedFromSupabase ? " (also deleted from Supabase)" : ""}${SUPABASE_SECRET_KEY ? "" : " — add SUPABASE_SECRET_KEY to also delete the account itself"}`,
        users: listUsers(),
      });
    }

    if (action === "keys") return Response.json({ ok: true, keys: cfgList() });
    if (action === "keys_set") {
      const entries = body?.keys;
      if (!Array.isArray(entries)) return Response.json({ error: "keys array required" }, { status: 400 });
      for (const e of entries) setCfg(e?.key, e?.value);
      return Response.json({ ok: true, result: `Saved ${entries.length} setting(s) — active immediately`, keys: cfgList() });
    }
    if (action === "env") return Response.json({ ok: true, env: envDump() });

    if (action === "stats") {
      const all = listUsers();
      const allVisitors = listVisitors("", true);
      return Response.json({
        ok: true,
        stats: {
          users: all.length,
          premium: all.filter((u) => u.premium > 0).length,
          blocked: all.filter((u) => u.blocked).length,
          visitors: allVisitors.length,
          grants: listPremium().length,
          providers: cfgList().filter((k) => k.value).map((k) => k.key),
          uptime: Math.round(process.uptime()),
          now: Date.now(),
        },
      });
    }
    if (action === "change_pass") {
      const current = String(body?.current || "");
      const next = String(body?.next || "");
      if (next.length < 8) return Response.json({ error: "new password must be at least 8 characters" }, { status: 400 });
      const creds = adminCreds();
      if (!isAdminUser(creds.username, current)) {
        return Response.json({ error: "current password is wrong" }, { status: 401 });
      }
      setCfg("ADMIN_PASSWORD", next);
      return Response.json({ ok: true, result: "Admin password updated — set ADMIN_PASSWORD in Vercel/Render to make it permanent" });
    }

    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
