import { cfg } from "./config";
const EXA_URL = "https://api.exa.ai";
const MWMBL_URL = "https://api.mwmbl.org";

function cleanText(t) {
  return String(t || "").replace(/\s+/g, " ").trim();
}

async function exaFetch(path, body) {
  const res = await fetch(`${EXA_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg("EXA_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Exa ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function exaSearch(query, numResults = 5) {
  const data = await exaFetch("/search", {
    query,
    numResults,
    type: "auto",
    contents: { text: { maxCharacters: 1200 } },
  });
  return (data.results || []).map((r, i) => ({
    title: cleanText(r.title || `Result ${i + 1}`),
    url: r.url,
    snippet: cleanText(r.text).slice(0, 1200),
  }));
}

async function mwmblSearch(query, numResults = 5) {
  const res = await fetch(`${MWMBL_URL}/search/?s=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .slice(0, numResults)
    .map((r) => {
      const title = Array.isArray(r.title) ? r.title.map((t) => t.value || "").join("") : String(r.title || "");
      let snippet = "";
      if (Array.isArray(r.extract)) {
        snippet = r.extract.map((e) => (typeof e === "string" ? e : e.value || "")).join(" ");
      } else {
        snippet = String(r.extract || "");
      }
      return {
        title: cleanText(title),
        url: String(r.url || ""),
        snippet: cleanText(snippet).slice(0, 600),
      };
    })
    .filter((r) => r.url && /^https?:\/\//i.test(r.url));
}

async function webSearch(query, numResults = 5) {
  const [exa, mwmbl] = await Promise.allSettled([
    exaSearch(query, numResults).catch(() => []),
    mwmblSearch(query, numResults),
  ]);
  const exaResults = exa.status === "fulfilled" ? exa.value : [];
  const mwmblResults = mwmbl.status === "fulfilled" ? mwmbl.value : [];
  const seen = new Set();
  const merged = [];
  for (const r of [...exaResults, ...mwmblResults]) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    merged.push(r);
  }
  if (!merged.length) return "No results found.";
  return merged
    .slice(0, numResults)
    .map((r) => {
      const lines = [`[${r.title}](${r.url})`];
      if (r.snippet) lines.push(r.snippet);
      return lines.join("\n");
    })
    .join("\n\n");
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

async function fetchPageText(url, maxChars = 4000) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 ArynoxAI/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) return `Could not fetch the page (HTTP ${res.status}).`;
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const decoded = decodeEntities(text);
  return decoded.slice(0, maxChars);
}

async function getUrl(url) {
  if (!/^https?:\/\//i.test(url)) return "Invalid URL.";
  try {
    const data = await exaFetch("/contents", {
      urls: [url],
      text: { maxCharacters: 4000 },
    });
    const result = data.results?.[0];
    if (result?.text) {
      return `Title: ${result.title || "n/a"}\nURL: ${result.url}\n\n${cleanText(result.text).slice(0, 4000)}`;
    }
  } catch {}
  const fallback = await fetchPageText(url);
  return `URL: ${url}\n\n${fallback}`;
}

export { webSearch, getUrl, mwmblSearch, exaSearch, fetchPageText };
