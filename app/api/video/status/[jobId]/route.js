import { getJobStatus, getOutputVideos } from "@/lib/hedra";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function GET(req, { params }) {
  try {
    const { jobId } = await params;
    if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
    const job = await getJobStatus(jobId);
    const status = job.status || (job.job && job.job.status) || "UNKNOWN";
    const videos = status === "COMPLETED" || status === "SUCCEEDED" ? getOutputVideos(job) : [];
    return Response.json({ jobId, status, videos, raw: job });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 400) }, { status: 502 });
  }
}