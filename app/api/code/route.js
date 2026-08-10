import { runAgent } from "@/lib/agent";
import { ownerFromRequest } from "@/lib/supabase";
import { writeFile, snapshot, tree } from "@/lib/workspace";

export const maxDuration = 90;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const owner = await ownerFromRequest(req);
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages.filter((m) => m && m.role && typeof m.content === "string") : [];
    const files = Array.isArray(body?.files) ? body.files.filter((f) => f && f.name) : [];

    if (!messages.length) return Response.json({ error: "Nothing to ask the agent." }, { status: 400 });

    // Sync the current IDE files into the agent workspace so it sees the live project.
    for (const f of files) {
      try { writeFile(String(f.name).slice(0, 120), String(f.code || ""), owner); } catch {}
    }

    const result = await runAgent({
      messages,
      memory: [],
      creds: {},
      owner,
      business: null,
    });

    return Response.json({
      reply: result.reply || "",
      workspace: snapshot(owner) || [],
      tools: result.tools || [],
      changed: files.filter((f) => {
        const ws = (snapshot(owner) || []).find((w) => w.name === f.name);
        return !ws || ws.code !== f.code;
      }).map((f) => f.name),
      error: result.error ? true : false,
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
