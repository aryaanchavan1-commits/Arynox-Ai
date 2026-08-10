import { groqChat } from "@/lib/groq";
import { cfg } from "@/lib/config";

export const maxDuration = 60;
export const runtime = "nodejs";

const waCfg = () => ({ verify: cfg("WHATSAPP_VERIFY_TOKEN"), token: cfg("WHATSAPP_TOKEN"), phone: cfg("WHATSAPP_PHONE_ID") });

export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const { verify } = waCfg();
  if (mode === "subscribe" && token && verify && token === verify) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("verification failed", { status: 403 });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("ok");
  }
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const text = message?.text?.body;
  const from = message?.from;
  const { token, phone } = waCfg();
  if (text && from && token && phone) {
    void handle(text, from);
  }
  return new Response("ok");
}

async function handle(text, from) {
  try {
    const { reply } = await groqChat({
      messages: [
        { role: "system", content: "You are Arynox AI on WhatsApp. Reply in the same language the user used (English, Hindi or Marathi). Keep answers short (under 300 characters), warm and helpful." },
        { role: "user", content: String(text).slice(0, 2000) },
      ],
      image: null,
      memory: [],
    });
    await send(from, reply || "Sorry, I could not answer right now. Try again in a minute.");
  } catch {}
}

async function send(to, message) {
  const { token, phone } = waCfg();
  const res = await fetch(`https://graph.facebook.com/v21.0/${phone}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: String(message).slice(0, 1600) } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("WhatsApp send failed:", res.status, t.slice(0, 300));
  }
}
