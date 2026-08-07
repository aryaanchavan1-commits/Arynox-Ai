import { runCode } from "@/lib/runner";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const code = String(body.code || "").trim();
    if (!code) return Response.json({ error: "empty code" }, { status: 400 });
    const language = String(body.language || "javascript");
    const result = await runCode(code, language);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
