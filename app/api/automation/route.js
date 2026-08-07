import { github, gmail, httpCall, mcpCall } from "@/lib/automations";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const params = body.params || {};
    const creds = body.creds || {};
    let result;
    if (action.startsWith("github_")) result = await github(action, params, creds);
    else if (action.startsWith("gmail_")) result = await gmail(action, params, creds);
    else if (action === "http_call") result = await httpCall(params);
    else if (action === "mcp_call") result = await mcpCall(params, creds);
    else return Response.json({ error: "unknown action" }, { status: 400 });
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 400) }, { status: 500 });
  }
}
