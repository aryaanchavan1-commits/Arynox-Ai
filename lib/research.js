import { callLLM } from "./providers";
import { webSearch, getUrl } from "./exa";

const MAX_QUERIES = 4;
const MAX_SOURCES = 6;
const DOSSIER_CHARS = 30000;

async function expandQueries(question) {
  try {
    const { msg } = await callLLM({
      messages: [
        { role: "system", content: "You are a research planner. Generate 4 distinct, specific search queries that together cover the user's question from different angles (facts, data, latest news, examples, expert opinions). Reply ONLY with a JSON array of strings, no other text." },
        { role: "user", content: String(question).slice(0, 2000) },
      ],
      temperature: 0.3,
      max_tokens: 300,
      timeoutMs: 45000,
    });
    const raw = String(msg?.content || "").replace(/```json|```/g, "").trim();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const qs = arr.filter((s) => typeof s === "string" && s.trim().length > 4).map((s) => s.trim());
      if (qs.length) return qs.slice(0, MAX_QUERIES);
    }
  } catch {}
  return [String(question).slice(0, 500)];
}

export async function deepResearch(question) {
  const q = String(question || "").trim().slice(0, 2000);
  if (!q) return "Question is empty.";

  const queries = await expandQueries(q);
  const seen = new Set();
  const sources = [];

  for (const query of queries) {
    try {
      const text = await webSearch(query, 5);
      const pairs = [...text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
      for (const m of pairs) {
        const url = m[2];
        if (seen.has(url) || !/^https?:\/\//i.test(url)) continue;
        seen.add(url);
        sources.push({ title: m[1], url });
      }
    } catch {}
  }

  const fetched = [];
  for (const s of sources.slice(0, MAX_SOURCES)) {
    try {
      fetched.push(await getUrl(s.url));
    } catch {}
  }

  const dossier = [];
  dossier.push(`DEEP RESEARCH DOSSIER`);
  dossier.push(`Question: ${q}`);
  dossier.push(``);
  dossier.push(`Search queries used: ${queries.length}`);
  for (const query of queries) dossier.push(`- ${query}`);
  dossier.push(``);
  dossier.push(`Sources found (${sources.length}):`);
  sources.forEach((s, i) => dossier.push(`${i + 1}. [${s.title}](${s.url})`));
  dossier.push(``);
  dossier.push(`Full content of top ${fetched.length} sources:`);
  dossier.push(``);
  dossier.push(fetched.join(`\n\n${"=".repeat(60)}\n\n`));
  dossier.push(``);
  dossier.push(`Write a comprehensive, well-structured answer to the question using ONLY these sources. Cite sources as [1], [2] etc. at the end of relevant sentences, and finish with a "Sources:" list of the numbered URLs.`);

  return dossier.join("\n").slice(0, DOSSIER_CHARS);
}
