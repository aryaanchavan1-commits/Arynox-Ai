const EXA_URL = "https://api.exa.ai";

async function exaFetch(path, body) {
  const res = await fetch(`${EXA_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.EXA_API_KEY}`,
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

async function webSearch(query, numResults = 5) {
  const data = await exaFetch("/search", {
    query,
    numResults,
    type: "auto",
    contents: { text: { maxCharacters: 1200 } },
  });
  const results = (data.results || []).map((r, i) => ({
    title: r.title || `Result ${i + 1}`,
    url: r.url,
    snippet: (r.text || "").replace(/\s+/g, " ").slice(0, 1200),
  }));
  if (!results.length) return "No results found.";
  return results
    .map((r) => `[${r.title}](${r.url})\n${r.snippet}`)
    .join("\n\n");
}

async function getUrl(url) {
  const data = await exaFetch("/contents", {
    urls: [url],
    text: { maxCharacters: 4000 },
  });
  const result = data.results?.[0];
  if (!result) return "Could not fetch the page.";
  return `Title: ${result.title || "n/a"}\nURL: ${result.url}\n\n${(result.text || "No text extracted.").replace(/\s+/g, " ").slice(0, 4000)}`;
}

export { webSearch, getUrl };
