const PROVIDERS = [
  { id: "cerebras", base: "https://api.cerebras.ai/v1", models: ["gpt-oss-120b", "zai-glm-4.7"], key: () => process.env.CEREBRAS_API_KEY },
  { id: "groq", base: "https://api.groq.com/openai/v1", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"], key: () => process.env.GROQ_API_KEY },
  { id: "opencode", base: "https://opencode.ai/zen/v1", models: ["laguna-s-2.1-free", "nemotron-3-ultra-free", "longcat-2.0-free"], key: () => process.env.OPENCODE_API_KEY },
];

const CHAIN = [
  { provider: "cerebras", model: "gpt-oss-120b" },
  { provider: "cerebras", model: "zai-glm-4.7" },
  { provider: "groq", model: "llama-3.3-70b-versatile" },
  { provider: "groq", model: "llama-3.1-8b-instant" },
  { provider: "opencode", model: "laguna-s-2.1-free" },
  { provider: "opencode", model: "nemotron-3-ultra-free" },
  { provider: "opencode", model: "longcat-2.0-free" },
];

const stripThinking = (text) =>
  (text || "")
    .replace(/<think>.*?<\/think>/gs, "")
    .replace(/^```(?:json)?\s*/m, "")
    .trim();

async function callLLM({ messages, tools, temperature = 0.4, max_tokens = 2048, timeoutMs = 90000, fast = false }) {
  const chain = fast ? [CHAIN[1], ...CHAIN.slice(2)] : CHAIN;
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

export { callLLM, stripThinking, CHAIN };
