import { cfg } from "./config";

const LANGS = { en: "en", hi: "hi", mr: "mr" };
const SARVAM_URL = "https://api.sarvam.ai/text-to-speech";
const SARVAM_LANGS = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };
const SARVAM_VOICES = { kavya: "kavya", aditya: "aditya", shreya: "shreya", rahul: "rahul" };

function splitSentences(text, max = 180) {
  const parts = text.replace(/\s+/g, " ").trim();
  if (!parts) return [];
  const sentences = parts.match(/[^.!?।]*[.!?।]?/g) || [];
  const out = [];
  let cur = "";
  for (const s of sentences) {
    if (!s.trim()) continue;
    if ((cur + s).length > max && cur) {
      out.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function synthSarvamChunk(text, lang, speaker) {
  const res = await fetch(SARVAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": cfg("SARVAM_API_KEY"),
    },
    body: JSON.stringify({
      text,
      lang_code: SARVAM_LANGS[lang] || "en-IN",
      speaker: SARVAM_VOICES[speaker] || "kavya",
      model: "bulbul:v3",
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`sarvam tts ${res.status}`);
  const data = await res.json().catch(() => null);
  const b64 = Array.isArray(data?.audios) ? data.audios.join("") : null;
  if (!b64) throw new Error("sarvam no audio");
  return { buf: Buffer.from(b64, "base64"), ct: "audio/wav" };
}

async function synthSarvam(text, lang, speaker) {
  const key = cfg("SARVAM_API_KEY");
  if (!key) throw new Error("no sarvam key");
  const chunks = splitSentences(text, 500);
  if (!chunks.length) return { audio: Buffer.alloc(0), contentType: "audio/mpeg" };
  const buffers = [];
  let ct = "audio/mpeg";
  for (let i = 0; i < chunks.length; i++) {
    const r = await synthSarvamChunk(chunks[i], lang, speaker);
    buffers.push(r.buf);
    ct = r.ct;
    if (i < chunks.length - 1) await new Promise((s) => setTimeout(s, 100));
  }
  return { audio: Buffer.concat(buffers), contentType: ct };
}

async function synthChunk(text, lang) {
  const url =
    "https://translate.google.com/translate_tts" +
    "?ie=UTF-8&client=tw-ob&total=1&idx=0&prev=input&tl=" +
    lang +
    "&q=" +
    encodeURIComponent(text);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Referer: "https://translate.google.com/",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`google tts ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function synthGoogle(text, lang) {
  const chunks = splitSentences(text);
  if (!chunks.length) return Buffer.alloc(0);
  const buffers = [];
  for (let i = 0; i < chunks.length; i++) {
    buffers.push(await synthChunk(chunks[i], lang));
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 120));
  }
  return Buffer.concat(buffers);
}

async function synthesize(text, lang = "en", opts = {}) {
  const tl = LANGS[lang] || "en";
  const speaker = opts.speaker;
  try {
    const sar = await synthSarvam(text, tl, speaker);
    if (sar.audio.length) return { audio: sar.audio, contentType: sar.contentType };
  } catch {}
  try {
    const g = await synthGoogle(text, tl);
    return { audio: g, contentType: "audio/mpeg" };
  } catch {
    return { audio: Buffer.alloc(0), contentType: "audio/mpeg" };
  }
}

export { synthesize };
