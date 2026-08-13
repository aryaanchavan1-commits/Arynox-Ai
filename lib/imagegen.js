import { cfg } from "./config";

// Primary: paid OpenAI-compatible image API (set IMAGE_API_KEY in the admin panel).
// Fallback (last resort only): pollinations — free host, no SLA, can return empty
// bodies while generating; verify() rejects anything without real bytes.
const FALLBACK_PROVIDERS = [
  { base: "https://image.pollinations.ai/prompt/", model: "flux", suffix: "&model=flux" },
  { base: "https://image.pollinations.ai/prompt/", model: "flux", suffix: "&model=flux&enhance=true" },
  { base: "https://image.pollinations.ai/prompt/", model: "turbo", suffix: "&model=turbo" },
  { base: "https://image.pollinations.ai/prompt/", model: "flux-anime", suffix: "&model=flux-anime" },
];

function cleanPrompt(prompt) {
  return prompt
    .replace(/^["']|["']$/g, "")
    .replace(/["\n\r]/g, " ")
    .trim()
    .slice(0, 800);
}

function hashSeed(prompt) {
  let h = 5381;
  for (let i = 0; i < prompt.length; i++) h = ((h * 33) ^ prompt.charCodeAt(i)) >>> 0;
  return h % 1e9;
}

async function generateWithPaid(prompt, width, height) {
  const key = String(cfg("IMAGE_API_KEY") || "").trim();
  if (!key) return null;
  const model = String(cfg("IMAGE_MODEL") || "gpt-image-1").trim();
  const size = width <= 1024 && height <= 1024 ? `${width}x${height}` : "1024x1024";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, n: 1, size, response_format: "b64_json" }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`Image API ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const d = await res.json();
  const b64 = d?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image API returned no image");
  const mime = d?.data?.[0]?.content_type || "image/png";
  return { url: `data:${mime};base64,${b64}`, provider: `openai-${model}` };
}

async function verify(url, timeoutMs = 90000) {
  const isImage = (ct) => !ct || ct.startsWith("image") || ct.includes("octet-stream") || ct.includes("webp");
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArynoxAI/1.0)", Accept: "image/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return false;
    if (!isImage((r.headers.get("content-type") || "").toLowerCase())) return false;
    const buf = await r.arrayBuffer();
    return buf.byteLength > 1500;
  } catch {
    return false;
  }
}

export async function generateImage(prompt, width = 1024, height = 1024, seed = null) {
  const p = cleanPrompt(prompt);
  if (!p) throw new Error("Empty image prompt");
  let lastError = "no provider responded";
  if (cfg("IMAGE_API_KEY")) {
    try {
      const paid = await generateWithPaid(p, width, height);
      if (paid) return paid;
    } catch (err) {
      lastError = err.message;
    }
  }
  const baseSeed = seed ?? hashSeed(p);
  for (const prov of FALLBACK_PROVIDERS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const s = (baseSeed + attempt) % 1e9;
      try {
        const url =
          prov.base + encodeURIComponent(p) + `?width=${width}&height=${height}&nologo=true&seed=${s}` + prov.suffix;
        if (await verify(url)) {
          await new Promise((r) => setTimeout(r, 500));
          if (await verify(url, 20000)) return { url, provider: `pollinations-${prov.model}${prov.suffix.includes("enhance") ? "-enhanced" : ""}` };
          lastError = "image provider timed out";
        } else {
          lastError = "image provider rejected the request";
        }
      } catch (err) {
        lastError = err.message;
      }
    }
  }
  throw new Error(String(lastError).startsWith("Image API") ? lastError : "Image generation failed: " + lastError);
}