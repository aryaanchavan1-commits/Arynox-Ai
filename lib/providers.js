import { cfg } from "./config";

const PROVIDERS = [
  { id: "cerebras", base: "https://api.cerebras.ai/v1", models: ["gemma-4-31b", "gpt-oss-120b", "zai-glm-4.7"], key: () => cfg("CEREBRAS_API_KEY") },
  { id: "groq", base: "https://api.groq.com/openai/v1", models: ["groq/compound", "groq/compound-mini", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "allam-2-7b"], key: () => cfg("GROQ_API_KEY") },
  { id: "opencode", base: "https://opencode.ai/zen/v1", models: ["deepseek-v4-flash-free", "mimo-v2.5-free", "hy3-free", "ling-3.0-flash-free", "ling-3.0-tiny-free", "nemotron-3-ultra-free", "nemotron-3.5-lightning-free", "north-mini-code-free", "laguna-s-2.1-free", "longcat-2.0-free"], key: () => cfg("OPENCODE_API_KEY") },
];

const ZEN_PRO_MODELS = ["deepseek-v4-pro", "deepseek-v4-flash", "glm-5.2", "glm-5.1", "glm-5", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.5", "gpt-5.5-pro", "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.3-codex-spark", "gpt-5.3-codex", "gpt-5.2", "gpt-5.2-codex", "gpt-5.1", "gpt-5.1-codex-max", "gpt-5.1-codex", "gpt-5.1-codex-mini", "gpt-5", "gpt-5-codex", "gpt-5-nano", "claude-fable-5", "claude-opus-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-opus-4-5", "claude-sonnet-5", "claude-sonnet-4-6", "claude-sonnet-4-5", "claude-sonnet-4", "claude-haiku-4-5", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-pro", "gemini-3-flash", "grok-build-0.1", "grok-4.5", "minimax-m3", "minimax-m2.7", "minimax-m2.5", "kimi-k3", "kimi-k2.7-code", "kimi-k2.6", "kimi-k2.5", "qwen3.6-plus", "qwen3.5-plus", "big-pickle"];

const GROQ_CHAT_IDS = new Set(["groq/compound", "groq/compound-mini", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "allam-2-7b"]);

const FREE_RE = /-free$/i;
const ACRONYMS = new Set(["GPT", "OSS", "GLM", "ZAI", "AI", "API", "MCP", "SDK", "PDF", "SQL", "UI", "URL", "ID", "HTTP", "CPU", "GPU"]);

function humanName(modelId) {
  const base = String(modelId || "").split("/").pop().replace(/-free$/i, "");
  const words = base.split(/[-_]/).filter(Boolean);
  return words
    .map((w) => {
      const up = w.toUpperCase();
      if (ACRONYMS.has(up)) return up;
      if (/^\d+[a-z]$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ") || base;
}

function isFree(modelId, providerId) {
  if (providerId === "opencode") return FREE_RE.test(modelId);
  if (providerId === "groq") return true;
  return false;
}

let catalogCache = null;
let catalogAt = 0;
const CATALOG_TTL = 5 * 60 * 1000;

async function fetchLiveCatalog() {
  const out = [];
  const jobs = [];
  for (const p of PROVIDERS) {
    if (!p.key()) continue;
    jobs.push(
      fetch(`${p.base}/models`, { headers: { Authorization: `Bearer ${p.key()}` }, signal: AbortSignal.timeout(12000) })
        .then(async (r) => {
          if (!r.ok) return;
          const d = await r.json();
          const ids = Array.isArray(d.data) ? d.data.map((m) => m.id || "").filter(Boolean) : [];
          for (const id of ids) {
            if (p.id === "groq" && !GROQ_CHAT_IDS.has(id)) continue;
            if (p.id === "opencode" && !FREE_RE.test(id) && !ZEN_PRO_MODELS.includes(id)) continue;
            out.push({ id, provider: p.id, free: isFree(id, p.id), name: humanName(id) });
          }
        })
        .catch(() => {})
    );
  }
  await Promise.all(jobs);
  return out;
}

async function listModels() {
  if (catalogCache && Date.now() - catalogAt < CATALOG_TTL) return catalogCache;
  try {
    const live = await fetchLiveCatalog();
    if (live.length) {
      const seen = new Set();
      const merged = [...live];
      for (const p of PROVIDERS) {
        for (const id of p.models) {
          if (p.id === "opencode" && !ZEN_PRO_MODELS.includes(id) && !FREE_RE.test(id)) continue;
          if (seen.has(id) || merged.some((m) => m.id === id && m.provider === p.id)) continue;
          seen.add(id);
          merged.push({ id, provider: p.id, free: isFree(id, p.id), name: humanName(id) });
        }
      }
      catalogCache = merged;
    } else {
      const staticList = [];
      for (const p of PROVIDERS) for (const id of p.models) staticList.push({ id, provider: p.id, free: isFree(id, p.id), name: humanName(id) });
      for (const id of ZEN_PRO_MODELS) if (cfg("OPENCODE_API_KEY")) staticList.push({ id, provider: "opencode", free: false, name: humanName(id) });
      catalogCache = staticList;
    }
  } catch {
    const staticList = [];
    for (const p of PROVIDERS) for (const id of p.models) staticList.push({ id, provider: p.id, free: isFree(id, p.id), name: humanName(id) });
    for (const id of ZEN_PRO_MODELS) if (cfg("OPENCODE_API_KEY")) staticList.push({ id, provider: "opencode", free: false, name: humanName(id) });
    catalogCache = staticList;
  }
  catalogAt = Date.now();
  return catalogCache;
}

const CHAIN = [
  { provider: "opencode", model: "deepseek-v4-flash-free" },
  { provider: "opencode", model: "mimo-v2.5-free" },
  { provider: "opencode", model: "hy3-free" },
  { provider: "opencode", model: "ling-3.0-flash-free" },
  { provider: "opencode", model: "ling-3.0-tiny-free" },
  { provider: "opencode", model: "nemotron-3-ultra-free" },
  { provider: "opencode", model: "nemotron-3.5-lightning-free" },
  { provider: "opencode", model: "north-mini-code-free" },
  { provider: "opencode", model: "laguna-s-2.1-free" },
  { provider: "opencode", model: "longcat-2.0-free" },
  { provider: "cerebras", model: "gemma-4-31b" },
  { provider: "cerebras", model: "gpt-oss-120b" },
  { provider: "cerebras", model: "zai-glm-4.7" },
  { provider: "groq", model: "groq/compound" },
  { provider: "groq", model: "groq/compound-mini" },
  { provider: "groq", model: "openai/gpt-oss-120b" },
  { provider: "groq", model: "openai/gpt-oss-20b" },
  { provider: "groq", model: "qwen/qwen3.6-27b" },
  { provider: "groq", model: "llama-3.3-70b-versatile" },
  { provider: "groq", model: "llama-3.1-8b-instant" },
  { provider: "groq", model: "allam-2-7b" },
];

const stripThinking = (text) => {
  if (Array.isArray(text)) {
    text = text.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join("");
  }
  if (typeof text !== "string") return "";
  return text
    .replace(/<think>.*?<\/think>/gs, "")
    .replace(/^```(?:json)?\s*/m, "")
    .trim();
};

async function callLLM({ messages, tools, temperature = 0.4, max_tokens = 2048, timeoutMs = 90000, fast = false, model = null }) {
  let chain = CHAIN;
  if (model) {
    const pinned = CHAIN.find((c) => c.model === model);
    if (pinned) chain = [pinned, ...CHAIN.filter((c) => c.model !== model)];
    else {
      const provider = PROVIDERS.find((p) => p.models.includes(model));
      if (provider) chain = [{ provider: provider.id, model }, ...CHAIN];
    }
  }
  let lastError = null;
  for (const { provider: pId, model } of chain) {
    const provider = PROVIDERS.find((p) => p.id === pId);
    if (!provider || !provider.key()) continue;
    const payload = { model, messages, temperature, max_tokens };
    if (tools && tools.length) payload.tools = tools;
    try {
      const res = await fetch(`${provider.base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      if (res.status === 429) {
        if (/per day/i.test(text)) { lastError = { provider: pId, model, quota: true }; continue; }
        lastError = { provider: pId, model, retryable: true };
        continue;
      }
      if (res.status >= 500) { lastError = { provider: pId, model, retryable: true }; continue; }
      if (!res.ok) { lastError = { provider: pId, model, message: text.slice(0, 150) }; continue; }
      const data = JSON.parse(text);
      const msg = data.choices?.[0]?.message;
      if (!msg?.content && !msg?.tool_calls && !msg?.reasoning && !msg?.reasoning_content) continue;
      return {
        msg: { ...msg, content: msg.content || (pId === "opencode" ? msg.reasoning_content : null) || stripThinking(msg.reasoning) },
        provider: pId,
        model,
      };
    } catch (err) {
      if (pId === "opencode" && tools && tools.length) {
        try {
          const res = await fetch(`${provider.base}/chat/completions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${provider.key()}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages, temperature, max_tokens }),
            signal: AbortSignal.timeout(timeoutMs),
          });
          const text = await res.text();
          if (res.ok) {
            const data = JSON.parse(text);
            const msg = data.choices?.[0]?.message;
            if (msg?.content || msg?.reasoning_content) {
              return { msg: { ...msg, content: msg.content || msg.reasoning_content || stripThinking(msg.reasoning) }, provider: pId, model };
            }
          }
        } catch {}
      }
      lastError = { provider: pId, model, message: err.message };
    }
  }
  throw new Error(
    lastError?.quota
      ? "All AI providers are rate-limited right now. Try again in a minute."
      : `All AI providers failed. ${lastError?.provider || ""} ${lastError?.model || ""} ${lastError?.message || (lastError?.retryable ? "(server/rate-limit error)" : "")}`.trim()
  );
}

export { callLLM, stripThinking, CHAIN, listModels, humanName };
