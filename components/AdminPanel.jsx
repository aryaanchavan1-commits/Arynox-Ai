"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const PROVIDER_LABELS = {
  GROQ_API_KEY: "Groq",
  CEREBRAS_API_KEY: "Cerebras",
  OPENCODE_API_KEY: "OpenCode Zen",
  EXA_API_KEY: "Exa Search",
  SARVAM_API_KEY: "Sarvam TTS",
  HEDRA_API_KEY: "Hedra Video",
  WHATSAPP_TOKEN: "WhatsApp",
  GITHUB_TOKEN: "GitHub",
  GMAIL_USER: "Gmail",
  SUPABASE_URL: "Supabase",
};

const SECRET_KEYS = /PASS|TOKEN|KEY|SECRET/;

export default function AdminPanel({ headers, onToast }) {
  const [section, setSection] = useState("overview");
  const [busy, setBusy] = useState(false);

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [grants, setGrants] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [keys, setKeys] = useState([]);
  const [envReady, setEnvReady] = useState(false);

  // grants form
  const [grantEmail, setGrantEmail] = useState("");
  const [grantDays, setGrantDays] = useState(30);

  // users search
  const [userQuery, setUserQuery] = useState("");

  // keys
  const [keysBusy, setKeysBusy] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  // password
  const [passCur, setPassCur] = useState("");
  const [passNew, setPassNew] = useState("");

  const act = useCallback(
    async (action, extra = {}) => {
      setBusy(true);
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers() },
          body: JSON.stringify({ action, ...extra }),
          signal: AbortSignal.timeout(30000),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Request failed");
        if (d.stats) setStats(d.stats);
        if (d.users) setUsers(d.users);
        if (d.list) setGrants(d.list);
        if (d.keys) setKeys(d.keys);
        if (d.visitors) setVisitors(d.visitors);
        if (d.result) onToast?.(d.result);
        return d;
      } catch (err) {
        onToast?.("⚠️ " + err.message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [headers, onToast]
  );

  const refresh = useCallback(async () => {
    await Promise.all([act("stats"), act("users"), act("list"), act("keys")]);
  }, [act]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q));
  }, [users, userQuery]);

  const providerHealth = useMemo(() => {
    const labels = PROVIDER_LABELS;
    return keys.filter((k) => labels[k.key]).map((k) => ({ key: k.key, label: labels[k.key], set: !!k.value }));
  }, [keys]);

  const saveKeys = async () => {
    setKeysBusy(true);
    try {
      const d = await act("keys_set", { keys: keys.map((k) => ({ key: k.key, value: k.value })) });
      if (d) onToast?.(d.result || "Settings saved");
    } finally {
      setKeysBusy(false);
    }
  };

  const downloadEnv = async () => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ action: "env" }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "failed");
      const url = URL.createObjectURL(new Blob([d.env], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = ".env";
      a.click();
      URL.revokeObjectURL(url);
      setEnvReady(true);
      onToast?.("📄 .env downloaded — paste into Vercel/Render to make permanent");
    } catch (err) {
      onToast?.("⚠️ " + err.message);
    }
  };

  const changePass = async () => {
    if (passNew.length < 8) {
      onToast?.("⚠️ new password must be at least 8 characters");
      return;
    }
    const d = await act("change_pass", { current: passCur, next: passNew });
    if (d) {
      setPassCur("");
      setPassNew("");
    }
  };

  const s = (label) => (
    <button className={`ad-nav ${section === label ? "ad-on" : ""}`} onClick={() => setSection(label)}>
      {label}
    </button>
  );

  const statCard = (icon, label, value, sub) => (
    <div className="ad-stat">
      <div className="ad-stat-icon">{icon}</div>
      <div className="ad-stat-info">
        <b>{value ?? "—"}</b>
        <span>{label}</span>
        {sub && <em>{sub}</em>}
      </div>
    </div>
  );

  return (
    <div className="ad-dash">
      <aside className="ad-side">
        <div className="ad-side-brand">
          <span className="ad-logo">🛡</span>
          <div>
            <b>Arynox Admin</b>
            <em>Control center</em>
          </div>
        </div>
        <nav className="ad-nav-list">
          {s("Overview")}
          {s("Users")}
          {s("Access")}
          {s("Settings")}
        </nav>
        <div className="ad-side-foot">
          <button className="chip" onClick={() => onToast?.("Dashboards refresh live — data loads from the running instance")} disabled={busy}>
            {busy ? "Refreshing…" : "↺ Refresh"}
          </button>
        </div>
      </aside>

      <div className="ad-main">
        {section === "Overview" && (
          <>
            <div className="ad-head">
              <h2>Overview</h2>
              <p>Real-time health of your Arynox AI instance</p>
            </div>
            <div className="ad-stats">
              {statCard("👥", "Users", stats?.users, "accounts seen")}
              {statCard("💎", "Premium", stats?.premium, "active grants")}
              {statCard("🔒", "Blocked", stats?.blocked, "accounts locked")}
              {statCard("👀", "Visitors", stats?.visitors, "kiosk visits")}
              {statCard("🟢", "Uptime", stats?.uptime ? `${Math.floor(stats.uptime / 60)}m` : "—", stats?.uptime > 3600 ? `${Math.round(stats.uptime / 3600)}h` : "since start")}
            </div>

            <div className="ad-cards">
              <div className="ad-card">
                <div className="ad-card-title">🔌 Provider connections</div>
                <div className="ad-prov-list">
                  {providerHealth.length === 0 && <p className="auto-note">Fetching…</p>}
                  {providerHealth.map((p) => (
                    <div className="ad-prov" key={p.key}>
                      <span className={`ad-dot ${p.set ? "ok" : "miss"}`} />
                      <b>{p.label}</b>
                      <em>{p.set ? "Configured" : "Key missing"}</em>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ad-card">
                <div className="ad-card-title">🗂 Storage</div>
                <p className="auto-note" style={{ marginBottom: 8 }}>
                  Users, grants, blocked accounts and visitor logs live in this instance's memory and in Supabase when configured.
                </p>
                <div className="ad-prov-list">
                  <div className="ad-prov">
                    <span className={`ad-dot ${keys.find((k) => k.key === "SUPABASE_URL")?.value ? "ok" : "miss"}`} />
                    <b>Supabase</b>
                    <em>{keys.find((k) => k.key === "SUPABASE_URL")?.value ? "Connected" : "Not configured"}</em>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {section === "Users" && (
          <>
            <div className="ad-head">
              <h2>Users</h2>
              <p>Everyone who signed in to this instance</p>
            </div>
            <div className="ad-toolbar">
              <input className="auto-input" placeholder="🔍 Search by name or email…" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
              <span className="ad-count">{filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}</span>
            </div>
            <div className="ad-list">
              {filteredUsers.length === 0 && <div className="detect-empty">No users yet — when people sign in they appear here automatically.</div>}
              {filteredUsers.map((u) => (
                <div className="ad-user" key={u.email}>
                  <div className="ad-user-main">
                    <b>{u.name || u.email}</b>
                    <span className="ad-user-mail">{u.email}</span>
                    <span className="ad-user-meta">last seen {new Date(u.lastSeen).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="ad-user-badges">
                    {u.premium > 0 && <span className="badge badge-pro">💎 {Math.ceil((u.premium - Date.now()) / 86400000)}d</span>}
                    {u.blocked && <span className="badge badge-block">🔒 blocked</span>}
                  </div>
                  <div className="ad-user-actions">
                    <button className="chip" disabled={busy} onClick={() => act("grant", { email: u.email, days: 30 })}>💎 30d</button>
                    {u.blocked ? (
                      <button className="chip" disabled={busy} onClick={() => act("unblock", { email: u.email })}>🔓 Unblock</button>
                    ) : (
                      <button className="chip cam-off" disabled={busy} onClick={() => act("block", { email: u.email, name: u.name })}>🔒 Block</button>
                    )}
                    <button
                      className="icon-btn danger"
                      title="Remove user"
                      disabled={busy}
                      onClick={async () => {
                        if (confirm(`Remove ${u.email} completely? This deletes their account and access.`)) await act("remove", { email: u.email });
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="auto-note">Block = cannot chat or build until unblocked. Remove = account deleted (needs SUPABASE_SECRET_KEY for full deletion) + premium revoked.</p>
          </>
        )}

        {section === "Access" && (
          <>
            <div className="ad-head">
              <h2>Access</h2>
              <p>Premium grants and kiosk visitors</p>
            </div>
            <div className="ad-card">
              <div className="ad-card-title">💎 Grant Pro access</div>
              <div className="ad-row">
                <input className="auto-input" placeholder="person@email.com" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} />
                <input className="auto-input ad-days" type="number" min="1" max="3650" value={grantDays} onChange={(e) => setGrantDays(Number(e.target.value) || 30)} title="Days of access" />
                <button
                  className="chip"
                  disabled={busy}
                  onClick={async () => {
                    if (!grantEmail.includes("@")) {
                      onToast?.("⚠️ enter the person's email");
                      return;
                    }
                    const d = await act("grant", { email: grantEmail.trim(), days: grantDays });
                    if (d) setGrantEmail("");
                  }}
                >
                  {busy ? "Granting…" : "💎 Grant"}
                </button>
              </div>
              <div className="ad-list">
                {grants.length === 0 && <div className="detect-empty">No active grants yet.</div>}
                {grants.map((p) => (
                  <div className="ad-grant" key={p.email}>
                    <span>{p.email}</span>
                    <em>until {new Date(p.until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</em>
                    <button className="icon-btn" title="Revoke" disabled={busy} onClick={() => act("revoke", { email: p.email })}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="ad-card">
              <div className="ad-card-title">📋 Visitors</div>
              <div className="ad-row">
                <button className="chip" disabled={busy} onClick={async () => {
                  const d = await act("visitors", { all: true });
                  if (d?.visitors) setVisitors(d.visitors);
                }}>↺ Load visitors</button>
                <button className="chip cam-off" disabled={busy} onClick={async () => {
                  if (confirm("Clear the visitor log?")) {
                    const d = await act("clear_visitors");
                    if (d) setVisitors([]);
                  }
                }}>🗑 Clear log</button>
              </div>
              <div className="ad-list">
                {visitors.length === 0 && <div className="detect-empty">No visitors recorded yet.</div>}
                {visitors.slice(0, 25).map((v, i) => (
                  <div className="visitor-row" key={i}>
                    <span className="visitor-name">👤 {v.name}</span>
                    {v.lookingFor ? <span className="visitor-need">🔍 {v.lookingFor}</span> : null}
                    <em className="visitor-at">{v.at}</em>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {section === "Settings" && (
          <>
            <div className="ad-head">
              <h2>Settings</h2>
              <p>API keys, connections and admin security</p>
            </div>
            <div className="ad-card">
              <div className="ad-card-title ad-card-title-row">
                🔑 API keys & connections
                <button className="chip" onClick={() => setShowSecrets((s) => !s)}>{showSecrets ? "🙈 Hide values" : "👁 Show values"}</button>
              </div>
              <p className="auto-note">Saved here → active immediately. To make them permanent, download the .env and paste it into Render & Vercel.</p>
              <div className="ad-keys">
                {keys.map((k) => (
                  <div className="ad-key" key={k.key}>
                    <label className="key-label">
                      {k.key.replace(/_/g, " ")}
                      {k.runtime ? (
                        <span className="badge badge-pro">runtime</span>
                      ) : k.value ? (
                        <span className="badge badge-ok">set</span>
                      ) : (
                        <span className="badge badge-miss">missing</span>
                      )}
                    </label>
                    <input
                      className="auto-input"
                      type={SECRET_KEYS.test(k.key) && !showSecrets ? "password" : "text"}
                      value={k.value}
                      placeholder={`${k.key}=`}
                      onChange={(e) => setKeys((prev) => prev.map((x) => (x.key === k.key ? { ...x, value: e.target.value } : x)))}
                    />
                  </div>
                ))}
              </div>
              <div className="ad-row" style={{ marginTop: 10 }}>
                <button className="chip" disabled={keysBusy || busy} onClick={saveKeys}>{keysBusy ? "Saving…" : "💾 Save all"}</button>
                <button className="chip" disabled={busy} onClick={downloadEnv}>📄 Download .env</button>
                {envReady && <span className="ad-note-ok">✓ .env downloaded</span>}
              </div>
            </div>

            <div className="ad-card">
              <div className="ad-card-title">🛡 Admin password</div>
              <p className="auto-note">Change the owner password — the new value is active immediately in this instance. Set ADMIN_PASSWORD on Vercel/Render to make it permanent.</p>
              <div className="ad-row">
                <input className="auto-input" type="password" placeholder="Current password" value={passCur} onChange={(e) => setPassCur(e.target.value)} />
                <input className="auto-input" type="password" placeholder="New password (8+ chars)" value={passNew} onChange={(e) => setPassNew(e.target.value)} />
                <button className="chip" disabled={busy || !passCur || !passNew} onClick={changePass}>{busy ? "Saving…" : "🔐 Update password"}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}