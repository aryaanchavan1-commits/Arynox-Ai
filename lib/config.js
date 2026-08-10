// Runtime config: API keys & connections.
// Admin-set values (set in the admin panel) override environment variables at runtime.
// To make a value permanent, copy it into the single .env file (see the admin panel's
// "Download .env" button) or set it in Vercel/Render.

const overrides = new Map();

export const KEYS = [
  "GROQ_API_KEY",
  "CEREBRAS_API_KEY",
  "OPENCODE_API_KEY",
  "EXA_API_KEY",
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "GITHUB_TOKEN",
  "GMAIL_USER",
  "GMAIL_PASS",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_EMAILS",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "API_ORIGIN",
];

export function cfg(key) {
  const v = overrides.get(key);
  return v !== undefined ? v : (process.env[key] ?? "");
}

export function setCfg(key, value) {
  const k = String(key || "").trim();
  if (!KEYS.includes(k)) return false;
  const v = String(value ?? "").trim();
  if (!v) overrides.delete(k);
  else overrides.set(k, v);
  return true;
}

export function cfgList() {
  return KEYS.map((key) => ({ key, value: cfg(key), runtime: overrides.has(key) }));
}

export function adminCreds() {
  return {
    username: cfg("ADMIN_USERNAME") || "aryan",
    password: cfg("ADMIN_PASSWORD") || "aryanadmin1",
  };
}

export function isAdminUser(u, p) {
  const c = adminCreds();
  return u === c.username && p === c.password;
}

export function envDump() {
  return (
    "# Arynox AI - single environment file\n# Values marked (runtime) were set in the admin panel and are NOT saved here yet.\n\n" +
    cfgList()
      .map(({ key, value, runtime }) => (value ? `${key}=${value}${runtime ? "   # (runtime)" : ""}` : `# ${key}=`))
      .join("\n")
  );
}

// ---- admin sessions (username/password login) ----
const adminTokens = new Map(); // token -> { username, at }

export function createAdminSession(username) {
  const token = "adm_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  adminTokens.set(token, { username, at: Date.now() });
  if (adminTokens.size > 50) {
    const oldest = adminTokens.keys().next().value;
    adminTokens.delete(oldest);
  }
  return token;
}

export function verifyAdminSession(token) {
  const s = adminTokens.get(String(token || ""));
  if (!s) return null;
  if (Date.now() - s.at > 7 * 24 * 60 * 60 * 1000) { adminTokens.delete(token); return null; }
  return s;
}
