import { isHedraAssetUrl, submitCharacterJob, uploadRemoteUrl } from "@/lib/hedra";

export const maxDuration = 120;
export const runtime = "nodejs";

const VALID_ASPECTS = ["1:1", "4:3", "3:4", "16:9", "9:16", "9:21", "21:9"];
const VALID_RES = ["540p", "720p", "1080p"];

/**
 * Ensure a URL is a Hedra asset URL (from POST /v3/files).
 * External URLs (pollinations, blob, etc.) are fetched server-side and re-uploaded.
 */
async function ensureHedraAssetUrl(url, label) {
  if (isHedraAssetUrl(url)) return url;
  if (url && typeof url === "string") {
    const uploaded = await uploadRemoteUrl(url);
    if (!uploaded || !uploaded.url) throw new Error(`${label}: upload failed`);
    return uploaded.url;
  }
  return null;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      imageUrl,
      audioUrl,
      imageAssetId,
      audioAssetId,
      prompt = "",
      aspect_ratio = "1:1",
      resolution = "720p",
      duration_ms,
    } = body;

    if (!VALID_ASPECTS.includes(aspect_ratio)) {
      return Response.json({ error: "invalid aspect_ratio" }, { status: 400 });
    }
    if (!VALID_RES.includes(resolution)) {
      return Response.json({ error: "invalid resolution" }, { status: 400 });
    }

    const finalImageUrl = await ensureHedraAssetUrl(String(imageAssetId || imageUrl || "").trim() || null, "image");
    const finalAudioUrl = await ensureHedraAssetUrl(String(audioAssetId || audioUrl || "").trim() || null, "audio");
    if (!finalImageUrl) return Response.json({ error: "imageUrl is required — upload the image to Hedra first" }, { status: 400 });
    if (!finalAudioUrl) return Response.json({ error: "audioUrl is required — upload the audio to Hedra first" }, { status: 400 });

    const job = await submitCharacterJob({
      imageUrl: finalImageUrl,
      audioUrl: finalAudioUrl,
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
