"use client";

import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import JSZip from "jszip";
import { classify } from "@/lib/intent";

const KEY = { memory: "arynox_memory", history: "arynox_history", project: "arynox_project", theme: "arynox_theme", creds: "arynox_creds" };
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const GEN_RE = /\b(generate|create|draw|make|imagine|render|picture|image|photo|art of|बनाओ|बना|तस्वीर|चित्र|ड्रा|छवि)\b/i;
const DEFAULT_PROJECT = [
  { name: "main.js", code: "// Welcome to Arynox IDE!\n// Write JavaScript, press Run, and watch the output.\n\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet(\"Aryan\"));\n" },
];

function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function md(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/^[-•] (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "<br/>");
}
function parseBlocks(content) {
  const parts = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push({ type: "text", html: md(content.slice(last, m.index)) });
    parts.push({ type: "code", language: m[1] || "javascript", code: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ type: "text", html: md(content.slice(last)) });
  return parts.length ? parts : [{ type: "text", html: md(content) }];
}
const TOOL_ICONS = { web_search: "🔎", get_url: "📄", run_code: "⚙", write_file: "📝", read_file: "📖", edit_file: "✏️", list_files: "🗂", delete_file: "🗑", create_excel: "📊", create_csv: "📄", create_docx: "📝", gmail_send: "✉️", github_search: "🐙", github_issues: "🐙", github_create_issue: "🐙", http_call: "🌐", mcp_call: "🔌", mcp_list_tools: "🔌" };
const OBJECT_ICONS = {
  person: "🧍", human: "🧍", man: "🧍", woman: "🧍", people: "🧍",
  laptop: "💻", computer: "💻", phone: "📱", smartphone: "📱",
  bottle: "🍾", cup: "☕", mug: "☕", water: "🥤", drink: "🥤",
  chair: "🪑", table: "🪑", desk: "🪑", sofa: "🛋",
  dog: "🐶", cat: "🐱", bird: "🐦", pet: "🐾",
  book: "📚", paper: "📄", notebook: "📓",
  window: "🪟", door: "🚪", wall: "🧱",
  tv: "📺", screen: "🖥", monitor: "🖥",
  keyboard: "⌨", mouse: "🖱", remote: "🎛",
  bag: "🎒", backpack: "🎒", shoes: "👟",
  clock: "🕐", watch: "⌚", lamp: "💡", light: "💡",
  car: "🚗", vehicle: "🚗", bicycle: "🚲",
  plant: "🪴", flower: "🌸", tree: "🌳",
};

export default function Home() {
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [memory, setMemory] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [image, setImage] = useState(null);
  const [genMode, setGenMode] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [status, setStatus] = useState("ready");
  const [modelBadge, setModelBadge] = useState("");
  const [showMemory, setShowMemory] = useState(false);
  const [newFact, setNewFact] = useState("");
  const [theme, setTheme] = useState(() => load(KEY.theme, "auto"));
  const [creds, setCreds] = useState(() => load(KEY.creds, { githubToken: "", gmailUser: "", gmailPass: "", mcpUrl: "", mcpToken: "", mcpServers: [] }));
  const [mcpInfo, setMcpInfo] = useState([]);
  const [mcpBusy, setMcpBusy] = useState(false);
  const [autoLog, setAutoLog] = useState([]);
  const [autoRunning, setAutoRunning] = useState("");
  const [busyStep, setBusyStep] = useState(0);

  const BUSY_STEPS = ["Thinking…", "Working…", "Researching…", "Coding…", "Running…", "Finalizing…"];
  useEffect(() => {
    if (!busy) { setBusyStep(0); return; }
    const iv = setInterval(() => setBusyStep((s) => (s + 1) % BUSY_STEPS.length), 2600);
    return () => clearInterval(iv);
  }, [busy]);

  const [project, setProject] = useState(() => load(KEY.project, DEFAULT_PROJECT));
  const [activeFile, setActiveFile] = useState(0);
  const [runOut, setRunOut] = useState("");
  const [running, setRunning] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const [camOn, setCamOn] = useState(false);
  const [objects, setObjects] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [detectPaused, setDetectPaused] = useState(false);

  const audioRef = useRef(null);
  const endRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const fileRef = useRef(null);
  const officeRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectTimer = useRef(null);

  const effectiveTheme = theme === "auto" ? (hour() < 6 || hour() >= 18 ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    const iv = setInterval(() => {
      if (theme === "auto") document.documentElement.dataset.theme = hour() < 6 || hour() >= 18 ? "dark" : "light";
    }, 600000);
    return () => clearInterval(iv);
  }, [theme, effectiveTheme]);

  useEffect(() => { setMemory(load(KEY.memory, [])); setMessages(load(KEY.history, [])); }, []);
  useEffect(() => {
    const ping = () => { try { fetch("/api/ping").catch(() => {}); } catch {} };
    ping();
    const iv = setInterval(ping, 540000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => () => { stopCamera(); }, []);

  const persist = (msgs) => { setMessages(msgs); save(KEY.history, msgs.slice(-40).map((m) => ({ role: m.role, content: m.content, lang: m.lang }))); };

  const setCred = (k, v) => setCreds((prev) => { const next = { ...prev, [k]: v }; save(KEY.creds, next); return next; });

  const speak = async (text, lang) => {
    if (!text) return;
    try {
      audioRef.current?.pause();
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang: lang || "en" }) });
      if (!res.ok) return;
      const url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: "audio/mpeg" }));
      const a = new Audio(url);
      audioRef.current = a;
      await a.play();
    } catch {}
  };

  const addMemory = (fact) => {
    const f = (fact || "").trim();
    if (!f) return;
    setMemory((prev) => { const next = prev.includes(f) ? prev : [...prev, f]; save(KEY.memory, next); return next; });
  };
  const removeMemory = (fact) => setMemory((prev) => { const next = prev.filter((m) => m !== fact); save(KEY.memory, next); return next; });

  const download = (name, content, type = "application/octet-stream") => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const downloadBase64 = (name, type, b64) => download(name, Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), type);

  const downloadProject = async () => {
    const zip = new JSZip();
    project.forEach((f) => zip.file(f.name, f.code));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "arynox-project.zip"; a.click();
    URL.revokeObjectURL(url);
  };

  const runCode = async (code, label) => {
    setRunning(true);
    setRunOut(`▶ Running ${label || "code"}...`);
    try {
      const language = (label || "").toLowerCase().endsWith(".py") ? "python" : "javascript";
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, language }) });
      const d = await res.json();
      if (!res.ok) { setRunOut("Error: " + (d.error || "run failed")); return; }
      const parts = [];
      if (d.error) parts.push("⛔ " + d.error);
      if (d.output) parts.push(d.output);
      if (!d.output && !d.error) parts.push("✓ Finished (no console output)");
      if (d.durationMs) parts.push("\n⏱ " + d.durationMs + " ms");
      setRunOut(parts.join("\n"));
    } catch (err) { setRunOut("Error: " + err.message); }
    finally { setRunning(false); }
  };

  const runProject = async () => {
    setRunning(true);
    setRunOut("▶ Running project...");
    try {
      const out = [];
      for (const f of project) {
        const language = f.name.toLowerCase().endsWith(".py") ? "python" : "javascript";
        out.push(`— ${f.name} (${language}) —`);
        const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: f.code, language }) });
        const d = await res.json();
        if (d.error) out.push("⛔ " + d.error);
        if (d.output) out.push(d.output);
        out.push("");
      }
      setRunOut(out.join("\n") || "✓ Finished (no output)");
    } catch (err) { setRunOut("Error: " + err.message); }
    finally { setRunning(false); }
  };

  const langOf = (name) => (name || "").toLowerCase().endsWith(".py") ? python() : javascript();

  const setFileCode = (i, code) => setProject((prev) => { const next = prev.map((f, j) => (j === i ? { ...f, code } : f)); save(KEY.project, next); return next; });

  const addFile = () => {
    const name = (newFileName.trim() || "new-file.js").replace(/[^a-zA-Z0-9._-]/g, "_");
    setProject((prev) => { const next = [...prev, { name, code: "// " + name + "\n\n" }]; save(KEY.project, next); return next; });
    setActiveFile(project.length);
    setNewFileName("");
  };
  const deleteFile = (i) => {
    if (project.length === 1) return;
    setProject((prev) => { const next = prev.filter((_, j) => j !== i); save(KEY.project, next); return next; });
    setActiveFile((a) => Math.min(a, project.length - 2));
  };
  const renameFile = (i, name) => setProject((prev) => { const next = prev.map((f, j) => (j === i ? { ...f, name } : f)); save(KEY.project, next); return next; });

  const runAutomation = async (action, params) => {
    setAutoRunning(action);
    setAutoLog((prev) => [...prev, `▶ ${action}...`]);
    try {
      const res = await fetch("/api/automation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, params, creds }) });
      const d = await res.json();
      setAutoLog((prev) => [...prev, res.ok && d.ok ? `✓ ${d.result}` : `✗ ${d.error || res.status}`]);
      if (res.ok && d.ok) speak(d.result.slice(0, 300), "en");
    } catch (err) { setAutoLog((prev) => [...prev, "✗ " + err.message]); }
    finally { setAutoRunning(""); }
  };

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    setInput("");
    const gen = genMode || classify(text) === "image";
    const userMsg = { role: "user", content: text, image };
    const history = [...messages, userMsg];
    persist(history);
    setImage(null);
    setBusy(true);
    setStatus(gen ? "creating your image..." : "thinking...");

    if (gen) {
      const prompt = genMode ? text.replace(GEN_RE, "").trim() || text : text.replace(/^(generate|create|draw|make|imagine|render|show|give)\s+(me\s+)?/i, "").trim().replace(/[.!?]+$/, "") || text;
      try {
        const res = await fetch("/api/gen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, width: 1024, height: 1024 }) });
        const d = await res.json();
        if (res.ok) persist([...history, { role: "assistant", content: prompt, image: d.url, lang: "en" }]);
        else persist([...history, { role: "assistant", content: "⚠️ " + (d.error || "Could not create the image."), lang: "en" }]);
      } catch (err) { persist([...history, { role: "assistant", content: "⚠️ Image error: " + err.message, lang: "en" }]); }
      setStatus("ready"); setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.slice(-24), memory, image: image || null, creds }) });
      const data = await res.json();
      if (!res.ok) {
        persist([...history, { role: "assistant", content: data.error || "Something went wrong.", lang: "en" }]);
        setStatus("ready"); setBusy(false);
        return;
      }
      const aiMsg = { role: "assistant", content: data.reply, lang: data.lang || "en", tools: data.tools || [], codeFiles: data.codeFiles || [], files: data.files || [] };
      persist([...history, aiMsg]);
      if (Array.isArray(data.memory) && data.memory.length) {
        setMemory((prev) => { const next = [...prev]; for (const f of data.memory) if (!next.includes(f)) next.push(f); save(KEY.memory, next); return next; });
      }
      setModelBadge(data.model ? `${data.provider || ""} · ${data.model}` : "");
      if (data.codeFiles?.length) {
        setProject((prev) => {
          const names = new Set(prev.map((f) => f.name));
          const next = [...prev];
          for (const cf of data.codeFiles) {
            let n = cf.filename, i = 1;
            while (names.has(n)) { n = cf.filename.replace(".js", `_${i++}.js`); }
            names.add(n);
            next.push({ name: n, code: cf.code });
          }
          save(KEY.project, next);
          return next;
        });
      }
      if (data.workspace?.length) {
        setProject((prev) => {
          const byName = new Map(prev.map((f) => [f.name, f]));
          for (const wf of data.workspace) byName.set(wf.name, { name: wf.name, code: wf.code });
          const next = [...byName.values()];
          save(KEY.project, next);
          return next;
        });
      }
      if (autoSpeak && !data.codeFiles?.length && !data.files?.length) speak(data.reply, data.lang || "en");
    } catch (err) {
      persist([...history, { role: "assistant", content: "Network error: " + err.message, lang: "en" }]);
    } finally { setStatus("ready"); setBusy(false); }
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  const onPickOfficeFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setStatus("reading " + file.name + "...");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: form });
      const d = await res.json();
      const content = res.ok ? d.text : "Could not read the file.";
      await send(`Here is the content of the file "${file.name}" (${file.size} bytes):\n\n${content.slice(0, 8000)}\n\nNow help me with it.`);
    } catch (err) { persist([...messages, { role: "assistant", content: "File error: " + err.message, lang: "en" }]); }
    finally { setBusy(false); setStatus("ready"); }
  };

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => ev.data.size && chunksRef.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1000) { setRecording(false); return; }
        setStatus("listening...");
        try {
          const wav = await webmToWav(blob);
          const form = new FormData();
          form.append("audio", new File([wav], "voice.wav", { type: "audio/wav" }));
          const res = await fetch("/api/stt", { method: "POST", body: form });
          const data = await res.json();
          if (res.ok && data.text) { setInput(data.text); setStatus("ready"); setTimeout(() => send(data.text), 60); }
          else setStatus("could not hear - try again");
        } catch { setStatus("mic error"); }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      setStatus("recording...");
    } catch { setStatus("mic blocked"); setTimeout(() => setStatus("ready"), 1500); }
  };

  const stopRecord = () => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setRecording(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCamOn(true); setObjects([]); setDetectPaused(false);
      setStatus("detecting objects...");
      detectTimer.current = setInterval(detectFrame, 3000);
      detectFrame();
    } catch { setStatus("camera blocked"); setTimeout(() => setStatus("ready"), 2000); }
  };

  const stopCamera = () => {
    setCamOn(false); setObjects([]);
    clearInterval(detectTimer.current);
    detectTimer.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const detectFrame = async () => {
    if (detecting || !camOn || detectPaused) return;
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setDetecting(true);
    try {
      const c = document.createElement("canvas");
      c.width = 640; c.height = 480;
      c.getContext("2d").drawImage(v, 0, 0, 640, 480);
      const res = await fetch("/api/detect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: c.toDataURL("image/jpeg", 0.7) }) });
      const d = await res.json();
      if (res.ok) setObjects(d.objects || []);
    } catch { setDetectPaused(true); setTimeout(() => setDetectPaused(false), 15000); }
    finally { setDetecting(false); }
  };

  const ToolChips = ({ tools }) => {
    if (!tools?.length) return null;
    const names = { web_search: "searched the web", get_url: "read a page", run_code: "ran code", write_file: "wrote a file", read_file: "read a file", edit_file: "edited a file", list_files: "listed files", delete_file: "deleted a file", create_excel: "made an Excel file", create_csv: "made a CSV", create_docx: "made a Word doc", gmail_send: "sent email", github_search: "GitHub", github_issues: "GitHub", github_create_issue: "GitHub", http_call: "HTTP call", mcp_call: "MCP", mcp_list_tools: "MCP tools" };
    return <div className="tool-chips">{tools.map((t, i) => <span className="tool-chip" key={i}>{TOOL_ICONS[t.name] || "🔧"} {names[t.name] || t.name}</span>)}</div>;
  };

  const CodeBlock = ({ code, filename }) => (
    <div className="codeblock">
      <div className="codeblock-head">
        <span className="codeblock-file">{filename || "code"}</span>
        <div className="codeblock-actions">
          <button onClick={() => runCode(code, filename)}>▶ Run</button>
          <button onClick={() => { setProject((prev) => { const names = new Set(prev.map((f) => f.name)); let n = filename || "solution.js", i = 1; while (names.has(n)) { n = (filename || "solution").replace(".js", `_${i++}.js`); } const next = [...prev, { name: n, code }]; save(KEY.project, next); return next; }); setActiveFile(project.length); setTab("ide"); }}>Open in IDE</button>
          <button onClick={() => download(filename || "script.js", code)}>⬇</button>
          <button onClick={() => navigator.clipboard?.writeText(code)}>⧉</button>
        </div>
      </div>
      <pre className="codeblock-body"><code>{code}</code></pre>
    </div>
  );

  const FileChips = ({ files }) => {
    if (!files?.length) return null;
    const icons = { xlsx: "📊", csv: "📄", docx: "📝" };
    return (
      <div className="file-chips">
        {files.map((f, i) => (
          <button key={i} className="file-chip" onClick={() => downloadBase64(f.name, f.type === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : f.type === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/csv", f.dataBase64)}>
            {icons[f.type] || "📎"} {f.name} ⬇
          </button>
        ))}
        {files.length > 1 && (
          <button className="file-chip dl-all" onClick={() => downloadAll(files)}>📦 Download all (ZIP)</button>
        )}
      </div>
    );
  };

  const downloadAll = async (fs) => {
    const zip = new JSZip();
    for (const f of fs) {
      zip.file(f.name, Uint8Array.from(atob(f.dataBase64), (c) => c.charCodeAt(0)));
    }
    const blob = await zip.generateAsync({ type: "blob" });
    download("arynox-files.zip", blob, "application/zip");
  };

  const downloadWorkspace = async () => {
    try {
      const res = await fetch("/api/workspace");
      if (!res.ok) return;
      const blob = await res.blob();
      download("arynox-workspace.zip", blob, "application/zip");
    } catch {}
  };

  const addMcpServer = () => {
    const name = prompt("MCP server name (e.g. my-github):");
    if (!name) return;
    const url = prompt("MCP server URL (streamable HTTP):");
    if (!url) return;
    const token = prompt("Bearer token (optional):", "");
    const next = [...(creds.mcpServers || []), { name: name.trim(), url: url.trim(), token }];
    setCred("mcpServers", next);
  };

  const removeMcpServer = (i) => {
    const next = [...(creds.mcpServers || [])];
    next.splice(i, 1);
    setCred("mcpServers", next);
  };

  const refreshMcp = async () => {
    setMcpBusy(true);
    try {
      const res = await fetch("/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", creds }) });
      const d = await res.json();
      setMcpInfo(res.ok ? d.servers || [] : [{ name: "?", tools: [], error: d.error || "failed" }]);
    } catch (err) { setMcpInfo([{ name: "?", tools: [], error: err.message }]); }
    finally { setMcpBusy(false); }
  };

  const file = project[activeFile] || project[0];

  return (
    <div className="app">
      <nav className="rail">
        <div className="rail-brand">✦<span>Arynox AI</span></div>
        <div className="rail-nav">
          <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>💬<span>Chat</span></button>
          <button className={tab === "ide" ? "active" : ""} onClick={() => setTab("ide")}>💻<span>IDE</span></button>
          <button className={tab === "camera" ? "active" : ""} onClick={() => setTab("camera")}>👁<span>See</span></button>
          <button className={tab === "auto" ? "active" : ""} onClick={() => setTab("auto")}>⚡<span>Automate</span></button>
        </div>
        <div className="rail-foot">
          <button className={showMemory ? "active" : ""} onClick={() => setShowMemory(!showMemory)}>🧠<span>Memory</span></button>
          <button onClick={() => { const next = theme === "light" ? "dark" : theme === "dark" ? "auto" : "light"; setTheme(next); save(KEY.theme, next); }} title="Theme (auto = day/night)">
            {effectiveTheme === "dark" ? "🌙" : "☀️"}<span>{theme === "auto" ? "Auto (day/night)" : effectiveTheme === "dark" ? "Dark" : "Light"}</span>
          </button>
          {modelBadge && <div className="model-badge">{modelBadge}</div>}
        </div>
      </nav>

      {showMemory && (
        <aside className="memory">
          <div className="mem-head"><span>🧠 What I remember about you</span><button className="icon-btn" onClick={() => setShowMemory(false)}>✕</button></div>
          <div className="mem-add">
            <input value={newFact} placeholder="Add something to remember..." onChange={(e) => setNewFact(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { addMemory(newFact); setNewFact(""); } }} />
            <button onClick={() => { addMemory(newFact); setNewFact(""); }}>+</button>
          </div>
          <div className="mem-list">
            {memory.length === 0 && <div className="mem-empty">Nothing remembered yet. Facts are saved automatically as you talk — I never forget.</div>}
            {memory.map((m, i) => (
              <div className="mem-item" key={i}><span>{m}</span><button className="icon-btn" onClick={() => removeMemory(m)}>🗑</button></div>
            ))}
          </div>
          <button className="clear-btn" onClick={() => { setMemory([]); save(KEY.memory, []); }}>Clear all memory</button>
        </aside>
      )}

      <main className="main">
        {tab === "chat" && (
          <>
            <header className="topbar">
              <div className="brand"><span className={`dot ${busy || recording ? "busy" : ""}`} /><span className="status">{recording ? "listening..." : busy ? BUSY_STEPS[busyStep] : status}</span></div>
              <div className="toggles">
                <label className="chip"><input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} /> 🔊 Speak</label>
                <label className={`chip ${genMode ? "on" : ""}`}><input type="checkbox" checked={genMode} onChange={(e) => setGenMode(e.target.checked)} /> ✨ Image mode</label>
                <button className="chip" title="Clear chat" onClick={() => { setMessages([]); save(KEY.history, []); }}>🗑 New chat</button>
              </div>
            </header>

            <div className="chat">
              {messages.length === 0 && (
                <div className="welcome">
                  <div className="welcome-logo">✦</div>
                  <div className="welcome-title">Arynox AI</div>
                  <div className="welcome-sub">Your AI in English, हिन्दी and मराठी<br />I detect what you need — code, images, research, office files — and just do it</div>
                  <div className="sugg-grid">
                    <button className="sugg-card" onClick={() => setInput("Build a calculator app in Python")}><span>🧮</span><div><b>Calculator app</b><em>Python project, run & verify</em></div></button>
                    <button className="sugg-card" onClick={() => setInput("Create a monthly budget in Excel")}><span>📊</span><div><b>Excel budget</b><em>Spreadsheet, ready to download</em></div></button>
                    <button className="sugg-card" onClick={() => setInput("What's today's latest tech news?")}><span>🔎</span><div><b>Live info</b><em>Search the web for answers</em></div></button>
                    <button className="sugg-card" onClick={() => setInput("Draw a futuristic city at night")}><span>🖼️</span><div><b>Generate an image</b><em>Create art on demand</em></div></button>
                    <button className="sugg-card" onClick={() => setInput("Build a to-do app with HTML, CSS and JS")}><span>💻</span><div><b>Web app project</b><em>Multi-file app in your IDE</em></div></button>
                    <button className="sugg-card" onClick={() => setInput("Summarize this file")}><span>📎</span><div><b>Work with files</b><em>Excel, CSV, Word, images</em></div></button>
                  </div>
                  <div className="welcome-hints"><span>🎤 Talk</span><span>📷 Photo</span><span>✨ Image mode</span><span>💻 Code</span><span>⚡ Automate</span></div>
                </div>
              )}
              {messages.map((m, i) => (
                <div className={`msg ${m.role}`} key={i}>
                  {m.role === "assistant" && <div className="avatar">✦</div>}
                  <div className="msg-body">
                    {m.image && m.role === "user" ? <img className="attached" src={m.image} alt="attached" /> : null}
                    {m.role === "assistant" && m.image && /^https?:\/\//.test(m.image) ? (
                      <div className="gen-wrap">
                        <a href={m.image} target="_blank" rel="noreferrer"><img className="generated" src={m.image} alt="generated" loading="lazy" /></a>
                        <div className="gen-prompt">{m.content}</div>
                        <button className="chip" onClick={() => fetch(m.image).then((r) => r.blob()).then((b) => download("arynox-image.png", b))}>⬇ Download image</button>
                      </div>
                    ) : (
                      <div className="bubble">
                        {parseBlocks(m.content).map((p, j) => p.type === "code" ? <CodeBlock key={j} code={p.code} filename={`solution_${j + 1}.js`} /> : <span key={j} dangerouslySetInnerHTML={{ __html: p.html }} />)}
                      </div>
                    )}
                    {m.role === "assistant" && <FileChips files={m.files} />}
                    {m.role === "assistant" && <ToolChips tools={m.tools} />}
                    {m.role === "assistant" && !m.image && (
                      <div className="msg-actions">
                        <button className="icon-btn" title="Speak" onClick={() => speak(m.content, m.lang || "en")}>🔊</button>
                        <button className="icon-btn" title="Remember" onClick={() => addMemory(m.content)}>🧠</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && <div className="typing"><span /><span /><span /></div>}
              <div ref={endRef} />
            </div>

            <div className="composer">
              {image && (
                <div className="preview">
                  <img src={image} alt="preview" />
                  <button className="icon-btn" onClick={() => setImage(null)}>✕</button>
                </div>
              )}
              <div className="input-row">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
                <input ref={officeRef} type="file" accept=".xlsx,.csv,.txt,.docx" hidden onChange={onPickOfficeFile} />
                <button className="tool-btn" title="Attach a photo" onClick={() => fileRef.current?.click()}>📷</button>
                <button className="tool-btn" title="Attach Excel/CSV/Word file" onClick={() => officeRef.current?.click()}>📎</button>
                <textarea rows={1} placeholder={genMode ? "Describe the image you want..." : "Message Arynox AI..."}
                  value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <button className={`tool-btn mic ${recording ? "rec" : ""}`} title={recording ? "Stop" : "Talk"} onClick={recording ? stopRecord : startRecord}>{recording ? "◼" : "🎤"}</button>
                <button className="send-btn" disabled={!input.trim() || busy} onClick={() => send()}>➤</button>
              </div>
            </div>
          </>
        )}

        {tab === "ide" && (
          <div className="ide">
            <header className="topbar">
              <div className="brand"><span className="dot busy" /><span className="status">IDE — build & run entire projects</span></div>
              <div className="ide-bar">
                <input className="file-name" placeholder="new-file.js" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addFile(); }} />
                <button className="chip" onClick={addFile}>＋ File</button>
                <button className="chip" onClick={() => { setRunOut(""); }}>⌫ Clear</button>
                <button className="chip" onClick={downloadProject}>⬇ ZIP</button>
                <button className="chip" onClick={downloadWorkspace} title="Download the agent workspace (all files the AI created)">🤖 Workspace ZIP</button>
                <button className="send-btn ide-run" disabled={running} onClick={runProject}>{running ? "Running..." : "▶ Run project"}</button>
              </div>
            </header>
            <div className="ide-split">
              <div className="ide-files">
                <div className="ide-files-head">Project files</div>
                {project.map((f, i) => (
                  <div className={`ide-file ${i === activeFile ? "active" : ""}`} key={i}>
                    <button className="ide-file-name" onClick={() => setActiveFile(i)}>📄 {f.name}</button>
                    <button className="icon-btn" onClick={() => deleteFile(i)}>🗑</button>
                  </div>
                ))}
              </div>
              <div className="ide-editor-col">
                <div className="ide-file-tab">
                  <input className="file-name" value={file?.name || ""} onChange={(e) => renameFile(activeFile, e.target.value)} />
                  <button className="chip" onClick={() => runCode(file?.code || "", file?.name)}>▶ Run this file</button>
                </div>
                <div className="editor-wrap">
                  <CodeMirror value={file?.code || ""} height="100%" theme={oneDark} extensions={[langOf(file?.name)]} onChange={(v) => setFileCode(activeFile, v)} />
                </div>
              </div>
              <div className="console">
                <div className="console-head">Output</div>
                <pre className="console-body">{runOut || "// Press ▶ Run project to see the output here."}</pre>
              </div>
            </div>
          </div>
        )}

        {tab === "camera" && (
          <div className="camera">
            <header className="topbar">
              <div className="brand"><span className={`dot ${camOn ? "busy" : ""}`} /><span className="status">{camOn ? "watching what's in front of the camera" : "camera is off"}</span></div>
              <div className="toggles">
                {camOn ? <button className="chip cam-off" onClick={stopCamera}>■ Stop</button> : <button className="chip cam-on" onClick={startCamera}>● Start seeing</button>}
              </div>
            </header>
            <div className="cam-stage">
              <div className="cam-frame">
                <video ref={videoRef} muted playsInline />
                {!camOn && (
                  <div className="cam-placeholder">
                    <span>👁</span>
                    <p className="cam-place-title">See the world live</p>
                    <p>Press <b>Start seeing</b> and I will tell you what objects are around you.</p>
                    <button className="send-btn cam-big" onClick={startCamera}>● Start seeing</button>
                  </div>
                )}
                {objects.length > 0 && (
                  <div className="overlay">
                    {objects.map((o, i) => <span className="detect-chip" key={i}>{OBJECT_ICONS[o.name] || "🔸"} {o.name}{o.count > 1 ? ` ×${o.count}` : ""}</span>)}
                  </div>
                )}
              </div>
              <div className="detect-panel">
                <div className="detect-title">{camOn ? "I can see:" : "Detection is off"}</div>
                {camOn && objects.length === 0 && <div className="detect-empty">{detecting ? "Looking..." : "Looking around..."}</div>}
                <div className="detect-list">
                  {objects.map((o, i) => <div className="detect-row" key={i}><span>{OBJECT_ICONS[o.name] || "🔸"}</span> {o.name} <em>×{o.count}</em></div>)}
                </div>
                {camOn && (
                  <button className="chip speak-seen" onClick={() => speak("I can see " + objects.map((o) => o.name + (o.count > 1 ? `, ${o.count}` : "")).join(", "), "en")}>🔊 Tell me what you see</button>
                )}
                <p className="detect-note">📷 Detection looks at the camera every 3 seconds. Nothing is recorded or stored.</p>
              </div>
            </div>
          </div>
        )}

        {tab === "auto" && (
          <div className="auto">
            <header className="topbar">
              <div className="brand"><span className="dot" /><span className="status">Automations — connect your accounts & run actions</span></div>
            </header>
            <div className="auto-body">
              <div className="auto-cols">
                <div className="auto-col">
                  <div className="auto-card">
                    <div className="auto-card-title">🐙 GitHub</div>
                    <input className="auto-input" type="password" placeholder="Personal Access Token (fine-grained or classic)"
                      value={creds.githubToken} onChange={(e) => setCred("githubToken", e.target.value)} />
                    <div className="auto-actions">
                      <button className="chip" disabled={autoRunning !== ""} onClick={() => runAutomation("github_search", { query: "arynox" })}>🔎 Test search</button>
                      <button className="chip" disabled={autoRunning !== ""} onClick={() => runAutomation("github_search", { query: prompt("Search GitHub for:", "react") || "react" })}>Search repos</button>
                      <button className="chip" disabled={autoRunning !== ""} onClick={() => { const repo = prompt("Repo (owner/name):", "vercel/next.js"); if (repo) runAutomation("github_issues", { repo }); }}>Open issues</button>
                    </div>
                  </div>
                  <div className="auto-card">
                    <div className="auto-card-title">✉️ Gmail</div>
                    <input className="auto-input" placeholder="Your Gmail address" value={creds.gmailUser} onChange={(e) => setCred("gmailUser", e.target.value)} />
                    <input className="auto-input" type="password" placeholder="App Password (Google > App passwords)" value={creds.gmailPass} onChange={(e) => setCred("gmailPass", e.target.value)} />
                    <div className="auto-actions">
                      <button className="chip" disabled={autoRunning !== ""} onClick={() => { const to = prompt("Send to:", creds.gmailUser); if (to) runAutomation("gmail_send", { to, subject: "Test from Arynox AI", body: "Hello! This is a test email sent by Arynox AI. 🚀" }); }}>✉️ Send test email</button>
                    </div>
                    <p className="auto-note">Use a Gmail App Password (not your normal password). Enable 2-Step Verification first.</p>
                  </div>
                </div>
                <div className="auto-col">
                  <div className="auto-card">
                    <div className="auto-card-title">🔌 MCP servers (Model Context Protocol)</div>
                    <p className="auto-note">Connect other apps (GitHub, Gmail, Slack, Notion, databases...) via any MCP server. The AI can then list and call their tools from chat.</p>
                    <div className="mcp-list">
                      {!creds.mcpServers?.length && !creds.mcpUrl && <div className="mem-empty">No servers connected yet.</div>}
                      {creds.mcpServers?.map((s, i) => (
                        <div className="mcp-row" key={i}>
                          <div className="mcp-row-main">
                            <b>{s.name}</b>
                            <span className="mcp-row-url">{s.url}</span>
                            {mcpInfo[i]?.error && <span className="mcp-err">✗ {mcpInfo[i].error}</span>}
                            {!mcpInfo[i]?.error && mcpInfo[i] && (
                              <span className="mcp-ok">✓ {mcpInfo[i].tools.length} tools</span>
                            )}
                          </div>
                          <button className="icon-btn" title="Remove" onClick={() => removeMcpServer(i)}>🗑</button>
                        </div>
                      ))}
                    </div>
                    <div className="auto-actions">
                      <button className="chip" disabled={mcpBusy} onClick={refreshMcp}>{mcpBusy ? "Discovering..." : "🔍 Discover tools"}</button>
                      <button className="chip" disabled={mcpBusy} onClick={addMcpServer}>＋ Add server</button>
                      <button className="chip" disabled={mcpBusy} onClick={() => { const tool = prompt("MCP tool name:"); const server = prompt("Server name (or leave blank for first):") || ""; if (tool) runAutomation("mcp_call", { server, tool, params: {} }); }}>🔌 Call MCP tool</button>
                    </div>
                    {mcpInfo.filter((s) => !s.error).length > 0 && (
                      <div className="mcp-tools">
                        {mcpInfo.map((s, i) => !s.error && (
                          <div key={i}>
                            <div className="mcp-server-name">{s.name} — {s.tools.length} tools</div>
                            {s.tools.slice(0, 10).map((t, j) => (
                              <div className="mcp-tool" key={j} title={t.description || ""}>
                                <b>{t.name}</b> {t.description ? <em>{t.description.slice(0, 90)}</em> : null}
                              </div>
                            ))}
                            {s.tools.length > 10 && <div className="mcp-server-name">+{s.tools.length - 10} more</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="auto-card">
                    <div className="auto-card-title">💬 Just ask in chat</div>
                    <p className="auto-note">Once connected, you can just say things like:<br />• "Make a budget Excel file"<br />• "Search GitHub for a React calendar library"<br />• "Email this report to me"<br />• "Create an issue on my repo"<br />• "Call the MCP tool get_stock_price for Tesla"</p>
                  </div>
                </div>
              </div>
              <div className="auto-log">
                <div className="auto-log-head">Run log</div>
                <pre className="auto-log-body">{(autoLog.length ? autoLog : ["// Run an automation above to see the result here."]).join("\n")}</pre>
                <button className="chip" onClick={() => setAutoLog([])}>⌫ Clear log</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function hour() { return new Date().getHours(); }

function webmToWav(blob) {
  return new Promise(async (resolve, reject) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      const rate = 16000;
      const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
      const src = off.createBufferSource();
      src.buffer = decoded;
      src.connect(off.destination);
      src.start();
      const rendered = await off.startRendering();
      ctx.close();
      resolve(encodeWav(rendered));
    } catch (err) { reject(err); }
  });
}

function encodeWav(buffer) {
  const numCh = 1, rate = buffer.sampleRate, frames = buffer.length, bytes = frames * 2;
  const out = new ArrayBuffer(44 + bytes);
  const v = new DataView(out);
  const wstr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); v.setUint32(4, 36 + bytes, true); wstr(8, "WAVE");
  wstr(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * numCh * 2, true);
  v.setUint16(32, numCh * 2, true); v.setUint16(34, 16, true);
  wstr(36, "data"); v.setUint32(40, bytes, true);
  const data = buffer.getChannelData(0);
  let off = 44;
  for (let i = 0; i < frames; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([out], { type: "audio/wav" });
}
