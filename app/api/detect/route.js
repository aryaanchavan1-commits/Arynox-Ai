import { callGroqForDetect } from "@/lib/groq";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const image = typeof body.image === "string" ? body.image : null;
    if (!image) return Response.json({ error: "no image" }, { status: 400 });
    const objects = await callGroqForDetect(image);
    return Response.json({ objects });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
