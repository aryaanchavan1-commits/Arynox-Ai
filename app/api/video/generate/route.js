import { submitCharacterJob } from "@/lib/hedra";

export const maxDuration = 120;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      imageUrl,
      audioUrl,
      prompt = "",
      aspect_ratio = "1:1",
      resolution = "720p",
      duration_ms,
    } = body;

    if (!imageUrl) return Response.json({ error: "imageUrl is required" }, { status: 400 });
    if (!audioUrl) return Response.json({ error: "audioUrl is required" }, { status: 400 });

    const validAspects = ["1:1", "4:3", "3:4", "16:9", "9:16", "9:21", "21:9"];
    if (!validAspects.includes(aspect_ratio)) {
      return Response.json({ error: "invalid aspect_ratio" }, { status: 400 });
    }
    const validRes = ["540p", "720p", "1080p"];
    if (!validRes.includes(resolution)) {
      return Response.json({ error: "invalid resolution" }, { status: 400 });
    }

    const job = await submitCharacterJob({
      imageUrl,
      audioUrl,
      prompt,
      aspect_ratio,
      resolution,
      duration_ms,
    });

    const jobId = job.job_id || (job.job && job.job.job_id);
    return Response.json({ jobId, status: "SUBMITTED" });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 400) }, { status: 502 });
  }
}