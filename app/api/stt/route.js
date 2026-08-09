import { transcribe } from "@/lib/groq";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!file) return Response.json({ error: "no audio" }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "audio/webm";
    const result = await transcribe(buffer, mime);
    if (!result.text) return Response.json({ error: "could not hear anything" }, { status: 400 });
    return Response.json(result);
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 300);
    const status = /STT failed: 4\d\d|invalid_request/i.test(msg) ? 400 : 500;
    return Response.json({ error: msg }, { status });
  }
}
