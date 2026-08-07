import { webSearch, getUrl } from "./exa";
import { runCode } from "./runner";
import { callLLM } from "./providers";
import { buildXlsx, buildCsv, buildDocx } from "./office";
import { github, gmail, httpCall, mcpCall } from "./automations";
import { writeFile, readFile, editFile, deleteFile, listFiles, tree, snapshot } from "./workspace";
import { discover } from "./mcp";

const TOOLS = [
  { type: "function", function: { name: "web_search", description: "Live web search for current information, news, facts, research, prices. Returns titled snippets with URLs.", parameters: { type: "object", properties: { query: { type: "string", description: "Specific search query" } }, required: ["query"] } } },
  { type: "function", function: { name: "get_url", description: "Fetch the full text content of a specific webpage URL.", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
  { type: "function", function: { name: "run_code", description: "Write and execute JavaScript in a sandbox (no imports). Use console.log for output. Use for calculations, scripts, algorithms, data processing, simulations and VERIFYING code you wrote. The sandbox has fetch, Math, JSON, Date, promises and async/await.", parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] } } },
  { type: "function", function: { name: "write_file", description: "Create or overwrite a file in the project workspace. Use for any source file the user asks for (js, html, css, py, json, md, txt...). Multi-file apps: write each file with its own write_file call, then run_code to test.", parameters: { type: "object", properties: { name: { type: "string", description: "Filename with extension, e.g. app.js, index.html, style.css" }, code: { type: "string", description: "Full file content" } }, required: ["name", "code"] } } },
  { type: "function", function: { name: "read_file", description: "Read a file from the project workspace. Always read before editing.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "edit_file", description: "Replace exact text in a workspace file (find/replace). Use to fix or extend existing files without rewriting them.", parameters: { type: "object", properties: { name: { type: "string" }, search: { type: "string", description: "Exact text to find (must match current content)" }, replace: { type: "string", description: "Text to put in its place" } }, required: ["name", "search", "replace"] } } },
  { type: "function", function: { name: "list_files", description: "List all files in the project workspace with sizes.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "delete_file", description: "Delete a file from the project workspace.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "create_excel", description: "Create an Excel (.xlsx) spreadsheet with formatted headers, frozen first row and auto-filters. Rows is a 2D array; first row = headers. Use for budgets, inventories, lists, reports, schedules.", parameters: { type: "object", properties: { filename: { type: "string", description: "e.g. budget.xlsx" }, sheet: { type: "string", description: "Sheet name, default Sheet1" }, rows: { type: "array", items: { type: "array" }, description: "2D array of values; first row = column headers" } }, required: ["filename", "rows"] } } },
  { type: "function", function: { name: "create_csv", description: "Create a CSV file from a 2D array of values.", parameters: { type: "object", properties: { filename: { type: "string", description: "e.g. data.csv" }, rows: { type: "array", items: { type: "array" } } }, required: ["filename", "rows"] } } },
  { type: "function", function: { name: "create_docx", description: "Create a Word (.docx) document from plain text. Use # for headings, - for bullet lists, blank lines between paragraphs.", parameters: { type: "object", properties: { filename: { type: "string", description: "e.g. report.docx" }, text: { type: "string" } }, required: ["filename", "text"] } } },
  { type: "function", function: { name: "gmail_send", description: "Send an email via the user's connected Gmail. Requires gmailUser + gmailPass (App Password) configured in Automations.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } } },
  { type: "function", function: { name: "github_search", description: "Search GitHub repositories. Requires a GitHub token in Automations.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "github_issues", description: "List open issues of a GitHub repo (format owner/name).", parameters: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] } } },
  { type: "function", function: { name: "github_create_issue", description: "Create a GitHub issue on a repo (format owner/name).", parameters: { type: "object", properties: { repo: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["repo", "title"] } } },
  { type: "function", function: { name: "http_call", description: "Make a custom HTTP request (GET/POST/PUT/DELETE) to any API endpoint.", parameters: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] }, url: { type: "string" }, headers: { type: "object" }, body: { type: "object" } }, required: ["url"] } } },
  { type: "function", function: { name: "mcp_list_tools", description: "List MCP servers the user has connected and every tool each server exposes (with its schema). Use this to discover what the user's connected apps can do before calling mcp_call.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "mcp_call", description: "Call a tool on a connected MCP server (Model Context Protocol). First call mcp_list_tools to see available servers and their tools. Provide exactly the parameters the tool schema requires.", parameters: { type: "object", properties: { server: { type: "string", description: "Server name exactly as shown by mcp_list_tools" }, tool: { type: "string", description: "Tool name on that server" }, params: { type: "object", description: "Tool arguments matching the tool's schema" } }, required: ["server", "tool"] } } },
];

const AGENT_PROMPT = `You are Arynox AI, a premium research, coding and office automation agent built by Arynox Tech.
LANGUAGE: Always reply in the SAME language the user used - English, Hindi or Marathi fluently (Hindi and Marathi in Devanagari script).
BEHAVIOR:
1. RESEARCH: For anything current, factual, technical or uncertain, search the web with web_search first and answer from the results. Cite sources as short links. Use get_url for full details.
2. CODING AGENT: You build real, working, multi-file projects in a shared workspace.
   - Use write_file to create each file (app.js, index.html, style.css, script.py, etc). For a project, write ALL its files, then run_code to test the main logic and show the output.
   - Use read_file before changing a file and edit_file for targeted fixes. Use list_files to track what exists, delete_file to remove files.
   - Every time you write or edit code, verify it by running it with run_code. If the output shows errors, fix them with edit_file and run again.
   - Keep files clean, complete and runnable. At the end, tell the user the project is ready in the IDE tab and downloadable as ZIP.
3. OFFICE: For spreadsheets, budgets, lists, reports, schedules, invoices - build them with create_excel (use headers, sensible columns) or create_csv, and say the file is ready to download. For documents use create_docx with clear structure.
4. AUTOMATIONS: When the user asks to send email, create GitHub issues, or talk to connected apps, use the matching tool. To use a connected app (MCP), first call mcp_list_tools to see what is available, then mcp_call with the exact tool name and its parameters. If a service needs a connection that is not configured, tell the user to open the Automations tab and add it.
5. Answer in plain text with minimal markdown: only headings, lists and code fences. Never invent search results.
MEMORY (long-term facts about the user - never contradict, refer to them naturally):
{memory}
Current date and time: {now}
Workspace files (persist between your conversations):
{workspace}`;

const FAST_RE = /^(hi|hello|hey|namaste|namaskar|good (morning|afternoon|evening|night)|how are you|thank|bye|ok|okay|yes|no|kaise|kya kar rahe|thik|shukriya|धन्यवाद|नमस्ते|नमस्कार|हैलो|हाय)[!.\s]*$/i;

async function runAgent({ messages, memory, creds = {} }) {
  const mem = Array.isArray(memory) && memory.length ? memory.map((m) => `- ${m}`).join("\n") : "- (none yet)";
  const wsTree = tree();
  const system = AGENT_PROMPT
    .replace("{memory}", mem)
    .replace("{workspace}", wsTree)
    .replace("{now}", new Date().toLocaleString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }));

  const chat = [
    { role: "system", content: system },
    ...messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
  ];

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = typeof lastUser?.content === "string" ? lastUser.content : "";
  const fast = FAST_RE.test(text.trim()) && text.trim().length < 40;

  let reply = "";
  let modelUsed = "";
  let providerUsed = "";
  const usedTools = [];
  const codeFiles = [];
  const files = [];
  const maxRounds = 6;

  try {
    for (let round = 0; round < maxRounds; round++) {
      const { msg, provider, model } = await callLLM({
        messages: chat,
        tools: TOOLS,
        temperature: 0.4,
        max_tokens: 2048,
        fast: fast && round === 0,
      });
      providerUsed = provider;
      modelUsed = model;
      if (msg?.content) reply = msg.content;
      const calls = msg?.tool_calls || [];
      if (!calls.length) break;

      chat.push({ role: "assistant", content: reply || null, tool_calls: calls });
      for (const call of calls) {
        const name = call.function?.name;
        let args = {};
        try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}
        usedTools.push({ name, args });
        let result;
        try {
          if (name === "web_search") result = await webSearch(String(args.query || ""));
          else if (name === "get_url") result = await getUrl(String(args.url || ""));
          else if (name === "run_code") {
            const r = await runCode(String(args.code || ""));
            result = r.error ? `Execution error: ${r.error}` : `Output:\n${r.output || "(no output)"}`;
          } else if (name === "write_file") {
            result = writeFile(String(args.name || ""), String(args.code || ""));
            result += `\nWorkspace:\n${tree()}`;
          } else if (name === "read_file") {
            result = readFile(String(args.name || ""));
          } else if (name === "edit_file") {
            result = editFile(String(args.name || ""), String(args.search || ""), String(args.replace || ""));
          } else if (name === "list_files") {
            result = `Workspace:\n${tree()}`;
          } else if (name === "delete_file") {
            result = deleteFile(String(args.name || ""));
            result += `\nWorkspace:\n${tree()}`;
          } else if (name === "create_excel") {
            const rows = Array.isArray(args.rows) ? args.rows : [];
            const buf = await buildXlsx(rows, String(args.sheet || "Sheet1"));
            files.push({ name: String(args.filename || "spreadsheet.xlsx"), type: "xlsx", dataBase64: buf.toString("base64") });
            result = `Excel file created: ${args.filename} with ${rows.length} rows. Tell the user it is ready to download.`;
          } else if (name === "create_csv") {
            const rows = Array.isArray(args.rows) ? args.rows : [];
            const buf = Buffer.from(buildCsv(rows), "utf-8");
            files.push({ name: String(args.filename || "data.csv"), type: "csv", dataBase64: buf.toString("base64") });
            result = `CSV file created: ${args.filename} with ${rows.length} rows. Tell the user it is ready to download.`;
          } else if (name === "create_docx") {
            const buf = await buildDocx(String(args.text || ""));
            files.push({ name: String(args.filename || "document.docx"), type: "docx", dataBase64: buf.toString("base64") });
            result = `Word document created: ${args.filename}. Tell the user it is ready to download.`;
          } else if (name.startsWith("gmail_") || name.startsWith("github_") || name === "http_call" || name === "mcp_call" || name === "mcp_list_tools") {
            try {
              if (name.startsWith("gmail_")) result = await gmail(name, args, creds);
              else if (name.startsWith("github_")) result = await github(name, args, creds);
              else if (name === "http_call") result = await httpCall(args);
              else if (name === "mcp_list_tools") {
                const servers = await discover(creds);
                result = servers.length
                  ? servers.map((s) => {
                      if (s.error) return `[${s.name}] ${s.url}\n  ERROR: ${s.error}`;
                      const tools = s.tools.map((t) => {
                        const req = (t.inputSchema?.required || []).join(", ");
                        const props = t.inputSchema?.properties ? Object.keys(t.inputSchema.properties).slice(0, 8).join(", ") : "";
                        return `  ${t.name}(${props}${req ? ` required: ${req}` : ""}) - ${t.description}`;
                      }).join("\n");
                      return `[${s.name}] ${s.url}\n${tools || "  (no tools)"}`;
                    }).join("\n\n")
                  : "No MCP servers configured. Tell the user to add one in the Automations tab.";
              }
              else result = await mcpCall(args, creds);
            } catch (err) {
              result = `Automation failed: ${err.message}`;
            }
          } else result = `Unknown tool: ${name}`;
        } catch (err) {
          result = `Tool error: ${err.message}`;
        }
        chat.push({ role: "tool", tool_call_id: call.id, content: String(result).slice(0, 4000) });
      }
      if (round === maxRounds - 1) {
        chat.push({ role: "user", content: "Please give your final answer now based on the tool results." });
      }
    }
  } catch (err) {
    return { reply: err.message || "All AI providers failed.", lang: "en", model: modelUsed || "n/a", error: true };
  }

  if (!reply) reply = "Sorry, I could not produce an answer.";

  const wsFiles = snapshot();
  if (wsFiles.length === 0) {
    const fenceRe = /```(?:javascript|js|node)?\s*([\s\S]*?)```/gi;
    let m;
    let idx = 0;
    while ((m = fenceRe.exec(reply)) !== null && codeFiles.length < 3) {
      const code = m[1].trim();
      if (code.length > 8) codeFiles.push({ filename: `solution_${++idx}.js`, language: "javascript", code });
    }
  }

  return { reply, lang: "en", model: modelUsed, provider: providerUsed, tools: usedTools, codeFiles, files, workspace: wsFiles };
}

export { runAgent, TOOLS };
