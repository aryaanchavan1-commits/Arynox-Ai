import { getUserFromToken } from "@/lib/supabase";
import { addVisitor, listVisitors } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const user = token ? await getUserFromToken(token) : null;
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const lookingFor = String(body?.lookingFor || "").trim();
    if (!name && !lookingFor) return Response.json({ error: "nothing to save" }, { status: 400 });
    const entry = addVisitor(user?.email || "guest", { name, lookingFor });
    return Response.json({ ok: true, visitor: entry });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
