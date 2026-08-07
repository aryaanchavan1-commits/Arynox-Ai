const LANGS = { en: "en", hi: "hi", mr: "mr" };

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

async function synthesize(text, lang = "en") {
  const tl = LANGS[lang] || "en";
  const chunks = splitSentences(text);
  if (!chunks.length) return Buffer.alloc(0);
  const buffers = [];
  for (let i = 0; i < chunks.length; i++) {
    buffers.push(await synthChunk(chunks[i], tl));
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 120));
  }
  return Buffer.concat(buffers);
}

export { synthesize };
