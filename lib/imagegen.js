const PROVIDERS = [
  { base: "https://image.pollinations.ai/prompt/", model: "flux", suffix: "&model=flux&enhance=true" },
  { base: "https://image.pollinations.ai/prompt/", model: "flux", suffix: "&model=flux" },
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

async function verify(url) {
  const isImage = (ct) => !ct || ct.startsWith("image") || ct.includes("octet-stream") || ct.includes("webp");
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
    if (r.ok) return isImage((r.headers.get("content-type") || "").toLowerCase());
  } catch {}
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return false;
    return isImage((r.headers.get("content-type") || "").toLowerCase());
  } catch {
    return false;
  }
}

export async function generateImage(prompt, width = 1024, height = 1024, seed = null) {
  const p = cleanPrompt(prompt);
  if (!p) throw new Error("Empty image prompt");
  const baseSeed = seed ?? hashSeed(p);
  let lastError = "no provider responded";
  for (const prov of PROVIDERS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const s = (baseSeed + attempt) % 1e9;
      try {
        const url =
          prov.base + encodeURIComponent(p) + `?width=${width}&height=${height}&nologo=true&seed=${s}` + prov.suffix;
        if (await verify(url)) {
          await new Promise((r) => setTimeout(r, 500));
          if (await verify(url)) return { url, provider: `pollinations-${prov.model}${prov.suffix.includes("enhance") ? "-enhanced" : ""}` };
          lastError = "image provider timed out";
        } else {
          lastError = "image provider rejected the request";
        }
      } catch (err) {
        lastError = err.message;
      }
    }
  }
  throw new Error("Image generation failed: " + lastError);
}
