import { groqChat, extractMemory, lastUserLang } from "@/lib/groq";
import { runAgent } from "@/lib/agent";
import { ownerFromRequest, getUserFromToken } from "@/lib/supabase";
import { isBlocked, trackUser } from "@/lib/access";

export const maxDuration = 60;
export const runtime = "nodejs";

function buildSuggestions(lastUserText, tools = []) {
  const t = String(lastUserText || "").trim().replace(/[?!.।]+$/g, "").slice(0, 80);
  const words = t.split(/\s+/).filter(Boolean);
  const topic = words.length > 3 ? words.slice(-3).join(" ") : t;
  const names = tools.map((x) => x.name || "");
  if (names.some((n) => n === "deep_research" || n === "web_search")) {
    return [
      `Find the very latest updates on: ${topic}`,
      "Summarize this into 5 bullet points",
      "Translate this to मराठी",
    ];
  }
  if (names.some((n) => ["run_code", "write_file", "edit_file", "create_excel", "create_pdf", "create_docx"].includes(n))) {
    return [
      "Explain exactly what you just built",
      "Add a new feature to it",
      "Test it with edge cases and fix issues",
    ];
  }
  return [
    topic ? `Tell me more about ${topic}` : "Give me an example",
    "Summarize the main points",
    "Translate this to हिन्दी",
  ];
}

export async function POST(req) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const memory = Array.isArray(body.memory) ? body.memory : [];
    const image = typeof body.image === "string" ? body.image : null;
    const business = body.business && typeof body.business === "object" ? body.business : null;

    const last = messages[messages.length - 1];
    const userText =
      typeof last?.content === "string" ? last.content : "Say hello";
    if (!userText.trim()) return Response.json({ error: "empty" }, { status: 400 });

    const lang = lastUserLang(messages);
    const owner = await ownerFromRequest(req);
    const auth = req.headers.get("authorization") || "";
    const me = auth.startsWith("Bearer ") ? await getUserFromToken(auth.slice(7).trim()) : null;
    if (me?.email && isBlocked(me.email)) {
      return Response.json({ error: "Your access is blocked. Contact the app owner." }, { status: 403 });
    }
    if (me?.email) trackUser(me.email, me.name);

    const agentParams = { messages, memory, creds: body.creds || {}, owner, business };

    if (image) {
      const vis = await groqChat({ messages, image, memory });
      if (!vis.reply) {
        return Response.json(
          { error: "Groq is rate-limited or unreachable right now. Try again in a minute." },
          { status: 503 }
        );
      }
      try {
        const augmented = [
          ...messages,
          { role: "user", content: `[The user attached the image shown above. Vision analysis of it (treat as ground truth): "${String(vis.reply).slice(0, 3000)}"]` },
        ];
        const result = await runAgent({ ...agentParams, messages: augmented });
        if (result.reply && !result.error) {
          const newFacts = await extractMemory(userText, result.reply);
          return Response.json({
            reply: result.reply,
            lang: result.lang || lang,
            memory: newFacts,
            model: result.model,
            provider: result.provider || "",
            tools: result.tools || [],
            codeFiles: result.codeFiles || [],
            files: result.files || [],
            workspace: result.workspace || [],
            suggestions: buildSuggestions(userText, result.tools),
          });
        }
      } catch {}
      const newFacts = await extractMemory(userText, vis.reply);
      return Response.json({ reply: vis.reply, lang, memory: newFacts, model: vis.usedModel, provider: "groq", suggestions: buildSuggestions(userText, []) });
    }

    const result = await runAgent(agentParams);
    if (result.error && !result.reply) {
      return Response.json({ error: result.error }, { status: 500 });
    }
    const newFacts = await extractMemory(userText, result.reply);
    return Response.json({
      reply: result.reply,
      lang: result.lang || lang,
      memory: newFacts,
      model: result.model,
      provider: result.provider || "",
      tools: result.tools || [],
      codeFiles: result.codeFiles || [],
      files: result.files || [],
      workspace: result.workspace || [],
      suggestions: buildSuggestions(userText, result.tools),
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
