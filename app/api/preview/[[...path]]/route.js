import { all, listFiles } from "@/lib/workspace";
import { ownerFromRequest } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 15;

const MIME = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  wasm: "application/wasm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pdf: "application/pdf",
  zip: "application/zip",
};

function find(files, rel) {
  const wanted = rel === "" || rel === "/" ? "index.html" : rel;
  const direct = files.find((f) => f.name === wanted);
  if (direct) return direct;
  if (rel === "" || rel === "/") {
    return files.find((f) => /^index\.html?$/i.test(f.name)) || files.find((f) => f.name.toLowerCase().endsWith(".html"));
  }
  return null;
}

export async function GET(req, { params }) {
  try {
    const { path } = await params;
    const rel = Array.isArray(path) ? path.join("/") : "";
    const url = new URL(req.url);
    const qToken = url.searchParams.get("t") || "";
    const auth = req.headers.get("authorization") || "";
    const hdrToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const effective = qToken || hdrToken;
    const owner = await ownerFromRequest({ headers: new Headers(effective ? { Authorization: `Bearer ${effective}` } : {}) });

    const files = listFiles(owner);
    const found = find(files, rel);
    if (!found) return Response.json({ error: "not found" }, { status: 404 });

    const entry = all(owner).find((f) => f.name === found.name);
    let code = entry ? entry.code : "";
    const ext = found.name.split(".").pop().toLowerCase();
    let ct = MIME[ext] || "application/octet-stream";
    if (ext === "html" || ext === "htm") {
      const base = `<base href="/api/preview/">`;
      code = /<head[^>]*>/i.test(code) ? code.replace(/<head[^>]*>/i, (h) => `${h}${base}`) : base + code;
      ct = "text/html; charset=utf-8";
    }
    return new Response(code, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "no-store",
        "X-Frame-Options": "SAMEORIGIN",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
