import { buildXlsx, buildCsv, buildDocx } from "@/lib/office";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const type = String(body.type || "");
    const name = String(body.name || "file").replace(/[\\/:*?"<>|]/g, "_");
    let buffer;
    let mime;
    if (type === "xlsx") {
      buffer = await buildXlsx(body.rows || [["A", "B"]], body.sheet || "Sheet1");
      mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (type === "csv") {
      buffer = Buffer.from(buildCsv(body.rows || [["A", "B"]]), "utf-8");
      mime = "text/csv";
    } else if (type === "docx") {
      buffer = await buildDocx(body.text || "");
      mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else {
      return Response.json({ error: "unsupported type" }, { status: 400 });
    }
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${name}.${type}"`,
      },
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
