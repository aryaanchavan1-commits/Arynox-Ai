import { generateImage } from "@/lib/imagegen";

export const maxDuration = 120;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return Response.json({ error: "no prompt" }, { status: 400 });
    const width = Math.min(2048, Math.max(256, Number(body.width) || 1024));
    const height = Math.min(2048, Math.max(256, Number(body.height) || 1024));
    const result = await generateImage(prompt, width, height);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 502 });
  }
}
