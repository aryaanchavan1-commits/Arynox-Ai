import nodemailer from "nodemailer";

async function github(action, params, creds) {
  const token = creds?.githubToken || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GitHub: add your personal access token in Automations");
  const h = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const base = "https://api.github.com";
  const repo = params.repo || "";
  switch (action) {
    case "github_search": {
      const q = params.query || "";
      const r = await fetch(`${base}/search/repositories?q=${encodeURIComponent(q)}&per_page=5`, { headers: h, signal: AbortSignal.timeout(20000) });
      const d = await r.json();
      if (!r.ok) throw new Error("GitHub: " + (d.message || r.status));
      return d.items.map((i) => `[${i.full_name}](${i.html_url}) ★${i.stargazers_count} - ${(i.description || "").slice(0, 150)}`).join("\n") || "No repos found";
    }
    case "github_issues": {
      const r = await fetch(`${base}/repos/${repo}/issues?state=open&per_page=5`, { headers: h, signal: AbortSignal.timeout(20000) });
      const d = await r.json();
      if (!r.ok) throw new Error("GitHub: " + (d.message || r.status));
      return d.map((i) => `#${i.number} ${i.title} (${i.labels?.map((l) => l.name).join(",") || "no labels"})`).join("\n") || "No open issues";
    }
    case "github_create_issue": {
      const r = await fetch(`${base}/repos/${repo}/issues`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ title: params.title, body: params.body || "" }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await r.json();
      if (!r.ok) throw new Error("GitHub: " + (d.message || r.status));
      return `Issue created: ${d.html_url}`;
    }
    default:
      throw new Error("Unknown GitHub action: " + action);
  }
}

async function gmail(action, params, creds) {
  const user = creds?.gmailUser || process.env.GMAIL_USER;
  const pass = creds?.gmailPass || process.env.GMAIL_PASS;
  if (!user || !pass) throw new Error("Gmail: add your Gmail address + App Password in Automations");
  const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  if (action === "gmail_send") {
    await transport.sendMail({
      from: user,
      to: params.to || "",
      subject: params.subject || "From Arynox AI",
      text: params.body || "",
    });
    return `Email sent to ${params.to}`;
  }
  throw new Error("Unknown Gmail action: " + action);
}

async function httpCall(params) {
  const { method = "GET", url = "", headers = {}, body } = params;
  if (!url) throw new Error("HTTP: URL required");
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(typeof body === "string" ? JSON.parse(body) : body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  return `HTTP ${r.status}: ${text.slice(0, 2000) || "(empty body)"}`;
}

async function mcpCall(params, creds) {
  const url = params.serverUrl || creds?.mcpUrl;
  if (!url) throw new Error("MCP: paste a remote MCP server URL in Automations");
  const body = { jsonrpc: "2.0", id: params.id || 1, method: params.method || "tools/call", params: params.params || {} };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(params.headers || {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("text/event-stream")) {
      const text = await r.text();
      const lines = text.split("\n").filter((l) => l.startsWith("data:"));
      const last = lines[lines.length - 1]?.slice(5) || "{}";
      return "SSE: " + last.slice(0, 3000);
    }
    const json = await r.json();
    return JSON.stringify(json.result || json).slice(0, 3000);
  } catch (err) {
    throw new Error("MCP call failed: " + err.message);
  }
}

export { github, gmail, httpCall, mcpCall };
