import { synthesize } from "@/lib/tts";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const text = String(body.text || "").trim();
    const lang = ["hi", "mr", "en"].includes(body.lang) ? body.lang : "en";
    const speaker = ["kavya", "aditya", "shreya", "rahul"].includes(body.speaker) ? body.speaker : "kavya";
    if (!text) return Response.json({ error: "empty text" }, { status: 400 });
    const { audio, contentType } = await synthesize(text, lang, { speaker });
    if (!audio.length) return Response.json({ error: "tts failed" }, { status: 500 });
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": contentType || "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
