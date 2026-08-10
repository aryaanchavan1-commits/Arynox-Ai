import { runAgent } from "@/lib/agent";
import { ownerFromRequest, getUserFromToken } from "@/lib/supabase";
import { writeFile, snapshot, tree } from "@/lib/workspace";
import { isBlocked, trackUser } from "@/lib/access";

export const maxDuration = 90;
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const owner = await ownerFromRequest(req);
    const auth = req.headers.get("authorization") || "";
    const me = auth.startsWith("Bearer ") ? await getUserFromToken(auth.slice(7).trim()) : null;
    if (me?.email && isBlocked(me.email)) {
      return Response.json({ error: "Your access is blocked. Contact the app owner." }, { status: 403 });
    }
    if (me?.email) trackUser(me.email, me.name);
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages.filter((m) => m && m.role && typeof m.content === "string") : [];
    const files = Array.isArray(body?.files) ? body.files.filter((f) => f && f.name) : [];

    if (!messages.length) return Response.json({ error: "Nothing to ask the agent." }, { status: 400 });

    // Production-build guidance: push the agent toward real project structure for build requests.
    const last = messages[messages.length - 1];
    if (/(app|website|web app|project|build|create|todo|dashboard|blog|store|shop|game|portfolio|landing|cms|tool|portal|system)/i.test(last.content)) {
      last.content =
        last.content +
        "\n\nPROJECT STANDARDS — follow these when building:" +
        "\n1) Use a real folder structure: index.html at the root; src/ (or components/) for JS/CSS modules; assets/ for media; backend/ for Python files if needed." +
        "\n2) Keep files focused and small; split big features into separate files instead of one huge file." +
        "\n3) Create a README.md that explains what the project is and how to run it." +
        "\n4) Add graceful error handling and make the UI responsive (mobile + desktop)." +
        "\n5) Verify your code by running it with run_code and fix any errors before finishing." +
        "\n6) At the end, list the final file paths you created (e.g. - index.html, - src/styles.css, - src/app.js).";
    }

    // Sync the current IDE files into the agent workspace so it sees the live project.
    for (const f of files) {
      try { writeFile(String(f.name).slice(0, 120), String(f.code || ""), owner); } catch {}
    }

    const result = await runAgent({
      messages,
      memory: [],
      creds: {},
      owner,
      business: null,
    });

    return Response.json({
      reply: result.reply || "",
      workspace: snapshot(owner) || [],
      tools: result.tools || [],
      changed: files.filter((f) => {
        const ws = (snapshot(owner) || []).find((w) => w.name === f.name);
        return !ws || ws.code !== f.code;
      }).map((f) => f.name),
      error: result.error ? true : false,
    });
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
