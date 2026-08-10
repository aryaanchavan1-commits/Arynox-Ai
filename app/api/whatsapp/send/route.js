import { cfg } from "@/lib/config";

export const maxDuration = 30;
export const runtime = "nodejs";

const waCfg = () => ({ token: cfg("WHATSAPP_TOKEN"), phone: cfg("WHATSAPP_PHONE_ID") });

export async function POST(req) {
  try {
    const body = await req.json();
    const to = String(body.to || "").replace(/[^0-9]/g, "");
    const message = String(body.message || "").slice(0, 1600);
    if (!to || !message) return Response.json({ error: "phone + message required" }, { status: 400 });
    const { token, phone } = waCfg();
    if (!token || !phone) {
      return Response.json(
        { error: "WHATSAPP_TOKEN / WHATSAPP_PHONE_ID not configured", waLink: `https://wa.me/${to}?text=${encodeURIComponent(message)}` },
        { status: 503 }
      );
    }
    const res = await fetch(`https://graph.facebook.com/v21.0/${phone}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message } }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return Response.json({ error: (data.error?.message || "WhatsApp send failed").slice(0, 300) }, { status: 500 });
    return Response.json({ ok: true, waId: data.messages?.[0]?.id || "" });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
