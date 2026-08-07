import { listFiles, clear, buildZip } from "@/lib/workspace";
import { ownerFromRequest } from "@/lib/supabase";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function GET(req) {
  try {
    const owner = await ownerFromRequest(req);
    const { buffer, count } = await buildZip(owner);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=arynox-workspace.zip",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const owner = await ownerFromRequest(req);
    const body = await req.json();
    const action = String(body?.action || "clear");
    if (action === "clear") {
      const msg = clear(owner);
      return Response.json({ ok: true, result: msg });
    }
    if (action === "list") {
      return Response.json({ ok: true, files: listFiles(owner) });
    }
    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
