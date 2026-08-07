import { groqChat, extractMemory, lastUserLang } from "@/lib/groq";
import { runAgent } from "@/lib/agent";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const memory = Array.isArray(body.memory) ? body.memory : [];
    const image = typeof body.image === "string" ? body.image : null;

    const last = messages[messages.length - 1];
    const userText =
      typeof last?.content === "string" ? last.content : "Say hello";
    if (!userText.trim()) return Response.json({ error: "empty" }, { status: 400 });

    const lang = lastUserLang(messages);

    if (image || messages.some((m) => m.image)) {
      const { reply, usedModel } = await groqChat({ messages, image, memory });
      if (!reply) {
        return Response.json(
          { error: "Groq is rate-limited or unreachable right now. Try again in a minute." },
          { status: 503 }
        );
      }
      const newFacts = await extractMemory(userText, reply);
      return Response.json({ reply, lang, memory: newFacts, model: usedModel });
    }

    const result = await runAgent({ messages, memory, creds: body.creds || {} });
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
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
