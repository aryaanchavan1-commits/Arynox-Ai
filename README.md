# Arynox AI

A production-ready, trilingual AI assistant web app — built by **Arynox Tech**. Chat, voice, vision, image generation, a built-in project IDE, live camera object detection, n8n-style automations (GitHub / Gmail / MCP / HTTP), and full office-file (Excel / CSV / Word) creation & parsing. Works in **English, हिन्दी and मराठी**, with automatic **day/night themes** and **auto model routing**.

## Features

- **💬 Trilingual chat** — English, Hindi, Marathi. Automatic language detection; replies come back in your language.
- **🎤 Voice** — speech-to-text (whisper) and text-to-speech (Google TTS, per-language).
- **📷 Vision** — attach a photo, the AI describes/analyzes it (qwen vision via Groq).
- **✨ Image generation** — Pollinations (flux / turbo / flux-anime fallback chain) with double-verified URLs.
- **💻 Built-in IDE** — multi-file projects, run in a sandbox, live console output, download as ZIP.
- **👁 See tab** — live camera object detection every 3 s, friendly chips + icons, nothing stored.
- **⚡ Automate tab** — n8n-style actions: GitHub search/issues/create, Gmail send (app password), remote MCP servers (streamable HTTP), generic HTTP calls; credentials saved locally.
- **📊 Office files** — agent creates styled `.xlsx`, `.csv`, `.docx` and returns downloadable chips; upload files to parse them back into chat.
- **🧠 Long-term memory** — facts auto-extracted from conversation, stored in the browser.
- **🤖 Auto model routing** — quota-aware chain: Cerebras `gpt-oss-120b` → `zai-glm-4.7` → Groq `llama-3.3-70b-versatile` → `llama-3.1-8b-instant` → OpenCode free models (`laguna-s-2.1-free`, `nemotron-3-ultra-free`, `longcat-2.0-free`). Vision & STT use Groq qwen / whisper.
- **🌗 Day/night themes** — auto-switches at 06:00 / 18:00, or manual light/dark; fully responsive mobile layout (bottom nav rail).

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

## Architecture

- **Frontend + API**: Next.js 15 (App Router) — single deployable. `app/page.jsx` is the whole client UI; `app/api/*` are serverless routes.
- **Chat agent**: `lib/agent.js` — tool loop (web_search, get_url, run_code, create_excel/csv/docx, gmail_send, github_*, http_call, mcp_call) returning `codeFiles` (for IDE) and `files` (base64 downloads).
- **Providers**: `lib/providers.js` (chain + quota detection), `lib/groq.js` (vision/STT/memory), `lib/opencode.js`-style fallbacks inside the chain.
- **Sandbox**: `lib/runner.js` — Node `vm` with 8 s timeout, custom console capture, async IIFE.
- **Storage**: browser `localStorage` (memory, history, project, theme, credentials). Nothing personal is uploaded.
- **Security**: no secrets in client bundle; credentials sent only to the user's own browser-stored config on automation calls; outbound calls server-side only.

## Deployment

### Vercel

```bash
vercel --prod   # or connect the GitHub repo
# set env: GROQ_API_KEY, EXA_API_KEY, CEREBRAS_API_KEY, OPENCODE_API_KEY
```

### Render (backend/API service)

```bash
# New Web Service → connect the Arynox-Ai repo
# Build: npm install && npm run build
# Start: npm start
# Set the same 4 env vars
```
