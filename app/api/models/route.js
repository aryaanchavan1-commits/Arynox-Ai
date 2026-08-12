import { listModels } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    const models = await listModels();
    return Response.json({ models });
  } catch (err) {
    return Response.json({ models: [], error: String(err?.message || err) }, { status: 500 });
  }
}
