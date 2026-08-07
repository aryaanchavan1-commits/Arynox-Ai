import { parseFile } from "@/lib/office";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file) return Response.json({ error: "no file" }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseFile(buffer, file.type || "", file.name || "");
    return Response.json({ name: file.name, text: text.slice(0, 50000) });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
