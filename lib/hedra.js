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
 * @returns {Promise<{url: string, content_type: string, expires_at: string}>}
 */
export async function uploadFile(buffer, filename, contentType) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType }), filename);
  return req("/files", { method: "POST", body: form });
}

/**
 * Upload a remote URL as a Hedra asset (fetches it server-side first).
 * @param {string} remoteUrl - external http(s) URL of an image or audio file
 * @returns {Promise<{url: string}>}
 */
export async function uploadRemoteUrl(remoteUrl) {
  const res = await fetch(String(remoteUrl), { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Could not download remote file (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = (res.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
  const ext =
    contentType.includes("image/png")
      ? "png"
      : contentType.includes("image/jpeg") || contentType.includes("image/jpg")
        ? "jpg"
        : contentType.includes("image/webp")
          ? "webp"
          : contentType.includes("audio/mpeg") || contentType.includes("audio/mp3")
            ? "mp3"
            : contentType.includes("audio/wav") || contentType.includes("audio/x-wav")
              ? "wav"
              : contentType.includes("audio/m4a")
                ? "m4a"
                : "bin";
  return uploadFile(buf, `asset.${ext}`, contentType || "application/octet-stream");
}

/** True if the URL was returned by POST /v3/files (i.e. already a Hedra asset). */
export function isHedraAssetUrl(url) {
  return typeof url === "string" && /^https:\/\/(api\.hedra\.com\/v3\/files\/|s3\.us-west-2\.amazonaws\.com\/hedra-ephemeral-services\.production\/v3-uploads)/i.test(url);
}

/**
 * Submit a Hedra Character 3 (talking avatar) job.
 * Files MUST be URLs returned by POST /v3/files (or use `ensureHedraAssetUrl`).
 * @param {object} p
 * @param {string} p.imageUrl - Hedra upload URL of the avatar image
 * @param {string} p.audioUrl - Hedra upload URL of the audio
 * @param {string} p.prompt - generation prompt
 * @param {string} p.aspect_ratio - "1:1" | "16:9" | "9:16" | etc.
 * @param {string} p.resolution - "540p" | "720p" | "1080p"
 * @param {number} [p.duration_ms] - optional, auto-matches audio if omitted
 */
export async function submitCharacterJob({ imageUrl, audioUrl, prompt, aspect_ratio, resolution, duration_ms }) {
  if (!imageUrl) throw new Error("imageUrl is required — upload the image with POST /v3/files first");
  if (!audioUrl) throw new Error("audioUrl is required — upload the audio with POST /v3/files first");
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