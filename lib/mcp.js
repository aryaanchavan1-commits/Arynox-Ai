const PROTOCOL_VERSION = "2025-03-26";

function serversFromCreds(creds = {}) {
  const out = [];
  const list = Array.isArray(creds.mcpServers) ? creds.mcpServers : [];
  for (const s of list) {
    if (s && s.url) out.push({ name: String(s.name || "server").slice(0, 40), url: s.url, token: s.token || "" });
  }
  if (creds.mcpUrl && !out.some((s) => s.url === creds.mcpUrl)) {
    out.push({ name: "default", url: creds.mcpUrl, token: creds.mcpToken || "" });
  }
  return out;
}

function buildInit() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "arynox-ai", version: "1.0.0" },
    },
  };
}

async function postJson(url, payload, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 200)}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/event-stream") || text.trim().startsWith("event:") || text.trim().startsWith("data:")) {
    return parseSse(text);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("MCP: invalid JSON response");
  }
}

function parseSse(text) {
  let result = null;
  let error = null;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    let parsed;
    try { parsed = JSON.parse(payload); } catch { continue; }
    if (parsed.error) error = new Error(`MCP error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
    else if (parsed.result !== undefined) result = parsed.result;
  }
  if (error) throw error;
  if (result === null) throw new Error("MCP: empty response");
  return { result };
}

async function initServer(s, { silent = false } = {}) {
  if (silent) {
    try { await postJson(s.url, buildInit(), s.token); } catch { /* keep going */ }
  } else {
    await postJson(s.url, buildInit(), s.token);
  }
}

async function discover(creds = {}) {
  const servers = serversFromCreds(creds);
  const out = [];
  for (const s of servers) {
    try {
      await initServer(s, { silent: true });
      const res = await postJson(s.url, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, s.token);
      const tools = (res?.result?.tools || []).map((t) => ({
        name: t.name,
        description: (t.description || "").slice(0, 300),
        inputSchema: t.inputSchema || {},
      }));
      out.push({ name: s.name, url: s.url, tools, error: null });
    } catch (err) {
      out.push({ name: s.name, url: s.url, tools: [], error: String(err.message || err).slice(0, 300) });
    }
  }
  return out;
}

async function callTool(creds = {}, serverName, toolName, params) {
  const servers = serversFromCreds(creds);
  const s = servers.find((x) => x.name === serverName) || servers[0];
  if (!s) throw new Error("MCP: no servers configured. Add one in the Automations tab.");
  if (!toolName) throw new Error("MCP: tool name required.");
  await initServer(s, { silent: true });
  const res = await postJson(
    s.url,
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: toolName, arguments: params || {} } },
    s.token
  );
  const content = res?.result?.content || [];
  const text = content
    .map((c) => (c && c.text) || JSON.stringify(c))
    .join("\n")
    .trim()
    .slice(0, 4000);
  return text || JSON.stringify(res?.result).slice(0, 4000) || "MCP tool returned no result.";
}

export { serversFromCreds, discover, callTool };
