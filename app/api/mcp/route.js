import { discover, callTool } from "@/lib/mcp";

export const maxDuration = 45;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const creds = body?.creds || {};
    const action = String(body?.action || "list");
    if (action === "list") {
      const servers = await discover(creds);
      return Response.json({ ok: true, servers });
    }
    if (action === "call") {
      const result = await callTool(creds, String(body?.server || ""), String(body?.tool || ""), body?.params || {});
      return Response.json({ ok: true, result });
    }
    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 400) }, { status: 500 });
  }
}
