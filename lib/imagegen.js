const PROVIDERS = [
  { base: "https://image.pollinations.ai/prompt/", model: "flux", suffix: "" },
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

async function verify(url) {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      return r.ok;
    } catch {
      return false;
    }
  }
}

export async function generateImage(prompt, width = 1024, height = 1024) {
  const p = cleanPrompt(prompt);
  if (!p) throw new Error("Empty image prompt");
  const seed = Math.floor(Math.random() * 1e9);
  let lastError = "no provider responded";
  for (const prov of PROVIDERS) {
    try {
      const url =
        prov.base + encodeURIComponent(p) + `?width=${width}&height=${height}&nologo=true&seed=${seed}` + prov.suffix;
      if (await verify(url)) {
        await new Promise((r) => setTimeout(r, 350));
        if (await verify(url)) return { url, provider: `pollinations-${prov.model}` };
        lastError = "image provider timed out";
      } else {
        lastError = "image provider rejected the request";
      }
    } catch (err) {
      lastError = err.message;
    }
  }
  throw new Error("Image generation failed: " + lastError);
}
