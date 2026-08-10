import { cfg } from "./config";
const GROQ_URL = "https://api.groq.com/openai/v1";

const MODELS = {
  brain: "llama-3.3-70b-versatile",
  brainFallback: "llama-3.1-8b-instant",
  vision: "qwen/qwen3.6-27b",
  stt: "whisper-large-v3-turbo",
};

const SYSTEM_PROMPT = `You are Arynox AI, a friendly AI assistant created by Arynox Tech.
LANGUAGE: Reply in the SAME language the user used. You speak English, Hindi and Marathi fluently. If the user writes in Devanagari (Hindi), reply in Hindi. If the user writes in Marathi, reply in Marathi. Short, natural answers are best.
PERSONALITY: Warm, concise, helpful. Answer in plain text without markdown.
HONESTY: Never invent facts, prices, dates, statistics, names or URLs. If you are not sure about a factual detail, say so clearly ("I'm not sure about that") instead of guessing. For anything current or news-related, tell the user you can search the live web for it.
MEMORY (long-term facts about the user - never contradict these, refer to them naturally):
{memory}
If the user shares a new personal fact, thank them and remember it (the memory system saves it automatically).
Current date and time: {now}`;

const FALLBACK_QUOTA_PATTERN = /per day/;

function lastUserLang(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" && typeof m.content === "string" && m.content.trim()) {
      return m.lang || (/[\u0900-\u097F]/.test(m.content) ? "hi" : "en");
    }
  }
  return "en";
}

function buildSystem(memory) {
  const mem = Array.isArray(memory) && memory.length
    ? memory.map((m) => `- ${m}`).join("\n")
    : "- (none yet)";
  return SYSTEM_PROMPT
    .replace("{memory}", mem)
    .replace("{now}", new Date().toLocaleString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }));
}

async function groqChat({ messages, image, memory }) {
  const sys = buildSystem(memory);
  const groqMessages = [{ role: "system", content: sys }];

  const useVision = !!image;
  for (const m of messages) {
    if (m.role === "system") continue;
    groqMessages.push({ role: m.role, content: m.content });
  }
  if (image) {
    const last = groqMessages[groqMessages.length - 1];
    if (last.role === "user") {
      groqMessages[groqMessages.length - 1] = {
        role: "user",
        content: [
          { type: "text", text: last.content || "What is in this image?" },
          { type: "image_url", image_url: { url: image } },
        ],
      };
    } else {
      groqMessages.push({
        role: "user",
        content: [
          { type: "text", text: "What is in this image?" },
          { type: "image_url", image_url: { url: image } },
        ],
      });
    }
  }

  const model = useVision ? MODELS.vision : MODELS.brain;
  const payload = {
    model,
    messages: groqMessages,
    temperature: 0.4,
    max_tokens: 1024,
  };

  let response = await callGroq(payload);
  let usedModel = model;
  if (!response && model !== MODELS.brainFallback) {
    payload.model = MODELS.brainFallback;
    usedModel = MODELS.brainFallback;
    response = await callGroq(payload);
  }
  if (!response) {
    throw new Error("Groq API unavailable after retries");
  }
  const raw = response.choices?.[0]?.message?.content || "";
  const reply = raw.replace(/<think>.*?<\/think>/gs, "").trim();
  return { reply, usedModel };
}

async function callGroq(payload) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${GROQ_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg("GROQ_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 429) {
        const body = await res.text();
        if (FALLBACK_QUOTA_PATTERN.test(body)) return null;
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (res.status >= 500) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Groq ${res.status}: ${body.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      if (err.name === "AbortError" || err.message?.includes("quota")) return null;
      if (/^Groq [34]\d\d/.test(err.message || "")) return null;
      if (attempt === 3) return null;
      await sleep(3000 * (attempt + 1));
    }
  }
  return null;
}

async function extractMemory(userText, reply) {
  if (String(userText || "").trim().length < 4 || !reply) return [];
  try {
    const res = await fetch(`${GROQ_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg("GROQ_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELS.brainFallback,
        messages: [
          {
            role: "system",
            content:
              "Extract durable personal facts from this exchange (name, birthday, preferences, project details, important events) as a JSON array of short English strings. Return ONLY the JSON array, e.g. [\"User's birthday is Jan 15\"]. If nothing worth remembering, return [].",
          },
          { role: "user", content: `USER: ${userText}\nASSISTANT: ${reply}` },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "[]";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string" && s.length > 3) : [];
  } catch {
    return [];
  }
}

const DETECT_PROMPT =
  "You are a real-time computer vision detector. List every object you can clearly see in this image. " +
  'Reply ONLY with a compact JSON array of objects, each like {"name":"laptop","count":1}. ' +
  "Use short lowercase English names (person, laptop, bottle, cup, phone, chair, window, dog...). Max 12 objects. No other text.";

async function callGroqForDetect(imageDataUrl) {
  const payload = {
    model: MODELS.vision,
    messages: [
      { role: "user", content: [
        { type: "text", text: DETECT_PROMPT },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ] },
    ],
    temperature: 0,
    max_tokens: 300,
  };
  let data = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${GROQ_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg("GROQ_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok) { data = await res.json(); break; }
      await sleep(2000 * (attempt + 1));
    } catch {
      await sleep(2000 * (attempt + 1));
    }
  }
  const raw = data?.choices?.[0]?.message?.content || "[]";
  const cleaned = raw.replace(/<think>.*?<\/think>/gs, "").replace(/```json|```/g, "").trim();
  try {
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) {
      return arr
        .filter((o) => o && typeof o.name === "string")
        .map((o) => ({ name: o.name.toLowerCase().slice(0, 30), count: Number(o.count) || 1 }))
        .slice(0, 12);
    }
  } catch {}
  return [];
}

async function transcribe(audioBuffer, mimeType) {
  const form = new FormData();
  form.append("model", MODELS.stt);
  form.append("file", new Blob([audioBuffer], { type: mimeType }), "audio.webm");
  form.append("response_format", "verbose_json");
  const res = await fetch(`${GROQ_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg("GROQ_API_KEY")}` },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`STT failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const lang = (data.language || "").toLowerCase();
  return {
    text: (data.text || "").trim(),
    lang: ["hi", "mr", "en"].includes(lang) ? lang : /[\u0900-\u097F]/.test(data.text || "") ? "hi" : "en",
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export { groqChat, extractMemory, transcribe, lastUserLang, callGroqForDetect, MODELS };
