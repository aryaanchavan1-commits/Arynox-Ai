# Arynox AI

A production-ready, trilingual AI assistant web app — built by **Arynox Tech**. Chat, voice, vision, image generation, a built-in project IDE with **real Python execution**, live camera object detection, n8n-style automations (GitHub / Gmail / MCP / HTTP), and full office-file (Excel / CSV / Word) creation & parsing. Works in **English, हिन्दी and मराठी**, with automatic **day/night themes**, **auto model routing** and a **24/7 keep-alive** (GitHub Actions cron) so the backend never sleeps.

## Features

- **💬 Trilingual chat** — English, Hindi, Marathi. Automatic language detection; replies come back in your language.
- **🧠 Intent detection** — the AI figures out what you want automatically: code projects, image generation, office files, live web research or plain chat — no mode switching needed.
- **🔬 Deep research** — a `deep_research` agent tool expands your question into multiple searches, reads full pages via the **Exa API** and returns a cited dossier with numbered sources.
- **🎤 Voice** — speech-to-text (whisper) and text-to-speech (Google TTS, per-language).
- **📷 Vision + autonomous work** — attach a photo and the AI first *sees* it (Groq qwen vision), then the agent can analyze it, extract data into Excel/CSV/PDF, or write code about it.
- **✨ Image generation** — Pollinations flux (enhanced, stable seeded) with a turbo / flux-anime fallback chain; the chat agent can also generate images (`create_image`) and shows them inline.
- **💻 Built-in IDE** — multi-file projects (JS + Python), run in a sandbox (Node `vm` + real Python 3), live console output, syntax highlighting, download as ZIP.
- **📁 Project upload** — upload an entire project folder from the IDE tab; the agent explores it (list/read), fixes, extends and verifies it autonomously.
- **👁 See tab** — live camera object detection every 3 s, friendly chips + icons, nothing stored.
- **⚡ Automate tab** — n8n-style actions: GitHub search/issues/create, Gmail send (app password), remote MCP servers (streamable HTTP), generic HTTP calls; credentials saved locally.
- **📄 Office files** — agent creates styled `.xlsx`, `.csv`, `.docx` **and multi-page `.pdf` reports** (headings, bullets, page numbers) as downloadable chips; upload files (Excel/CSV/TXT/Word/**PDF**) to parse them back into chat.
- **🧠 Long-term memory** — facts auto-extracted from conversation, stored in the browser.
- **🤖 Auto model routing** — quota-aware chain: Cerebras `gpt-oss-120b` → `zai-glm-4.7` → Groq `llama-3.3-70b-versatile` → `llama-3.1-8b-instant` → OpenCode free models (`laguna-s-2.1-free`, `nemotron-3-ultra-free`, `longcat-2.0-free`). Vision & STT use Groq qwen / whisper.
- **⏰ 24/7 keep-alive** — GitHub Actions pings the backend every 10 minutes (`keepalive.yml`) so Render free never sleeps; the app also self-pings while open.
- **🌗 Day/night themes** — auto-switches at 06:00 / 18:00, or manual light/dark; fully responsive mobile layout (bottom nav rail), installable as a PWA (manifest).
- **🔐 Accounts** — sign in / sign up with email + password or Google (Supabase Auth). Per-user workspaces: every user's files are isolated server-side; guests share a private temp workspace.
- **🏨 Concierge mode** — business owners (hotels, resorts, restaurants) fill a small profile in the Automate tab and the AI becomes their guest assistant: Marathi/Hindi/English replies, booking request forms (`bookings.xlsx`), invoices, budgets and PDF itineraries.
- **💬 WhatsApp bot** — webhook endpoint (`/api/whatsapp`) that answers in the user's language; enable by setting the three WhatsApp env vars below.

## Getting started

```bash
npm install
cp .env.example .env   # fill in keys
npm run dev            # http://localhost:3000
```

## Environment variables

All keys are stored in Vercel / Render env config (and `.env` locally — never committed):

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Chat fallback, vision (qwen), STT (whisper-large-v3-turbo) |
| `CEREBRAS_API_KEY` | Primary chat model (`gpt-oss-120b`, best Hindi; no vision) |
| `EXA_API_KEY` | Web search + page fetch tool |
| `OPENCODE_API_KEY` | Free-model fallback tier via `https://opencode.ai/zen/v1` |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` | Auth (email/password + Google OAuth); secret key server-side only |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same values, client bundle |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` / `WHATSAPP_VERIFY_TOKEN` | WhatsApp Business Cloud API bot (set these to turn the bot on) |

## Getting credentials (for users)

The **Automate tab in the app** contains a built-in step-by-step guide for every credential below (open it with the "📘 How to get credentials" card). Summary:

| Integration | What it unlocks | Where to get it |
| --- | --- | --- |
| GitHub token | Search repos, list/create issues from chat | https://github.com/settings/tokens → "Generate new token (classic)"; scopes: `repo` (or fine-grained with Issues/Contents Read+Write) |
| Gmail App Password | Send emails (reports, invoices, bookings) | https://myaccount.google.com/apppasswords — requires 2-Step Verification ON; never use your normal password |
| MCP servers | AI calls tools from other apps (DBs, Slack, Notion, Google Drive...) | https://smithery.ai — copy a server's *streamable HTTP* URL, add it in Automate → "＋ Add server" |
| WhatsApp Cloud API | WhatsApp bot replies to guests in Marathi/Hindi/English | Meta developer account → create app → WhatsApp → API Setup; then the owner sets `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` and wires the webhook `https://your-domain/api/whatsapp` (guide: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) |
| AI keys (Groq/Cerebras/Exa/OpenCode) | Chat, deep research, voice — **no user action**; configured server-side by the app owner | From each provider dashboard; only needed if you self-host |

WhatsApp webhook details: Meta → WhatsApp → Configuration → Webhook → Callback URL `https://your-domain.com/api/whatsapp`, Verify token = the same `WHATSAPP_VERIFY_TOKEN` string you chose, and subscribe to the **messages** field.

### Enabling Google sign-in (one time)

The **🔵 Continue with Google** button needs a one-time owner setup (the in-app guide in Automate → "Google sign-in" mirrors these steps):

1. Google Cloud console → APIs & Services → Credentials → **Create OAuth client ID** → Web application.
2. Authorized JavaScript origins: `https://your-domain.com` (+ `http://localhost:3000` for dev).
3. Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback` (Supabase handles the handshake).
4. Copy the Client ID + Secret into Supabase dashboard → Authentication → Sign In / Up → **Providers → Google → Enable**.
5. Supabase → Authentication → URL Configuration: set Site URL to your domain and add `https://your-domain.com` to Redirect URLs.

## SEO (Maharashtra, India)

The app ships with full local SEO: `lang="en-IN"`, geo meta tags (Ratnagiri, Maharashtra), Open Graph + Twitter cards, `sitemap.xml`, robots.txt with sitemap, PWA manifest (`en-IN`), and JSON-LD `SoftwareApplication` + `Organization` (Arynox Tech, Maharashtra, India) structured data. The home page targets keywords like "Marathi AI assistant", "AI for hotels India" and "Konkan AI".

## Architecture

- **Frontend + API**: Next.js 15 (App Router) — single deployable. `app/page.jsx` is the whole client UI; `app/api/*` are serverless routes.
- **Chat agent**: `lib/agent.js` — tool loop (web_search, get_url, run_code, create_excel/csv/docx, gmail_send, github_*, http_call, mcp_call) returning `codeFiles` (for IDE) and `files` (base64 downloads).
- **Providers**: `lib/providers.js` (chain + quota detection), `lib/groq.js` (vision/STT/memory), `lib/opencode.js`-style fallbacks inside the chain.
- **Sandbox**: `lib/runner.js` — Node `vm` with 8 s timeout, custom console capture, async IIFE; Python via real interpreter (`python3 -c`, 8 s timeout, 60 KB output cap).
- **Intent routing**: `lib/intent.js` — regex classifier decides image / office / code / research / chat before the agent runs.
- **Storage**: browser `localStorage` (memory, history, project, theme, credentials) + Supabase Auth (user identity). Per-user workspaces are server-side in-memory maps keyed by user id; guests share `__guest__`.
- **Security**: no secrets in client bundle; credentials sent only to the user's own browser-stored config on automation calls; outbound calls server-side only. JWT is verified against Supabase on every `/api/chat`, `/api/workspace` and `/api/upload-project` request; invalid/absent tokens fall back to the guest workspace.
- **Keep-alive**: `.github/workflows/keepalive.yml` pings `/api/ping` on Render + Vercel every 10 minutes.

## Deployment

### Vercel (frontend + proxy)

```bash
vercel --prod   # or connect the GitHub repo
# set env: GROQ_API_KEY, EXA_API_KEY, CEREBRAS_API_KEY, OPENCODE_API_KEY,
# SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY,
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# plus API_ORIGIN=https://arynox-ai.onrender.com (proxies every /api/* call to Render)
```

### Render (backend/API service)

```bash
# New Web Service → connect the Arynox-Ai repo
# Build: npm install && npm run build
# Start: npm start
# Set the same 4+6 env vars (API_ORIGIN must stay UNSET here).
# For the WhatsApp bot, add WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN on both hosts.
```
