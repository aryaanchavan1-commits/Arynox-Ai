import { uploadFile } from "@/lib/hedra";

export const maxDuration = 120;
export const runtime = "nodejs";

const LIMIT = 10 * 1024 * 1024; // 10 MB

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "no file uploaded" }, { status: 400 });
    }
    if (file.size > LIMIT) {
      return Response.json({ error: "file too large (max 10 MB)" }, { status: 413 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(buf, file.name || "upload.bin", file.type || "application/octet-stream");
    return Response.json({ url: result.url, asset_id: result.asset_id });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 400) }, { status: 502 });
  }
}