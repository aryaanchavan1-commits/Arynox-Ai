const HEDRA_BASE = "https://api.hedra.com/v3";

function authHeader() {
  const key = process.env.HEDRA_API_KEY;
  if (!key) throw new Error("HEDRA_API_KEY is not set");
  return { Authorization: `Key ${key}` };
}

async function req(path, opts = {}) {
  const res = await fetch(`${HEDRA_BASE}${path}`, {
    ...opts,
    headers: { ...authHeader(), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || text.slice(0, 300) || res.statusText;
    throw new Error(`Hedra ${res.status}: ${msg}`);
  }
  return data;
}

/**
 * Upload a file (image or audio) to Hedra and return its URL.
 * @param {Buffer|Uint8Array} buffer - file bytes
 * @param {string} filename - e.g. "avatar.png"
 * @param {string} contentType - e.g. "image/png"
 */
export async function uploadFile(buffer, filename, contentType) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType }), filename);
  return req("/files", { method: "POST", body: form });
}

/**
 * Upload a remote URL as a Hedra file reference.
 * Hedra accepts URLs for some inputs, but uploading is more reliable.
 */

/**
 * Submit a Hedra Character 3 (talking avatar) job.
 * @param {object} p
 * @param {string} p.imageUrl - URL of the avatar image (from uploadFile)
 * @param {string} p.audioUrl - URL of the audio (from uploadFile)
 * @param {string} p.prompt - generation prompt
 * @param {string} p.aspect_ratio - "1:1" | "16:9" | "9:16" | etc.
 * @param {string} p.resolution - "540p" | "720p" | "1080p"
 * @param {number} [p.duration_ms] - optional, auto-matches audio if omitted
 */
export async function submitCharacterJob({ imageUrl, audioUrl, prompt, aspect_ratio, resolution, duration_ms }) {
  const input = {
    prompt: prompt || "A person speaking naturally and clearly.",
    aspect_ratio,
    resolution,
    start_image: { source: "url", url: imageUrl },
    audio: { source: "url", url: audioUrl },
  };
  if (duration_ms) input.duration_ms = duration_ms;
  return req("/models/hedra-character-3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
}

/**
 * Check job status.
 * @param {string} jobId
 * @returns {object} { status, outputs, progress }
 */
export async function getJobStatus(jobId) {
  return req(`/jobs/${jobId}`);
}

/**
 * Poll a job until it completes or fails.
 * @param {string} jobId
 * @param {(status, job) => void} onProgress
 * @param {number} [intervalMs]
 * @param {number} [timeoutMs]
 */
export async function pollJob(jobId, onProgress, intervalMs = 4000, timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await getJobStatus(jobId);
    const status = job.status || (job.job && job.job.status) || "UNKNOWN";
    onProgress(status, job);
    if (status === "COMPLETED" || status === "SUCCEEDED") return job;
    if (status === "FAILED" || status === "ERROR") {
      const err = job.error || job.message || "Job failed";
      throw new Error(typeof err === "string" ? err : JSON.stringify(err));
    }
    if (Date.now() - start > timeoutMs) throw new Error("Job timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * Extract video URL(s) from a completed job.
 */
export function getOutputVideos(job) {
  const outputs = job.outputs || (job.job && job.job.outputs) || [];
  return outputs.map((o) => o.url).filter(Boolean);
}

export async function getBalance() {
  return req("/balance");
}

export { HEDRA_BASE };