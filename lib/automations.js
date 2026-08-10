import { cfg } from "./config";
import nodemailer from "nodemailer";
import { callTool } from "./mcp";

async function github(action, params, creds) {
  const token = creds?.githubToken || cfg("GITHUB_TOKEN");
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
  const user = creds?.gmailUser || cfg("GMAIL_USER");
  const pass = creds?.gmailPass || cfg("GMAIL_PASS");
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
  const server = String(params?.server || "");
  const tool = String(params?.tool || "");
  return callTool(creds, server, tool, params?.params || {});
}

export { github, gmail, httpCall, mcpCall };
