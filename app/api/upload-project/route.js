import { clear, writeFile, all } from "@/lib/workspace";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) return Response.json({ error: "no files" }, { status: 400 });
    clear();
    let ok = 0;
    const errors = [];
    for (const f of files) {
      try {
        writeFile(f.name || "file.txt", String(f.code ?? ""));
        ok++;
      } catch (err) {
        errors.push(`${f.name}: ${err.message}`);
      }
    }
    return Response.json({ ok, errors, files: all() });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
