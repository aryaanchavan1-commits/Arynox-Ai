// Access control: premium grants, admin list, visitor log.
// Stores are per-instance (in-memory). The app owner can set ADMIN_EMAILS (comma-separated)
// as an environment variable; if it is unset, the first signed-in user becomes the admin.

const premiums = new Map(); // email(lower) -> expiresAt (ms)
const admins = new Set();   // email(lower)
const visitors = new Map(); // owner -> [{name, lookingFor, at, ts}]
const blocked = new Set();  // email(lower)
const users = new Map();    // email(lower) -> {email, name, firstSeen, lastSeen}

export function trackUser(email, name) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return;
  const now = Date.now();
  const prev = users.get(e);
  users.set(e, { email: e, name: String(name || "").slice(0, 60), firstSeen: prev?.firstSeen || now, lastSeen: now });
}

export function listUsers() {
  return [...users.values()].sort((a, b) => b.lastSeen - a.lastSeen).map((u) => ({
    ...u,
    premium: isPremium(u.email) > 0 ? isPremium(u.email) : 0,
    blocked: blocked.has(u.email),
  }));
}

export function blockUser(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  blocked.add(e);
  return true;
}

export function unblockUser(email) {
  const e = String(email || "").trim().toLowerCase();
  blocked.delete(e);
  return true;
}

export function isBlocked(email) {
  return blocked.has(String(email || "").trim().toLowerCase());
}

export function removeUser(email) {
  const e = String(email || "").trim().toLowerCase();
  users.delete(e);
  premiums.delete(e);
  blocked.delete(e);
  visitors.delete(e);
  return true;
}

export function isAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  if ((process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).includes(e)) return true;
  return admins.has(e);
}

export function claimAdmin(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  if ((process.env.ADMIN_EMAILS || "").trim()) return isAdminEmail(e);
  if (admins.size === 0) {
    admins.add(e);
    return true;
  }
  return admins.has(e);
}

export function grantPremium(email, days) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return null;
  const daysNum = Math.max(1, Math.min(3650, Number(days) || 30));
  const until = Date.now() + daysNum * 24 * 60 * 60 * 1000;
  const prev = premiums.get(e);
  premiums.set(e, prev && prev > Date.now() ? prev + daysNum * 24 * 60 * 60 * 1000 : until);
  return { email: e, until: premiums.get(e), premium: true };
}

export function revokePremium(email) {
  const e = String(email || "").trim().toLowerCase();
  premiums.delete(e);
  return true;
}

export function isPremium(email) {
  const e = String(email || "").trim().toLowerCase();
  const until = premiums.get(e) || 0;
  if (until > Date.now()) return until;
  if (until) premiums.delete(e);
  return 0;
}

export function listPremium() {
  const out = [];
  for (const [email, until] of premiums) {
    if (until > Date.now()) out.push({ email, until });
    else premiums.delete(email);
  }
  return out.sort((a, b) => a.email.localeCompare(b.email));
}

export function addVisitor(owner, { name, lookingFor }) {
  const key = String(owner || "__guest__");
  const entry = {
    name: String(name || "").slice(0, 80),
    lookingFor: String(lookingFor || "").slice(0, 200),
    at: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    ts: Date.now(),
  };
  const list = visitors.get(key) || [];
  list.unshift(entry);
  visitors.set(key, list.slice(0, 100));
  return entry;
}

export function listVisitors(owner, all) {
  if (all) {
    const out = [];
    for (const [k, v] of visitors) out.push(...v.map((e) => ({ ...e, owner: k })));
    return out.sort((a, b) => b.ts - a.ts).slice(0, 200);
  }
  return (visitors.get(String(owner || "__guest__")) || []).slice(0, 100);
}

export function clearVisitors(owner) {
  visitors.delete(String(owner || "__guest__"));
  return true;
}
