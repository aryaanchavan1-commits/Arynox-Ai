import { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase";

// Face sign-in backend: descriptors (128-dim) are stored in each user's user_metadata.face.
// A refresh token is kept alongside so face login can mint a real Supabase session.

const MATCH_THRESHOLD = 0.46;

const headers = () => ({
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  apikey: SUPABASE_SECRET_KEY,
  "Content-Type": "application/json",
});

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function similarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  return cosine(a, b);
}

export async function adminCreateUser({ email, password, fullName }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || email.split("@")[0] },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 300));
  }
  return (await res.json()).user;
}

export async function adminListUsers() {
  const users = [];
  for (let page = 0; page < 20; page++) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`,
      { headers: headers(), signal: AbortSignal.timeout(20000) }
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body.slice(0, 300));
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    users.push(...batch);
  }
  return users;
}

export async function adminPatchMetadata(userId, metadata) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ user_metadata: metadata }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 300));
  }
  return (await res.json()).user;
}

export async function passwordSession(email, password) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 300));
  }
  return await res.json();
}

export async function refreshSession(refreshToken) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 300));
  }
  return await res.json();
}

export function randomPassword() {
  return `Ax${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function validateDescriptor(d) {
  return Array.isArray(d) && d.length === 128 && d.every((v) => typeof v === "number" && Number.isFinite(v));
}

export { MATCH_THRESHOLD };
