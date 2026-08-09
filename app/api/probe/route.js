export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    const res = await fetch("https://offnevsupwnwqnhtexed.supabase.co/auth/v1/signup", {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_GNjhV5lBxc44tSmEWbod6Q_EXYYT9Gq",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, data: { full_name: "Probe User" } }),
    });
    const body = await res.json();
    return Response.json({ http: res.status, session: !!body.session, confirmed: body.user?.email_confirmed_at || null, msg: body.msg || null, code: body.error_code || null });
  } catch (e) {
    return Response.json({ fatal: String(e) });
  }
}
