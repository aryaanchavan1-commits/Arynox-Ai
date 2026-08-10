"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import JSZip from "jszip";
import { classify } from "@/lib/intent";
import { sb } from "@/lib/supabase-client";

const KEY = { memory: "arynox_memory", history: "arynox_history", project: "arynox_project", theme: "arynox_theme", creds: "arynox_creds", session: "arynox_session", business: "arynox_business", convos: "arynox_convos", code: "arynox_code_msgs", voice: "arynox_voice" };
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const GEN_RE = /\b(generate|create|draw|make|imagine|render|picture|image|photo|art of|बनाओ|बना|तस्वीर|चित्र|ड्रा|छवि)\b/i;
const DEFAULT_PROJECT = [
  { name: "main.js", code: "// Welcome to Arynox Code!\n// Write JavaScript, press Run, and watch the output.\n// Click 🤖 Agent to ask the AI to build or fix things.\n\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet(\"Aryan\"));\n" },
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
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^[-•] (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)[.)] (.+)$/gm, '<li class="num">$2</li>')
    .replace(/(?:<li(?: class="num")?>.*?<\/li>(?:\n)?)+/g, (m) => {
      const tag = m.includes('class="num"') ? "ol" : "ul";
      return `<${tag} class="md-list">` + m.replace(/\n/g, "").replace(/ class="num"/g, "") + `</${tag}>`;
    })
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer"><img class="generated md-img" src="$2" alt="$1" loading="lazy"/></a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<>")\]]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>')
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
const TOOL_ICONS = { web_search: "🔎", get_url: "📄", run_code: "⚙", write_file: "📝", read_file: "📖", edit_file: "✏️", list_files: "🗂", delete_file: "🗑", create_excel: "📊", create_csv: "📄", create_docx: "📝", create_pdf: "📕", deep_research: "🔬", create_image: "🖼️", gmail_send: "✉️", github_search: "🐙", github_issues: "🐙", github_create_issue: "🐙", http_call: "🌐", mcp_call: "🔌", mcp_list_tools: "🔌" };
const OBJECT_ICONS = {
  person: "🧍", human: "🧍", man: "🧍", woman: "🧍", people: "🧍",
  laptop: "💻", computer: "💻", phone: "📱", smartphone: "📱",
  bottle: "🍾", cup: "☕", mug: "☕", water: "🥤", drink: "🥤", wine: "🍷", bowl: "🥣", fork: "🍴", knife: "🔪",
  chair: "🪑", table: "🪑", desk: "🪑", sofa: "🛋", bench: "🪑", dining: "🍽",
  dog: "🐶", cat: "🐱", bird: "🐦", pet: "🐾", horse: "🐴", cow: "🐄", sheep: "🐑", elephant: "🐘", bear: "🐻", zebra: "🦓", giraffe: "🦒",
  book: "📚", paper: "📄", notebook: "📓", document: "📄", doc: "📄",
  window: "🪟", door: "🚪", wall: "🧱",
  tv: "📺", screen: "🖥", monitor: "🖥", laptop_computer: "💻",
  keyboard: "⌨", mouse: "🖱", remote: "🎛", cell_phone: "📱",
  bag: "🎒", backpack: "🎒", handbag: "👜", suitcase: "🧳", shoes: "👟", tie: "👔", hat: "🎩", glasses: "👓",
  clock: "🕐", watch: "⌚", lamp: "💡", light: "💡", candle: "🕯",
  car: "🚗", vehicle: "🚗", bicycle: "🚲", motorcycle: "🏍", bus: "🚌", truck: "🚚", train: "🚆", airplane: "✈️", boat: "⛵",
  plant: "🪴", flower: "🌸", tree: "🌳", potted_plant: "🪴",
  refrigerator: "🧊", oven: "🍳", microwave: "🔥", toaster: "🍞", sink: "🚰", couch: "🛋", bed: "🛏", bench: "🪑",
  sports_ball: "⚽", baseball: "⚾", football: "🏈", tennis: "🎾", skateboard: "🛹", surfboard: "🏄", skis: "🎿",
  snowboard: "🏂", frisbee: "🥏", kite: "🪁", umbrella: "☂️", scissors: "✂️", toothbrush: "🪥", hair_drier: "💨", razor: "🪒",
  sandwich: "🥪", banana: "🍌", apple: "🍎", orange: "🍊", carrot: "🥕", broccoli: "🥦", cake: "🍰", donut: "🍩", pizza: "🍕", hot_dog: "🌭", french_fries: "🍟",
};
const VEHICLES = ["car", "truck", "bus", "motorcycle", "bicycle"];
const VEHICLE_LABEL = { car: "car", truck: "truck", bus: "bus", motorcycle: "motorbike", bicycle: "bicycle" };
const WA_TEMPLATES = [
  { id: "loan", icon: "🏦", title: "Loan repayment reminder", tag: "Banks & NBFCs", fields: [{ k: "bank", label: "Bank / branch name", ph: "Konkan Co-op Bank" }, { k: "customer", label: "Customer name", ph: "Ramesh Patil" }, { k: "amount", label: "EMI amount (₹)", ph: "8500" }, { k: "due", label: "Due date", ph: "15 Aug" }, { k: "balance", label: "Outstanding balance (₹)", ph: "120000" }], make: (f) => `Dear ${f.customer || "customer"},\n\nA gentle reminder that your loan instalment of ₹${f.amount || "—"} at ${f.bank || "our bank"} is due on ${f.due || "the due date"}. Your current outstanding balance is ₹${f.balance || "—"}.\n\nPlease pay on time to avoid late fees. For any questions, reply to this message.\n\n— ${f.bank || "Your Bank"}` },
  { id: "hotel", icon: "🏨", title: "Booking confirmation", tag: "Hotels & resorts", fields: [{ k: "hotel", label: "Hotel name", ph: "Hotel Konkan Darshan" }, { k: "guest", label: "Guest name", ph: "Amit Desai" }, { k: "room", label: "Room type", ph: "Sea-view AC" }, { k: "checkin", label: "Check-in", ph: "12 Aug, 2 PM" }, { k: "checkout", label: "Check-out", ph: "14 Aug, 11 AM" }], make: (f) => `Dear ${f.guest || "guest"},\n\nYour booking at ${f.hotel || "our hotel"} is confirmed: ${f.room || "room"} · Check-in ${f.checkin || "—"} · Check-out ${f.checkout || "—"}.\n\nWe look forward to welcoming you! Reply for pick-up, food or any help.\n\n— ${f.hotel || "The Hotel"}` },
  { id: "order", icon: "🍽", title: "Order received", tag: "Restaurants", fields: [{ k: "rest", label: "Restaurant name", ph: "Sea Breeze Restaurant" }, { k: "name", label: "Customer name", ph: "Sneha Kulkarni" }, { k: "items", label: "Ordered items", ph: "2 Fish Thali, 1 Kokam Sarbat" }, { k: "time", label: "Ready time", ph: "20 min" }], make: (f) => `Hi ${f.name || "guest"},\n\nWe received your order at ${f.rest || "our restaurant"}: ${f.items || "—"}.\n\nIt will be ready in about ${f.time || "20 minutes"}. Pay when you collect.\n\n— ${f.rest || "The Restaurant"}` },
  { id: "itinerary", icon: "🗺", title: "Itinerary share", tag: "Travel & tours", fields: [{ k: "agency", label: "Agency name", ph: "Konkan Tours" }, { k: "guest", label: "Guest name", ph: "John D" }, { k: "day1", label: "Day 1 plan", ph: "Arrive Ratnagiri, Ganpatipule beach" }, { k: "day2", label: "Day 2 plan", ph: "Boat ride + coconut tour" }], make: (f) => `Hi ${f.guest || "guest"}!\n\nYour ${f.agency || "tour"} plan is ready:\n• Day 1 — ${f.day1 || "—"}\n• Day 2 — ${f.day2 || "—"}\n\nPack light, we start early. Questions? Reply here.\n\n— ${f.agency || "Your Agency"}` },
];

export default function Home() {
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [convos, setConvos] = useState(() => load(KEY.convos, []));
  const [activeConvId, setActiveConvId] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [deferredInstall, setDeferredInstall] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [memory, setMemory] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [image, setImage] = useState(null);
  const [genMode, setGenMode] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [toast, setToast] = useState("");

  const [showMemory, setShowMemory] = useState(false);
  const [newFact, setNewFact] = useState("");
  const [theme, setTheme] = useState(() => load(KEY.theme, "light"));
  const [creds, setCreds] = useState(() => load(KEY.creds, { githubToken: "", gmailUser: "", gmailPass: "", mcpUrl: "", mcpToken: "", mcpServers: [] }));
  const [user, setUser] = useState(() => load(KEY.session, null));
  const [authChecked, setAuthChecked] = useState(() => load(KEY.session, null) !== null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState("in");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authForgot, setAuthForgot] = useState(false);
  const [authReset, setAuthReset] = useState(false);
  const [authPass2, setAuthPass2] = useState("");
  const [authMailInfo, setAuthMailInfo] = useState("");
  const [business, setBusiness] = useState(() => load(KEY.business, null));
  const [guideOpen, setGuideOpen] = useState("");
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
  const [idePreview, setIdePreview] = useState(false);
  const [codeMsgs, setCodeMsgs] = useState(() => load(KEY.code, []));
  const [codeInput, setCodeInput] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  const [closedFolders, setClosedFolders] = useState(() => new Set());
  const previewUrl = () => `/api/preview${user?.token ? "?t=" + encodeURIComponent(user.token) : ""}`;
  const hasHtml = project.some((f) => /\.html?$/i.test(f.name));

  const [camOn, setCamOn] = useState(false);
  const [objects, setObjects] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [docs, setDocs] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [detectPaused, setDetectPaused] = useState(false);
  const [aiVision, setAiVision] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [camDevices, setCamDevices] = useState([]);
  const [activeCamId, setActiveCamId] = useState("");
  const [vehicleAlert, setVehicleAlert] = useState(null);
  const [voiceAlerts, setVoiceAlerts] = useState(true);
  const [liveAsk, setLiveAsk] = useState("");
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveReplies, setLiveReplies] = useState([]);
  const [watchMode, setWatchMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("voice");
  const [voiceSet, setVoiceSet] = useState(() => load(KEY.voice, { provider: "server", rate: 1, pitch: 1, browserVoice: "", vbUrl: "http://127.0.0.1:17493", vbProfile: "" }));
  const [vbProfiles, setVbProfiles] = useState(null);
  const [vbTesting, setVbTesting] = useState(false);
  const [usage, setUsage] = useState(null);
  const [waTpl, setWaTpl] = useState(null);
  const [waBusy, setWaBusy] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceErr, setFaceErr] = useState("");
  const [faceMsg, setFaceMsg] = useState("");

  const [me, setMe] = useState({ email: "", isAdmin: false, premium: false, premiumUntil: 0 });
  const [adminToken, setAdminToken] = useState(() => load("arynox_admin", null));
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminLoginBusy, setAdminLoginBusy] = useState(false);
  const [adminLoginErr, setAdminLoginErr] = useState("");
  const [adminTab, setAdminTab] = useState("grants");
  const [usersList, setUsersList] = useState([]);
  const [keysList, setKeysList] = useState([]);
  const [keysBusy, setKeysBusy] = useState(false);
  const [visitors, setVisitors] = useState(() => load("arynox_visitors", []));
  const [kioskOn, setKioskOn] = useState(false);
  const [kioskStep, setKioskStep] = useState("off"); // off | idle | ask_name | ask_looking | guiding | done
  const [kioskStatus, setKioskStatus] = useState("");
  const [kioskName, setKioskName] = useState("");
  const [kioskLooking, setKioskLooking] = useState("");
  const [kioskBusy, setKioskBusy] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminDays, setAdminDays] = useState(30);
  const [adminList, setAdminList] = useState([]);
  const [adminBusy, setAdminBusy] = useState(false);

  const audioRef = useRef(null);
  const endRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const attachRef = useRef(null);
  const projectRef = useRef(null);
  const pendingPromptRef = useRef("");
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const faceVideoRef = useRef(null);
  const faceStreamRef = useRef(null);
  const streamRef = useRef(null);
  const detectTimer = useRef(null);
  const watchTimer = useRef(null);
  const lastVehicleSpeak = useRef(0);
  const liveBusyRef = useRef(false);
  const aiVisionRef = useRef(false);
  const tickRef = useRef(0);
  const toastTimer = useRef(null);
  const abortRef = useRef(null);
  const kioskRef = useRef({ lastAsk: 0, step: "off" });

  const doAdminLogin = async () => {
    if (!adminUser.trim() || !adminPass) { setAdminLoginErr("Enter username and password."); return; }
    setAdminLoginBusy(true);
    setAdminLoginErr("");
    try {
      const res = await fetch("/api/admin-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: adminUser.trim(), password: adminPass }), signal: AbortSignal.timeout(15000) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Login failed");
      setAdminToken(d.token);
      save("arynox_admin", d.token);
      setMe((prev) => ({ ...prev, isAdmin: true }));
      setAdminOpen(false);
      setAdminUser(""); setAdminPass("");
      setUpgradeOpen(true);
      setTimeout(refreshAdminPanel, 50);
      showToast("🛡 Admin panel unlocked");
    } catch (err) { setAdminLoginErr(err.message); }
    finally { setAdminLoginBusy(false); }
  };

  const adminAct = async (action, extra = {}) => {
    setAdminBusy(true);
    try {
      const h = { "Content-Type": "application/json", ...(me.isAdmin ? authHeaders() : adminHeaders()) };
      const res = await fetch("/api/admin", { method: "POST", headers: h, body: JSON.stringify({ action, ...extra }), signal: AbortSignal.timeout(30000) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "failed");
      if (d.users) setUsersList(d.users);
      if (d.list) setAdminList(d.list);
      if (d.result) showToast(d.result);
      return d;
    } catch (err) { showToast("⚠️ " + err.message); return null; }
    finally { setAdminBusy(false); }
  };

  const showToast = (t) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  };

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
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    endRef.current?.scrollIntoView({ behavior: coarse ? "auto" : "smooth", block: "end" });
  }, [messages, busy]);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferredInstall(e); };
    const onInstalled = () => { setDeferredInstall(null); setIsInstalled(true); showToast("✅ app installed — find Arynox AI in your apps"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator?.standalone) setIsInstalled(true);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const installApp = async () => {
    if (deferredInstall) {
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch {}
      setDeferredInstall(null);
    } else if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      showToast("📲 iPhone/iPad: tap the Share button → Add to Home Screen");
    } else {
      showToast("📲 Chrome/Edge menu → Install Arynox AI");
    }
  };

  useEffect(() => () => { stopCamera(); }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (!mounted) return;
        if (data?.session?.access_token) {
          const u = { id: data.session.user.id, email: data.session.user.email || "", name: data.session.user.user_metadata?.full_name || data.session.user.email?.split("@")[0] || "User", token: data.session.access_token };
          setUser(u);
          save(KEY.session, u);
        }
        try {
          const p = new URLSearchParams(window.location.search);
          const derr = p.get("error_description") || p.get("error");
          if (derr) {
            const msg = p.get("error_description") ? `Google sign-in failed: ${p.get("error_description")}` : `Sign-in failed (${derr})`;
            setAuthError(msg.slice(0, 220));
            window.history.replaceState({}, "", window.location.pathname);
          }
        } catch {}
      } catch {}
      if (mounted) setAuthChecked(true);
    })();
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { setUser(null); save(KEY.session, null); }
      if (event === "PASSWORD_RECOVERY") { setAuthReset(true); setAuthError(""); }
    });
    return () => { mounted = false; sub?.subscription?.unsubscribe(); };
  }, []);
  const authHeaders = () => (user?.token ? { Authorization: `Bearer ${user.token}` } : {});
  const adminHeaders = () => (adminToken ? { Authorization: `Bearer ${adminToken}` } : {});
  const adminMode = me.isAdmin || !!adminToken;

  const refreshAdminPanel = async () => {
    if (!adminMode) return;
    setAdminBusy(true);
    try {
      const h = { "Content-Type": "application/json", ...(me.isAdmin ? authHeaders() : adminHeaders()) };
      const [u, k, g] = await Promise.all([
        fetch("/api/admin", { method: "POST", headers: h, body: JSON.stringify({ action: "users" }) }).then((r) => r.json()),
        fetch("/api/admin", { method: "POST", headers: h, body: JSON.stringify({ action: "keys" }) }).then((r) => r.json()),
        fetch("/api/admin", { method: "POST", headers: h, body: JSON.stringify({ action: "list" }) }).then((r) => r.json()),
      ]);
      if (u.ok) setUsersList(u.users || []);
      if (k.ok) setKeysList(k.keys || []);
      if (g.ok) setAdminList(g.list || []);
    } catch {}
    finally { setAdminBusy(false); }
  };

  useEffect(() => {
    if (!user?.token) return;
    let dead = false;
    fetch("/api/me", { headers: { Authorization: `Bearer ${user.token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (!dead && d) setMe({ email: d.email || user.email, isAdmin: !!d.isAdmin, premium: !!d.premium, premiumUntil: d.premiumUntil || 0 });
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [user?.token, user?.email]);

  const friendlyAuthError = (err) => {
    const m = String(err?.message || err || "");
    if (m.includes("Unsupported provider")) return "Google sign-in isn't available right now — try again in a moment, or use Email/Password.";
    if (m.includes("Invalid login credentials")) return "Wrong email or password.";
    if (m.includes("Email not confirmed")) return "Please confirm your email first — check your inbox for the confirmation link.";
    if (m.includes("User already registered")) return "This email is already registered — try signing in instead.";
    if (m.includes("rate limit")) return "Too many sign-ups on this project recently. Please wait about an hour, then try again — or use Google sign-in, which is instant.";
    if (m.includes("Redirect URL")) return "The app owner must allow this site's URL in Supabase → Auth → URL Configuration (Redirect URLs).";
    try { const j = JSON.parse(m); if (j.msg) return j.msg; } catch {}
    return m.slice(0, 160);
  };

  const doAuth = async () => {
    const email = authEmail.trim().toLowerCase();
    const pass = authPass;
    if (!email || pass.length < 6) { setAuthError("Enter a valid email and a password with at least 6 characters."); return; }
    setAuthBusy(true);
    setAuthError("");
    try {
      if (authTab === "in") {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        if (data?.user && data.session) {
          const u = { id: data.user.id, email: data.user.email || email, name: data.user.user_metadata?.full_name || email.split("@")[0], token: data.session.access_token };
          setUser(u);
          save(KEY.session, u);
          setAuthOpen(false);
          showToast(`👋 welcome, ${u.name}`);
        }
      } else {
        const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: authName.trim() || email.split("@")[0] } } });
        if (error) throw error;
        if (data?.session?.access_token) {
          const u = { id: data.user.id, email: data.user.email || email, name: data.user.user_metadata?.full_name || email.split("@")[0], token: data.session.access_token };
          setUser(u);
          save(KEY.session, u);
          setAuthOpen(false);
          showToast(`👋 welcome, ${u.name}`);
        } else {
          setAuthError("Account created! Check your email to confirm, then sign in. No email? Check spam, and wait ~1 min between sign-ups (Supabase limits emails).");
          setAuthTab("in");
        }
      }
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally { setAuthBusy(false); }
  };

  const googleSignIn = () => {
    setAuthError("");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: origin } }).catch((err) => setAuthError(friendlyAuthError(err)));
  };

  const signOut = async () => {
    try { await sb.auth.signOut(); } catch {}
    setUser(null);
    save(KEY.session, null);
    showToast("👋 signed out — sign in again to continue");
  };

  const demoSignIn = () => {
    const u = { id: "demo", email: "demo@arynox.ai", name: "Demo User", token: "demo-session", demo: true };
    setUser(u);
    save(KEY.session, u);
    setAuthOpen(false);
    showToast("🎉 exploring in demo mode — sign in to keep your work across devices");
  };

  const forgotPass = async () => {
    const email = authEmail.trim().toLowerCase();
    if (!email) { setAuthError("Enter your account email first."); return; }
    setAuthBusy(true);
    setAuthError("");
    setAuthMailInfo("");
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: (typeof window !== "undefined" ? window.location.origin : "") + "/app" });
      if (error) throw error;
      setAuthMailInfo(`🔗 Reset link sent to ${email}. Check your inbox — and the spam folder. It works for 1 hour.`);
      setAuthForgot(false);
      setAuthTab("in");
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally { setAuthBusy(false); }
  };

  const doResetPassword = async () => {
    if (authPass.length < 6) { setAuthError("New password needs at least 6 characters."); return; }
    if (authPass !== authPass2) { setAuthError("Passwords don't match."); return; }
    setAuthBusy(true);
    setAuthError("");
    try {
      const { error } = await sb.auth.updateUser({ password: authPass });
      if (error) throw error;
      setAuthReset(false);
      setAuthPass("");
      setAuthPass2("");
      showToast("🔑 password updated — sign in with your new password");
      try { await sb.auth.signOut(); } catch {}
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally { setAuthBusy(false); }
  };

  const setBusinessProfile = (patch) => setBusiness((prev) => { const next = { ...(prev || {}), ...patch }; save(KEY.business, next); return next; });

  const persist = (msgs) => {
    setMessages(msgs);
    const slim = msgs.slice(-40).map((m) => ({ role: m.role, content: m.content, lang: m.lang, image: m.image, files: m.files, tools: m.tools, codeFiles: m.codeFiles, suggestions: m.suggestions }));
    save(KEY.history, slim);
    if (msgs.length) {
      const id = activeConvId || String(Date.now());
      if (!activeConvId) setActiveConvId(id);
      save(`arynox_conv_${id}`, slim);
      const first = msgs.find((m) => m.role === "user")?.content || "Chat";
      const title = first.length > 40 ? first.slice(0, 40) + "…" : first;
      setConvos((prev) => {
        const next = [{ id, title, ts: Date.now() }, ...prev.filter((c) => c.id !== id)].slice(0, 30);
        save(KEY.convos, next);
        return next;
      });
    }
  };

  const newChat = () => {
    if (busy) return;
    setMessages([]);
    save(KEY.history, []);
    setActiveConvId(null);
  };

  const openConvo = (id) => {
    if (busy) return;
    const msgs = load(`arynox_conv_${id}`, []);
    setMessages(msgs);
    save(KEY.history, msgs);
    setActiveConvId(id);
    setTab("chat");
  };

  const deleteConvo = (id) => {
    setConvos((prev) => { const next = prev.filter((c) => c.id !== id); save(KEY.convos, next); return next; });
    try { localStorage.removeItem(`arynox_conv_${id}`); } catch {}
    if (id === activeConvId) { setMessages([]); save(KEY.history, []); setActiveConvId(null); }
  };

  const setCred = (k, v) => setCreds((prev) => { const next = { ...prev, [k]: v }; save(KEY.creds, next); return next; });

  const speakBrowser = (text, lang) => new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve(false);
    try {
      const voices = window.speechSynthesis.getVoices();
      const want = voiceSet.browserVoice;
      const v = want ? voices.find((x) => x.voiceURI === want) : null;
      const prefix = (lang || "en").slice(0, 2);
      const pick = v || voices.find((x) => x.lang?.toLowerCase().startsWith(prefix)) || voices[0];
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).slice(0, 500));
      if (pick) { u.voice = pick; u.lang = pick.lang; }
      u.rate = Number(voiceSet.rate) || 1;
      u.pitch = Number(voiceSet.pitch) || 1;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      window.speechSynthesis.speak(u);
    } catch { resolve(false); }
  });

  const speakVoicebox = async (text, lang) => {
    const url = String(voiceSet.vbUrl || "http://127.0.0.1:17493").replace(/\/+$/, "");
    try {
      const res = await fetch(`${url}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: String(text).slice(0, 2000), profile: voiceSet.vbProfile || undefined, language: lang || undefined }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      if (!blob.size) return false;
      audioRef.current?.pause();
      const a = new Audio(URL.createObjectURL(blob));
      audioRef.current = a;
      await a.play();
      return true;
    } catch { return false; }
  };

  const testVoicebox = async () => {
    setVbTesting(true);
    const url = String(voiceSet.vbUrl || "http://127.0.0.1:17493").replace(/\/+$/, "");
    try {
      const res = await fetch(`${url}/profiles`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error("status " + res.status);
      const data = await res.json();
      const profiles = Array.isArray(data) ? data : data.profiles || [];
      setVbProfiles(profiles);
      showToast(`✅ Voicebox connected — ${profiles.length} voice${profiles.length === 1 ? "" : "s"} found`);
    } catch {
      setVbProfiles([]);
      showToast("❌ Voicebox not reachable — download & run the free app from voicebox.sh first");
    } finally { setVbTesting(false); }
  };

  const speak = async (text, lang) => {
    if (!text) return;
    const provider = voiceSet.provider || "server";
    if (provider === "voicebox") {
      if (await speakVoicebox(text, lang).catch(() => false)) return;
    } else if (provider === "browser") {
      if (await speakBrowser(text, lang).catch(() => false)) return;
    }
    try {
      audioRef.current?.pause();
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang: lang || "en" }), signal: AbortSignal.timeout(30000) });
      if (!res.ok) return;
      const url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: "audio/mpeg" }));
      const a = new Audio(url);
      audioRef.current = a;
      await a.play();
    } catch {}
  };

  const trackUsage = (action) => {
    if (!user?.token) return;
    try {
      fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(8000) }).catch(() => {});
    } catch {}
  };

  const refreshUsage = async () => {
    if (!user?.token) { setUsage(null); return; }
    try {
      const res = await fetch("/api/usage", { headers: authHeaders(), signal: AbortSignal.timeout(8000) });
      if (res.ok) setUsage(await res.json());
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
    trackUsage("code");
    try {
      const language = (label || "").toLowerCase().endsWith(".py") ? "python" : "javascript";
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, language }), signal: AbortSignal.timeout(30000) });
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
      let ran = 0, skipped = 0;
      for (const f of project) {
        const language = f.name.toLowerCase().endsWith(".py") ? "python" : "javascript";
        if (!/\.(js|jsx|ts|tsx|mjs|cjs|py)$/i.test(f.name)) { skipped++; continue; }
        out.push(`— ${f.name} (${language}) —`);
        ran++;
        const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: f.code, language }), signal: AbortSignal.timeout(30000) });
        const d = await res.json();
        if (d.error) out.push("⛔ " + d.error);
        if (d.output) out.push(d.output);
        out.push("");
      }
      const htmlFiles = project.filter((f) => /\.html?$/i.test(f.name)).length;
      out.push(`✓ Ran ${ran} file${ran === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} non-code file${skipped === 1 ? "" : "s"}` : ""}.${htmlFiles ? " Open 🌐 Preview to see your website." : ""}`);
      setRunOut(out.join("\n"));
    } catch (err) { setRunOut("Error: " + err.message); }
    finally { setRunning(false); }
  };

  const langOf = (name) => (name || "").toLowerCase().endsWith(".py") ? python() : javascript();

  const ideTree = useMemo(() => {
    const root = {};
    project.forEach((f, i) => {
      const parts = (f.name || "").split("/").filter(Boolean);
      let node = root;
      parts.slice(0, -1).forEach((p) => { node[p] = node[p] || {}; node = node[p]; });
      (node._files = node._files || []).push(i);
    });
    return root;
  }, [project]);

  const renderFolder = (node, path, depth) => {
    const rows = [];
    for (const key of Object.keys(node)) {
      if (key === "_files") continue;
      const childPath = path ? path + "/" + key : key;
      const closed = closedFolders.has(childPath);
      rows.push(
        <div className="ide-folder-row" key={childPath}>
          <button className={`ide-folder ${closed ? "closed" : "open"}`} style={{ paddingLeft: 6 + depth * 14 }} onClick={() => setClosedFolders((prev) => { const n = new Set(prev); if (n.has(childPath)) n.delete(childPath); else n.add(childPath); return n; })}>
            <span className="twist">{closed ? "▶" : "▼"}</span><span className="folder-icon">📁</span>{key}
          </button>
          {!closed && renderFolder(node[key], childPath, depth + 1)}
        </div>
      );
    }
    for (const i of node._files || []) {
      const f = project[i];
      rows.push(
        <div className={`ide-file ${i === activeFile ? "active" : ""}`} key={"f" + i}>
          <button className="ide-file-name" style={{ paddingLeft: 6 + depth * 14 }} title={f.name} onClick={() => setActiveFile(i)}>📄 {f.name.split("/").pop()}</button>
          <button className="icon-btn" onClick={() => deleteFile(i)}>🗑</button>
        </div>
      );
    }
    return rows;
  };

  const setFileCode = (i, code) => setProject((prev) => { const next = prev.map((f, j) => (j === i ? { ...f, code } : f)); save(KEY.project, next); return next; });

  const addFile = () => {
    let name = (newFileName.trim() || "new-file.js").replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/\.\./g, "");
    setProject((prev) => { const next = [...prev, { name, code: "// " + name.split("/").pop() + "\n\n" }]; save(KEY.project, next); return next; });
    setActiveFile(project.length);
    setNewFileName("");
  };
  const deleteFile = (i) => {
    if (project.length === 1) return;
    setProject((prev) => { const next = prev.filter((_, j) => j !== i); save(KEY.project, next); return next; });
    setActiveFile((a) => Math.min(a, project.length - 2));
  };
  const renameFile = (i, name) => setProject((prev) => { const next = prev.map((f, j) => (j === i ? { ...f, name } : f)); save(KEY.project, next); return next; });

  const uploadProject = async (e) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files?.length) return;
    if (busy) { showToast("⏳ wait — the agent is working"); return; }
    setBusy(true);
    showToast("📦 uploading project...");
    try {
      const items = [];
      for (const f of files) {
        if (f.size > 2 * 1024 * 1024) continue;
        const rel = f.webkitRelativePath ? f.webkitRelativePath.split("/").slice(1).join("/") : f.name;
        items.push({ name: rel || f.name, code: await f.text() });
      }
      if (!items.length) throw new Error("No readable files (each file must be under 2 MB)");
      const res = await fetch("/api/upload-project", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ files: items }),
        signal: AbortSignal.timeout(90000),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "upload failed");
      const proj = d.files.map((f) => ({ name: f.name, code: f.code }));
      setProject(proj);
      save(KEY.project, proj);
      setActiveFile(0);
      setTab("ide");
      showToast(`📦 uploaded ${d.files.length} files — tell me what to do with them`);
    } catch (err) { showToast("⚠️ upload failed: " + err.message); }
    finally { setBusy(false); }
  };

  const runAutomation = async (action, params) => {
    setAutoRunning(action);
    setAutoLog((prev) => [...prev, `▶ ${action}...`]);
    try {
      const res = await fetch("/api/automation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, params, creds }), signal: AbortSignal.timeout(60000) });
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
    trackUsage(gen ? "images" : "chat");

    if (gen) {
      const prompt = genMode ? text.replace(GEN_RE, "").trim() || text : text.replace(/^(generate|create|draw|make|imagine|render|show|give)\s+(me\s+)?/i, "").trim().replace(/[.!?]+$/, "") || text;
      try {
        const res = await fetch("/api/gen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, width: 1024, height: 1024 }), signal: AbortSignal.timeout(150000) });
        const d = await res.json();
        if (res.ok) persist([...history, { role: "assistant", content: prompt, image: d.url, lang: "en" }]);
        else persist([...history, { role: "assistant", content: "⚠️ " + (d.error || "Could not create the image."), lang: "en" }]);
      } catch (err) { persist([...history, { role: "assistant", content: "⚠️ Image error: " + err.message, lang: "en" }]); }
        setBusy(false);
      return;
    }

    if (isBuildRequest(text)) {
      await buildInIde(text);
      return;
    }

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const timer = setTimeout(() => ctrl.abort(), 180000);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          messages: history.slice(-16).map((m) => (m.role === "user" && m.image ? { ...m, image: null } : m)),
          memory,
          image: image || null,
          creds,
          business,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) {
        persist([...history, { role: "assistant", content: data.error || "Something went wrong.", lang: "en" }]);
      setBusy(false);
        return;
      }
      const aiMsg = { role: "assistant", content: data.reply, lang: data.lang || "en", tools: data.tools || [], codeFiles: data.codeFiles || [], files: data.files || [], suggestions: data.suggestions || [] };
      persist([...history, aiMsg]);
      if (Array.isArray(data.memory) && data.memory.length) {
        setMemory((prev) => { const next = [...prev]; for (const f of data.memory) if (!next.includes(f)) next.push(f); save(KEY.memory, next); return next; });
      }
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
        if (Array.isArray(data.tools) && data.tools.some((t) => /write_file|edit_file|delete_file|run_code/.test(t))) {
          setTab("ide");
          setIdePreview(true);
          showToast("🛠 built in Code — files + live preview ready");
        }
      }
      if (autoSpeak && !data.codeFiles?.length && !data.files?.length) speak(data.reply, data.lang || "en");
    } catch (err) {
      if (err?.name === "AbortError") persist([...history, { role: "assistant", content: "⏹ stopped — send your next message to continue", lang: "en" }]);
      else persist([...history, { role: "assistant", content: "Network error: " + err.message, lang: "en" }]);
    } finally { setBusy(false); abortRef.current = null; }
  };

  const isBuildRequest = (text) => {
    const t = (text || "").toLowerCase();
    if (genMode) return false;
    if (/image|photo|picture|drawing|illustration|logo\b|banner|avatar|wallpaper/.test(t) && !/website|web ?app|app\b/.test(t)) return false;
    if (classify(t) === "image") return false;
    return /(^|\s)(build|make|create|develop|code|write|program|start)\s+(me\s+)?(a|an|my|the|this|small|simple|full|modern|responsive|basic|landing)?\s*(website|web ?site|web ?app|app|application|game|tool|dashboard|todo|calculator|quiz|chat ?bot|bot|portfolio|landing ?page|blog|store|shop|ecommerce|e-commerce|cms|crm|script|program|extension|page|site|form|login|sign ?up|timer|clock|notepad|notes|resume|cv|invoice|menu|poster)/i.test(t)
      || /(build|create|make)\s+(me\s+)?(a|an)\s+.+(website|web ?app|app|game|tool|dashboard|calculator|chat ?bot|portfolio|blog|store)/i.test(t);
  };

  const buildInIde = async (text) => {
    setBusy(true);
    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const timer = setTimeout(() => ctrl.abort(), 240000);
      const res = await fetch("/api/code", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ messages: [{ role: "user", content: text }], files: project.map((f) => ({ name: f.name, code: f.code })) }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "The coding agent is unavailable right now.");
      if (d.workspace?.length) {
        let added = 0;
        setProject((prev) => {
          const byName = new Map(prev.map((f) => [f.name, f]));
          for (const wf of d.workspace) { if (!byName.has(wf.name)) added++; byName.set(wf.name, { name: wf.name, code: wf.code }); }
          const next = [...byName.values()];
          save(KEY.project, next);
          return next;
        });
        const cm = [...codeMsgs, { role: "user", content: text }, { role: "assistant", content: d.reply || "Done." }];
        setCodeMsgs(cm);
        save(KEY.code, cm);
        setTab("ide");
        setIdePreview(true);
        setAgentOpen(true);
        persist([...messages, { role: "user", content: text }, { role: "assistant", content: `🛠 Built in the Code tab — ${added} file${added === 1 ? "" : "s"} added. Open 💻 Code to see your project, run it, download the ZIP, or ask me to change anything.\n\n${(d.reply || "").slice(0, 900)}`, lang: "en" }]);
        showToast(`🛠 built ${added} file${added === 1 ? "" : "s"} in Code — preview ready`);
        if (autoSpeak) speak((d.reply || "").replace(/\*\*/g, "").slice(0, 300), "en");
      } else {
        persist([...messages, { role: "user", content: text }, { role: "assistant", content: d.reply || "Done.", lang: "en" }]);
        if (autoSpeak) speak(d.reply || "", "en");
      }
    } catch (err) {
      if (err?.name === "AbortError") persist([...messages, { role: "user", content: text }, { role: "assistant", content: "⏹ build stopped — I can continue with the next instruction", lang: "en" }]);
      else persist([...messages, { role: "user", content: text }, { role: "assistant", content: "⚠️ " + (err.message || "Could not build that."), lang: "en" }]);
    } finally { setBusy(false); abortRef.current = null; }
  };

  const stopGeneration = () => abortRef.current?.abort();

  const sendCodeAgent = async () => {
    const text = codeInput.trim();
    if (!text || codeBusy) return;
    const userMsg = { role: "user", content: text };
    const next = [...codeMsgs, userMsg];
    setCodeMsgs(next);
    save(KEY.code, next);
    setCodeInput("");
    setCodeBusy(true);
    setCodeErr("");
    try {
      const res = await fetch("/api/code", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, files: project.map((f) => ({ name: f.name, code: f.code })) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "The coding agent is unavailable right now.");
      const aiMsg = { role: "assistant", content: d.reply || "(no reply)" };
      const final = [...next, aiMsg];
      setCodeMsgs(final);
      save(KEY.code, final);
      if (d.workspace?.length) {
        let changedCount = 0;
        setProject((prev) => {
          const byName = new Map(prev.map((f) => [f.name, f]));
          const newNames = new Set();
          for (const wf of d.workspace) { byName.set(wf.name, { name: wf.name, code: wf.code }); newNames.add(wf.name); }
          const next2 = [...byName.values()];
          save(KEY.project, next2);
          changedCount = [...newNames].filter((n) => {
            const p = prev.find((f) => f.name === n);
            return !p || p.code !== byName.get(n).code;
          }).length;
          const added = d.workspace.filter((w) => !prev.some((f) => f.name === w.name));
          if (added.length) setActiveFile(next2.findIndex((f) => f.name === added[0].name));
          return next2;
        });
        setTimeout(() => {
          if (changedCount) showToast(`🤖 agent updated ${changedCount} file${changedCount === 1 ? "" : "s"} in your project`);
          else showToast("🤖 agent reviewed your code");
        }, 100);
      }
      if (autoSpeak) speak(d.reply, "en");
    } catch (err) {
      setCodeErr(String(err?.message || err).slice(0, 240));
    } finally { setCodeBusy(false); }
  };

  const transcribeFile = async (file) => {
    setBusy(true);
    showToast("🎤 transcribing " + file.name + "...");
    try {
      const form = new FormData();
      form.append("audio", file);
      const res = await fetch("/api/stt", { method: "POST", body: form, signal: AbortSignal.timeout(90000) });
      const data = await res.json();
      if (res.ok && data.text) { setInput(data.text); setTimeout(() => send(data.text), 60); }
      else showToast("🎤 could not transcribe this audio");
    } catch { showToast("🎤 audio error"); }
    finally { setBusy(false); }
  };

  const attachFile = async (file) => {
    if (!file) return;
    if (busy) { showToast("⏳ wait — the agent is working"); return; }
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result);
      reader.readAsDataURL(file);
      return;
    }
    if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|webm|oga|aac|opus)$/i.test(file.name)) {
      transcribeFile(file);
      return;
    }
    setBusy(true);
    showToast("📄 reading " + file.name + "...");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: form, signal: AbortSignal.timeout(90000) });
      const d = await res.json();
      const content = res.ok ? d.text : "Could not read the file.";
      const task = pendingPromptRef.current || "Now help me with it.";
      pendingPromptRef.current = "";
      await send(`Here is the content of the file "${file.name}" (${file.size} bytes):\n\n${content.slice(0, 8000)}\n\n${task}`);
    } catch (err) { persist([...messages, { role: "assistant", content: "File error: " + err.message, lang: "en" }]); }
    finally { setBusy(false); }
  };

  const onPickAnyFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    attachFile(file);
  };

  const startRecord = async (onText) => {
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
        try {
          const wav = await webmToWav(blob);
          const form = new FormData();
          form.append("audio", new File([wav], "voice.wav", { type: "audio/wav" }));
          const res = await fetch("/api/stt", { method: "POST", body: form, signal: AbortSignal.timeout(45000) });
          const data = await res.json();
          if (res.ok && data.text) {
            if (onText) onText(data.text);
            else { setInput(data.text); setTimeout(() => send(data.text), 60); }
          } else if (onText) onText("");
          else showToast("🎤 could not hear — try again");
        } catch { showToast("🎤 mic error"); }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch { showToast("🎤 mic blocked — allow access in the browser"); }
  };

  const stopRecord = () => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setRecording(false);
  };

  const saveVisitor = (name, lookingFor) => {
    const v = { name: name || "Guest", lookingFor: lookingFor || "", at: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), ts: Date.now() };
    setVisitors((prev) => { const next = [v, ...prev].slice(0, 50); save("arynox_visitors", next); return next; });
    try {
      fetch("/api/visitors", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ name: v.name, lookingFor: v.lookingFor }), signal: AbortSignal.timeout(15000) }).catch(() => {});
    } catch {}
    return v;
  };

  const kioskListen = () => startRecord((text) => handleKioskText(text));

  const handleKioskText = async (text) => {
    const t = (text || "").trim();
    const step = kioskRef.current.step;
    if (!t) { setKioskStatus("🎤 did not hear you — please try again"); speak("Sorry, I did not hear you. Please try again.", "en"); return; }
    if (step === "ask_name") {
      const name = t.split(" ")[0].replace(/^[^a-zA-Z\u0900-\u097F]+/, "");
      setKioskName(name);
      setKioskStatus(`👤 Nice to meet you, ${name}!`);
      await speak(`Nice to meet you, ${name}! What are you looking for today?`, "en");
      kioskRef.current.step = "ask_looking";
      setKioskStep("ask_looking");
      setTimeout(kioskListen, 900);
    } else if (step === "ask_looking") {
      setKioskLooking(t);
      setKioskStatus(`🔍 ${kioskName} is looking for: ${t}`);
      await guideVisitor(kioskName, t);
    }
  };

  const guideVisitor = async (name, lookingFor) => {
    setKioskBusy(true);
    kioskRef.current.busy = true;
    setKioskStep("guiding");
    setKioskStatus("🧠 thinking how to help…");
    try {
      const biz = business?.name ? `The shop is "${business.name}" in ${business.city || ""}. Business details: ${JSON.stringify(business).slice(0, 600)}.` : "";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Act as a friendly, helpful store assistant at the counter. A visitor named "${name}" is looking for: "${lookingFor}". ${biz} Reply in 1-3 short spoken sentences, greeting them by name, telling them what we have for them and guiding them (where to look, what to ask for, what we can show). Sound warm and human — you are talking to them out loud right now.` }],
          memory, creds, business,
        }),
        signal: AbortSignal.timeout(60000),
      });
      const d = await res.json();
      const reply = d.reply || "I will help you find that right away!";
      setKioskStatus(`💬 ${reply}`);
      saveVisitor(name, lookingFor);
      await speak(reply.replace(/\*\*|```/g, "").slice(0, 400), d.lang || "en");
      setKioskStep("done");
      setTimeout(() => { setKioskStep("idle"); setKioskStatus(""); }, 15000);
    } catch {
      saveVisitor(name, lookingFor);
      setKioskStatus(`👤 Noted — ${name} is looking for ${lookingFor}. I will help in a moment.`);
      speak(`I have noted that you are looking for ${lookingFor}. Let me check that for you right away, ${name}.`, "en");
      setKioskStep("done");
      setTimeout(() => { setKioskStep("idle"); setKioskStatus(""); }, 15000);
    } finally { setKioskBusy(false); kioskRef.current.busy = false; }
  };

  const kioskStart = () => {
    setKioskOn(true);
    kioskRef.current.step = "idle";
    kioskRef.current.busy = false;
    kioskRef.current.lastAsk = Date.now() - 60000;
    setKioskStep("idle");
    setKioskStatus("🟢 Waiting for a person… I will greet them and ask their name.");
    showToast("🧑🤝🧑 Visitor mode on — when a person is seen, I will greet them");
    if (!camOn) startCamera();
  };

  const kioskStop = () => {
    setKioskOn(false);
    kioskRef.current.step = "off";
    kioskRef.current.busy = false;
    setKioskStep("off");
    setKioskStatus("");
    stopRecord();
  };

  const kioskReset = () => { kioskRef.current.step = "idle"; setKioskStep("idle"); setKioskStatus("🟢 Waiting for the next visitor…"); }; 

  const loadCameras = async (preferred) => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput").map((d) => ({ id: d.deviceId, label: d.label || "Camera" }));
      setCamDevices(cams);
      if (preferred) setActiveCamId(preferred);
      else if (!activeCamId && cams.length) setActiveCamId(cams[0].id);
      return cams;
    } catch { return []; }
  };

  const startCamera = async (deviceId) => {
    try {
      const video = deviceId ? { width: 640, height: 480, deviceId: { exact: deviceId } } : { width: 640, height: 480 };
      const stream = await navigator.mediaDevices.getUserMedia({ video });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCamOn(true); setObjects([]); setBoxes([]); setDocs([]); setVehicleAlert(null); setDetectPaused(false);
      setAiFailed(false);
      loadCameras(stream.getVideoTracks()[0]?.getSettings()?.deviceId || deviceId);
      import("@/lib/detect")
        .then((m) => m.loadObjectModel().then(() => { aiVisionRef.current = true; setAiVision(true); }).catch(() => { aiVisionRef.current = false; setAiFailed(true); }))
        .catch(() => { aiVisionRef.current = false; setAiFailed(true); });
      detectTimer.current = setInterval(detectFrame, 900);
      detectFrame();
    } catch { showToast("👁 camera blocked — allow access in the browser"); }
  };

  const switchCamera = async (deviceId) => {
    if (!camOn) { startCamera(deviceId); return; }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      clearInterval(detectTimer.current);
      detectTimer.current = null;
      await startCamera(deviceId);
    } catch { showToast("📷 could not switch to that camera"); }
  };

  const flipCamera = async () => {
    let cams = camDevices;
    if (!cams.length) cams = await loadCameras();
    if (cams.length < 2) { showToast("📷 only one camera found — add another to switch"); return; }
    const idx = Math.max(0, cams.findIndex((d) => d.id === activeCamId));
    const next = cams[(idx + 1) % cams.length];
    await switchCamera(next.id);
  };

  const stopCamera = () => {
    setCamOn(false); setObjects([]); setBoxes([]); setDocs([]); setVehicleAlert(null);
    clearInterval(detectTimer.current);
    detectTimer.current = null;
    clearInterval(watchTimer.current);
    watchTimer.current = null;
    setWatchMode(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const ov = overlayRef.current;
    if (ov) ov.getContext("2d").clearRect(0, 0, ov.width, ov.height);
  };

  const askLive = async (q) => {
    const v = videoRef.current;
    if (!v?.videoWidth) { showToast("👁 start the camera first"); return; }
    const text = String(q ?? liveAsk).trim();
    if (!text || liveBusyRef.current) return;
    liveBusyRef.current = true;
    setLiveBusy(true);
    setLiveAsk("");
    try {
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      const image = c.toDataURL("image/jpeg", 0.72);
      const history = liveReplies.slice(-6).flatMap((r) => [{ role: "user", content: r.q }, { role: "assistant", content: r.a }]);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ messages: [{ role: "user", content: text }], memory: memory.slice(0, 20), image, business, history }),
        signal: AbortSignal.timeout(90000),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Live vision failed");
      const reply = String(d.reply || "").replace(/[#*`]/g, "").slice(0, 700);
      setLiveReplies((prev) => [...prev.slice(-9), { q: text, a: reply, t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      trackUsage("live_vision");
      speak(reply, d.lang || "en");
    } catch (err) {
      setLiveReplies((prev) => [...prev.slice(-9), { q: text, a: "⚠ " + String(err?.message || err).slice(0, 200), t: "" }]);
    } finally { liveBusyRef.current = false; setLiveBusy(false); }
  };

  const toggleWatch = () => {
    const next = !watchMode;
    setWatchMode(next);
    if (next) {
      showToast("👀 Watching mode on — I will look, think and speak every 30 seconds");
      askLive("You are my live eyes right now. Look at what is in front of me and tell me in 2 short sentences what is happening, and check the web for anything relevant to it right now.");
      watchTimer.current = setInterval(() => {
        askLive("Keep watching. Is there anything new or important happening now? Answer in 1-2 short sentences.");
      }, 30000);
    } else {
      clearInterval(watchTimer.current);
      watchTimer.current = null;
      showToast("Watching mode off");
    }
  };

  const drawBoxes = (objs, docArr) => {
    const v = videoRef.current;
    const ov = overlayRef.current;
    if (!v || !ov || !v.videoWidth) return;
    const rect = ov.getBoundingClientRect();
    if (rect.width < 2) return;
    ov.width = Math.round(rect.width);
    ov.height = Math.round(rect.height);
    const m = window.__detectModule;
    if (!m) return;
    m.drawDetections(ov.getContext("2d"), v, objs, docArr, ov.width, ov.height);
  };

  const detectFrame = async () => {
    if (detecting || !camOn || detectPaused) return;
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setDetecting(true);
    try {
      if (aiVisionRef.current) {
        const m = await import("@/lib/detect");
        window.__detectModule = m;
        const [objs, docArr] = await Promise.all([
          m.detectObjects(v).catch(() => []),
          Promise.resolve(m.detectDocuments(v, v.videoWidth, v.videoHeight)),
        ]);
        setBoxes(objs);
        setDocs(docArr);
        const humans = objs.filter((b) => b.name === "person").length;
        const objCounts = {};
        for (const b of objs) {
          if (b.name === "person") continue;
          objCounts[b.name] = (objCounts[b.name] || 0) + 1;
        }
        setObjects(Object.keys(objCounts).map((name) => ({ name, count: objCounts[name] })));
        if (humans) setObjects((prev) => {
          const p = prev.filter((o) => o.name !== "person");
          return [{ name: "person", count: humans }, ...p];
        });
        const vehs = objs.filter((b) => VEHICLES.includes(b.name));
        if (vehs.length) {
          const top = vehs.slice().sort((a, b) => b.score - a.score)[0];
          const vh = v.videoHeight || 480;
          const proxRatio = (top.box[3] || 0) / vh;
          const dist = proxRatio > 0.55 ? "near" : proxRatio > 0.3 ? "medium" : "far";
          setVehicleAlert({ name: top.name, score: Math.round(top.score * 100), dist });
          if (voiceAlerts && Date.now() - lastVehicleSpeak.current > 12000) {
            lastVehicleSpeak.current = Date.now();
            const dn = VEHICLE_LABEL[top.name] || top.name;
            const ds = dist === "near" ? "very close, right in front" : dist === "medium" ? "getting closer" : "in the distance";
            speak(`Attention! A ${dn} is ${ds}. Be careful.`, "en");
          }
        } else {
          setVehicleAlert(null);
        }
        requestAnimationFrame(() => drawBoxes(objs, docArr));
        if (kioskRef.current.step === "idle" && !kioskRef.current.busy && Date.now() - kioskRef.current.lastAsk > 60000) {
          kioskRef.current.lastAsk = Date.now();
          kioskRef.current.step = "ask_name";
          setKioskStep("ask_name");
          setKioskStatus("👋 Person seen — greeting them…");
          await speak("Hello! Welcome! May I know your name, please?", "en");
          setKioskStatus("🎤 Listening… say your name");
          setTimeout(kioskListen, 900);
        }
      } else {
        tickRef.current += 1;
        if (tickRef.current % 3 !== 0) return;
        const c = document.createElement("canvas");
        c.width = 640; c.height = 480;
        c.getContext("2d").drawImage(v, 0, 0, 640, 480);
        const res = await fetch("/api/detect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: c.toDataURL("image/jpeg", 0.7) }) });
        const d = await res.json();
        if (res.ok) setObjects(d.objects || []);
      }
    } catch { setDetectPaused(true); setTimeout(() => setDetectPaused(false), 15000); }
    finally { setDetecting(false); }
  };

  useEffect(() => {
    if (!faceOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        faceStreamRef.current = stream;
        const v = faceVideoRef.current;
        if (v) { v.srcObject = stream; try { await v.play(); } catch {} }
      } catch { setFaceErr("Camera blocked — allow access to use face sign-in."); }
    })();
    return () => {
      cancelled = true;
      faceStreamRef.current?.getTracks().forEach((t) => t.stop());
      faceStreamRef.current = null;
    };
  }, [faceOpen]);

  const stopFace = () => { setFaceOpen(false); };

  const captureFace = async () => {
    const v = faceVideoRef.current;
    if (!v || !v.videoWidth) { setFaceErr("Camera isn't ready yet — wait a moment."); return; }
    setFaceBusy(true);
    setFaceErr("");
    try {
      const m = await import("@/lib/detect");
      const d = await m.getFaceDescriptor(v);
      if (!d) { setFaceErr("No face detected — move into the frame, face the light, and try again."); return; }
      setFaceMsg("Face captured — matching your identity…");
      const isUp = authTab === "up";
      const res = await fetch(isUp ? "/api/faces/register" : "/api/faces/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isUp ? { d, name: authName, email: authEmail } : { d }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Face authentication failed");
      const u = { id: data.user.id, email: data.user.email, name: data.user.name, token: data.access_token };
      setUser(u);
      save(KEY.session, u);
      setFaceOpen(false);
      setAuthOpen(false);
      showToast(isUp ? `👋 welcome, ${u.name} — your face ID is saved` : `👋 welcome back, ${u.name}`);
    } catch (err) {
      setFaceMsg("");
      setFaceErr(String(err?.message || err).slice(0, 220));
    } finally { setFaceBusy(false); }
  };

  const ToolChips = ({ tools }) => {
    if (!tools?.length) return null;
    const names = { web_search: "searched the web", get_url: "read a page", run_code: "ran code", write_file: "wrote a file", read_file: "read a file", edit_file: "edited a file", list_files: "listed files", delete_file: "deleted a file", create_excel: "made an Excel file", create_csv: "made a CSV", create_docx: "made a Word doc", create_pdf: "made a PDF", deep_research: "did deep research", create_image: "generated an image", gmail_send: "sent email", github_search: "GitHub", github_issues: "GitHub", github_create_issue: "GitHub", http_call: "HTTP call", mcp_call: "MCP", mcp_list_tools: "MCP tools" };
    return <div className="tool-chips">{tools.map((t, i) => <span className="tool-chip" key={i}>{TOOL_ICONS[t.name] || "🔧"} {names[t.name] || t.name}</span>)}</div>;
  };

  const CodeBlock = ({ code, filename }) => (
    <div className="codeblock">
      <div className="codeblock-head">
        <span className="codeblock-file">{filename || "code"}</span>
        <div className="codeblock-actions">
          <button onClick={() => runCode(code, filename)}>▶ Run</button>
          <button onClick={() => { setProject((prev) => { const names = new Set(prev.map((f) => f.name)); const orig = filename || "solution.js"; const extIdx = orig.lastIndexOf("."); const base = extIdx > 0 ? orig.slice(0, extIdx) : orig; const ext = extIdx > 0 ? orig.slice(extIdx) : ".js"; let n = orig, i = 1; while (names.has(n)) { n = `${base}_${i++}${ext}`; } const next = [...prev, { name: n, code }]; save(KEY.project, next); return next; }); setActiveFile(project.length); setTab("ide"); }}>Open in Code</button>
          <button onClick={() => download(filename || "script.js", code)}>⬇</button>
          <button onClick={() => navigator.clipboard?.writeText(code)}>⧉</button>
        </div>
      </div>
      <pre className="codeblock-body"><code>{code}</code></pre>
    </div>
  );

  const FileChips = ({ files }) => {
    if (!files?.length) return null;
    const icons = { xlsx: "📊", csv: "📄", docx: "📝", pdf: "📕" };
    const mimes = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdf: "application/pdf", csv: "text/csv" };
    return (
      <div className="file-chips">
        {files.map((f, i) => (
          <button key={i} className="file-chip" onClick={() => downloadBase64(f.name, mimes[f.type] || "application/octet-stream", f.dataBase64)}>
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
      const res = await fetch("/api/workspace", { headers: { ...authHeaders() }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) return;
      const blob = await res.blob();
      download("arynox-workspace.zip", blob, "application/zip");
    } catch {}
  };

  const exportChat = () => {
    const md = messages.map((m) => `## ${m.role === "user" ? "You" : "Arynox AI"}\n${m.content}\n`).join("\n");
    download("arynox-chat.md", new Blob([md], { type: "text/markdown;charset=utf-8" }), "text/markdown");
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
    setMcpInfo([]);
  };

  const refreshMcp = async () => {
    setMcpBusy(true);
    try {
      const res = await fetch("/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", creds }), signal: AbortSignal.timeout(60000) });
      const d = await res.json();
      setMcpInfo(res.ok ? d.servers || [] : [{ name: "?", tools: [], error: d.error || "failed" }]);
    } catch (err) { setMcpInfo([{ name: "?", tools: [], error: err.message }]); }
    finally { setMcpBusy(false); }
  };

  const file = project[activeFile] || project[0];

  const parsedMsgs = useMemo(() => messages.map((m) => ({ ...m, blocks: parseBlocks(m.content) })), [messages]);

  if (!authChecked) {
    return (
      <div className="authgate">
        <div className="authgate-card authgate-splash">
          <div className="authgate-brand">✦</div>
          <div className="typing"><span /><span /><span /></div>
          <p>Loading Arynox…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="authgate">
        <a className="authgate-back" href="/">← Home</a>
        <div className="authgate-card">
          <div className="authgate-brand">✦</div>
          <h1>Welcome to Arynox AI</h1>
          <p className="authgate-tag">Sign in to continue — your workspace, files and memory are saved to your account, on any device. Or jump straight in with the demo below.</p>
          <div className="auth-tabs">
            <button className={authTab === "in" ? "active" : ""} onClick={() => { setAuthTab("in"); setAuthError(""); setAuthForgot(false); }}>Sign in</button>
            <button className={authTab === "up" ? "active" : ""} onClick={() => { setAuthTab("up"); setAuthError(""); setAuthForgot(false); }}>Create account</button>
          </div>
          {authReset ? (
            <>
              <p className="authgate-tag">Set a new password for your account.</p>
              <input className="auto-input" type="password" placeholder="New password (min 6 characters)" value={authPass} onChange={(e) => setAuthPass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doResetPassword(); }} />
              <input className="auto-input" type="password" placeholder="Confirm new password" value={authPass2} onChange={(e) => setAuthPass2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doResetPassword(); }} />
              {authError && <div className="auth-error">{authError}</div>}
              <button className="send-btn" style={{ width: "100%" }} disabled={authBusy} onClick={doResetPassword}>{authBusy ? "Working..." : "Save new password"}</button>
              <button className="chip" style={{ width: "100%" }} onClick={() => { setAuthReset(false); setAuthPass(""); setAuthPass2(""); setAuthError(""); }}>← Back to sign in</button>
            </>
          ) : authForgot ? (
            <>
              <p className="authgate-tag">Enter your account email — we'll send a reset link that works for 1 hour.</p>
              <input className="auto-input" type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") forgotPass(); }} />
              {authError && <div className="auth-error">{authError}</div>}
              {authMailInfo && <div className="auth-ok">{authMailInfo}</div>}
              <button className="send-btn" style={{ width: "100%" }} disabled={authBusy} onClick={forgotPass}>{authBusy ? "Working..." : "Send reset link"}</button>
              <button className="chip" style={{ width: "100%" }} onClick={() => { setAuthForgot(false); setAuthError(""); setAuthMailInfo(""); }}>← Back to sign in</button>
            </>
          ) : (
            <>
              {authTab === "up" && <input className="auto-input" placeholder="Your name" value={authName} onChange={(e) => setAuthName(e.target.value)} />}
              <input className="auto-input" type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
              <input className="auto-input" type="password" placeholder="Password (min 6 characters)" value={authPass} onChange={(e) => setAuthPass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doAuth(); }} />
              {authTab === "in" && <button className="auth-forgot" onClick={() => { setAuthForgot(true); setAuthError(""); setAuthMailInfo(""); }}>Forgot password?</button>}
              {authError && <div className="auth-error">{authError}</div>}
              <button className="send-btn" style={{ width: "100%" }} disabled={authBusy} onClick={doAuth}>{authBusy ? "Working..." : authTab === "in" ? "Sign in" : "Create account"}</button>
            </>
          )}
          <div className="auth-or">or</div>
          <button className="chip" style={{ width: "100%" }} disabled={authBusy} onClick={googleSignIn}>🔵 Continue with Google</button>
          <button className="chip demo-btn" style={{ width: "100%" }} disabled={authBusy} onClick={demoSignIn}>⚡ Try a quick demo — no account needed</button>
          <div className="authgate-feats">
            <span>💬 Trilingual chat</span><span>💻 AI code studio + agent</span><span>🎤 Voice & 📷 vision</span><span>📊 Excel · PDF · Word</span><span>📱 Installable app</span>
          </div>
        </div>
        <p className="authgate-foot">Arynox Tech · Ratnagiri, Maharashtra 🇮🇳</p>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="rail">
        <div className="rail-head">
          <div className="rail-brand">✦<span>Arynox AI</span></div>
          <button className="new-chat-btn" onClick={newChat} title="Start a new chat">✏️<span>New chat</span></button>
        </div>
        <div className="rail-convos">
          {convos.length > 0 && <div className="rail-sec-label">Recent</div>}
          {convos.map((c) => (
            <div className={`conv-row ${c.id === activeConvId ? "active" : ""}`} key={c.id} onClick={() => openConvo(c.id)} title={c.title}>
              <span className="conv-title">💬 {c.title}</span>
              <button className="conv-del" title="Delete chat" onClick={(e) => { e.stopPropagation(); deleteConvo(c.id); }}>🗑</button>
            </div>
          ))}
        </div>
        <div className="rail-nav">
          <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>💬<span>Chat</span></button>
          <button className={tab === "ide" ? "active" : ""} onClick={() => setTab("ide")}>💻<span>Code</span></button>
          <button className={tab === "camera" ? "active" : ""} onClick={() => setTab("camera")}>👁<span>Live</span></button>
          <button className={tab === "auto" ? "active" : ""} onClick={() => setTab("auto")}>⚡<span>Automate</span></button>
        </div>
        <div className="rail-foot">
          <button onClick={() => { const next = theme === "light" ? "dark" : theme === "dark" ? "auto" : "light"; setTheme(next); save(KEY.theme, next); }} title="Theme (auto = day/night)">
            {effectiveTheme === "dark" ? "🌙" : "☀️"}<span>{theme === "auto" ? "Auto (day/night)" : effectiveTheme === "dark" ? "Dark" : "Light"}</span>
          </button>
          {!isInstalled && (
            <button className="install-btn" onClick={installApp} title="Install Arynox AI as an app">📲<span>Install</span></button>
          )}
          <button className={`upgrade-btn ${me.premium ? "premium" : ""}`} onClick={() => setUpgradeOpen(true)}>💎<span>{me.premium ? "Pro active" : "Upgrade"}</span></button>
          <button className="upgrade-btn" onClick={() => { if (adminMode) { setUpgradeOpen(true); setTimeout(refreshAdminPanel, 50); } else setAdminOpen(true); }} title="Admin panel">🛡<span>Admin</span></button>
          <button className="upgrade-btn" onClick={() => { setSettingsTab("voice"); setSettingsOpen(true); refreshUsage(); }} title="Settings — voice & usage">⚙<span>Settings</span></button>
          {user ? (
            <button className="user-chip" onClick={signOut} title="Signed in - click to sign out">
              <span className="user-avatar">{(user.name || "U")[0].toUpperCase()}</span>
              <span className="user-email">{user.email || user.name}{user.demo ? " · demo" : ""}</span>
            </button>
          ) : (
            <button className="signin-btn" onClick={() => { setAuthOpen(true); setAuthError(""); }}>👤<span>Sign in</span></button>
          )}
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
              <div className="conv-title-top">{convos.find((c) => c.id === activeConvId)?.title || "New chat"}</div>
              {messages.length > 0 && (
                <div className="toggles">
                  <button className="new-chat-mobile" title="New chat" onClick={newChat}>✏️</button>
                  <button className="icon-btn" title="Download chat" onClick={exportChat}>📥</button>
                  <button className={showMemory ? "active" : ""} onClick={() => setShowMemory(!showMemory)}>🧠<span>Memory</span></button>
                  <label className="chip"><input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} /> 🔊 Speak</label>
                </div>
              )}
            </header>

            <div className="chat">
              {messages.length === 0 && (
                <div className="welcome">
                  <div className="welcome-logo">✦</div>
                  <div className="welcome-title">What can I help with?</div>
                  <div className="welcome-tag">Arynox AI speaks English, हिन्दी and मराठी — and just does what you need</div>
                  <div className="welcome-trust">⭐ Loved in Maharashtra 🇮🇳 · Built by Arynox Tech, Konkan</div>
                  <div className="sugg-grid">
                    <button className="sugg-card" onClick={() => send("Build a calculator app in Python")}><span>🧮</span><div><b>Calculator app</b><em>Python project, run & verify</em></div></button>
                    <button className="sugg-card" onClick={() => send("Create a monthly budget in Excel")}><span>📊</span><div><b>Excel budget</b><em>Spreadsheet, ready to download</em></div></button>
                    <button className="sugg-card" onClick={() => send("What's today's latest tech news?")}><span>🔎</span><div><b>Live info</b><em>Search the web for answers</em></div></button>
                    <button className="sugg-card" onClick={() => send("Draw a futuristic city at night")}><span>🖼️</span><div><b>Generate an image</b><em>Create art on demand</em></div></button>
                    <button className="sugg-card" onClick={() => send("Build a to-do app with HTML, CSS and JS")}><span>💻</span><div><b>Web app project</b><em>Multi-file app in Code</em></div></button>
                    <button className="sugg-card" onClick={() => { pendingPromptRef.current = "Summarize this file"; attachRef.current?.click(); }}><span>📎</span><div><b>Work with files</b><em>Any file — Excel, Word, PDF, audio, images</em></div></button>
                  </div>
                  <div className="welcome-sub">For business owners — hotels, resorts, restaurants in Konkan & beyond</div>
                  <div className="sugg-grid">
                    <button className="sugg-card" onClick={() => { setTab("auto"); }}>🏨<div><b>Set up my business</b><em>Turn the AI into your concierge</em></div></button>
                    <button className="sugg-card" onClick={() => send("Create a booking request form in Excel for my hotel")}><b>📋</b><div><b>Booking form (Excel)</b><em>Guests fill it, you get orders</em></div></button>
                    <button className="sugg-card" onClick={() => send("Make a 2-day Ratnagiri itinerary as a PDF for my guests")}>🗺️<div><b>Itinerary (PDF)</b><em>Ready for your guests</em></div></button>
                    <button className="sugg-card" onClick={() => send("Create a monthly expense sheet for my business")}>💰<div><b>Budget sheet (Excel)</b><em>Track income & expenses</em></div></button>
                  </div>
                </div>
              )}
              {parsedMsgs.map((m, i) => (                <div className={`msg ${m.role}`} key={i}>
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
                        {m.blocks.map((p, j) => p.type === "code" ? <CodeBlock key={j} code={p.code} filename={`solution_${j + 1}.${p.language === "python" ? "py" : "js"}`} /> : <span key={j} dangerouslySetInnerHTML={{ __html: p.html }} />)}
                      </div>
                    )}
                    {m.role === "assistant" && <FileChips files={m.files} />}
                    {m.role === "assistant" && <ToolChips tools={m.tools} />}
                    {m.role === "assistant" && m.suggestions?.length > 0 && (
                      <div className="sugg-row">
                        {m.suggestions.map((s, j) => (
                          <button key={j} className="chip sugg-chip" onClick={() => send(s)}>💬 {s}</button>
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" && !m.image && (
                      <div className="msg-actions">
                        <button className="icon-btn" title="Copy" onClick={() => { navigator.clipboard.writeText(m.content).then(() => showToast("📋 copied to clipboard")); }}>📋</button>
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
              <div className="composer-box">
                <div className="input-row">
                  <input ref={attachRef} type="file" accept="image/*,audio/*,.pdf,.xlsx,.csv,.docx,.doc,.txt,.md,.json,.js,.ts,.py,.html,.css,.zip" hidden onChange={onPickAnyFile} />
                  <button className="tool-btn" title="Attach any file — photo, audio, PDF, Excel, Word, code…" onClick={() => attachRef.current?.click()}>📎</button>
                  <textarea rows={1} placeholder={genMode ? "Describe the image you want..." : "Ask anything — in English, हिन्दी or मराठी"}
                    value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
                  <button className={`tool-btn mic ${recording ? "rec" : ""}`} title={recording ? "Stop" : "Talk"} onClick={recording ? stopRecord : startRecord}>{recording ? "◼" : "🎤"}</button>
                  <button className="send-btn" disabled={!input.trim() || busy} onClick={() => send()}>➤</button>
                </div>
                <div className="composer-foot">
                  <button className={`chip ${genMode ? "on" : ""}`} onClick={() => setGenMode(!genMode)}>✨ {genMode ? "Image mode on" : "Image mode"}</button>
                  <span className="composer-hint">{recording ? "listening..." : busy ? BUSY_STEPS[busyStep] : "Enter to send · Shift+Enter for a new line"}</span>
                  {busy && <button className="stop-btn" onClick={stopGeneration} title="Stop the agent">■ Stop</button>}
                </div>
              </div>
              <p className="composer-disclaimer">Arynox can make mistakes. Check important info.</p>
            </div>
          </>
        )}

        {tab === "ide" && (
          <div className="ide">
            <header className="topbar">
              <div className="brand"><span className="dot busy" /><span className="status">Code — build, run & ask the coding agent</span></div>
              <div className="ide-bar">
                <input ref={projectRef} type="file" webkitdirectory="" multiple hidden onChange={uploadProject} />
                <button className="chip" title="Upload an entire project folder - the AI works on it" onClick={() => projectRef.current?.click()}>📁 Upload project</button>
                <button className={`chip ${idePreview ? "on" : ""}`} onClick={() => setIdePreview(!idePreview)} title="Preview the website live">🌐 Preview</button>
                <button className={`chip ${agentOpen ? "on" : ""}`} onClick={() => setAgentOpen(!agentOpen)} title="Talk to the AI coding agent">🤖 Agent</button>
                <input className="file-name" placeholder="src/new-file.js" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addFile(); }} />
                <button className="chip" onClick={addFile}>＋ File</button>
                <button className="chip" onClick={() => { setRunOut(""); }}>⌫ Clear</button>
                <button className="chip" onClick={downloadProject}>⬇ ZIP</button>
                <button className="chip" onClick={downloadWorkspace} title="Download the agent workspace (all files the AI created)">🤖 Workspace ZIP</button>
                <label className="chip"><input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} /> 🔊 Speak</label>
                <button className="send-btn ide-run" disabled={running} onClick={runProject}>{running ? "Running..." : "▶ Run project"}</button>
              </div>
            </header>
            <div className="ide-split">
              <div className="ide-files">
                <div className="ide-files-head">Project files <span className="file-count">{project.length}</span></div>
                {project.length ? renderFolder(ideTree, "", 0) : <div className="ide-files-empty">No files yet — create one or ask the agent to build an app.</div>}
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
              {agentOpen && (
                <div className="agent-panel">
                  <div className="agent-head">
                    <span>🤖 Coding agent</span>
                    <button className="icon-btn" onClick={() => setAgentOpen(false)} title="Close">✕</button>
                  </div>
                  <div className="agent-body">
                    {codeMsgs.length === 0 && !codeBusy && (
                      <div className="agent-empty">
                        Ask me to build, fix, explain or run your code. I edit your files, verify by running them, and show the output here.
                        <br/><br/>Try: <em>"add a dark-mode toggle to index.html"</em> · <em>"find and fix the bug in main.js"</em> · <em>"explain this file"</em>
                      </div>
                    )}
                    {codeMsgs.map((m, i) => m.role === "user"
                      ? <div className="agent-msg user" key={i}>{m.content}</div>
                      : (
                        <div className="agent-msg ai" key={i}>
                          {parseBlocks(m.content).map((b, j) => b.type === "text"
                            ? <div key={j} dangerouslySetInnerHTML={{ __html: b.html }} />
                            : <CodeBlock key={j} code={b.code} filename={b.language} />)}
                        </div>
                      ))}
                    {codeBusy && <div className="typing" style={{ alignSelf: "flex-start" }}><span /><span /><span /></div>}
                    {codeErr && <div className="auth-error">{codeErr}</div>}
                  </div>
                  <div className="agent-foot">
                    <textarea
                      className="agent-input"
                      placeholder="Ask the agent to code…"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCodeAgent(); } }}
                      rows={2}
                    />
                    <button className="send-btn" disabled={codeBusy || !codeInput.trim()} onClick={sendCodeAgent}>➤</button>
                  </div>
                </div>
              )}
            </div>
            {idePreview && (
              <div className="ide-preview">
                <div className="ide-preview-head">{hasHtml ? "🌐 Live preview — this is how your website looks" : "🌐 Live preview"}</div>
                {hasHtml ? (
                  <iframe src={previewUrl()} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title="Website preview" />
                ) : (
                  <div className="preview-empty">No HTML website in this project yet. Ask Arynox to build one (e.g. "build a website") or add an index.html file — it will render right here.</div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "camera" && (
          <div className="camera">
            <header className="topbar">
              <div className="brand"><span className={`dot ${camOn ? "busy" : ""}`} /><span className="status">{camOn ? (aiVision ? "⚡ on-device AI vision — people, vehicles, objects & documents" : "watching what's in front of the camera") : "camera is off"}</span></div>
              <div className="toggles cam-toggles">
                {camOn && camDevices.length > 1 && (
                  <>
                    <button className="chip" onClick={flipCamera} title="Switch front / back camera">🔃 <span className="cam-toggle-label">Switch</span></button>
                    <select className="cam-select" value={activeCamId || ""} onChange={(e) => switchCamera(e.target.value)} title="Choose camera">
                      {camDevices.map((d, i) => (
                        <option key={d.id} value={d.id}>{d.label.replace(/\(.*\)/g, "").trim() || `Camera ${i + 1}`}</option>
                      ))}
                    </select>
                  </>
                )}
                {camOn && <button className={`chip ${watchMode ? "cam-on" : ""}`} onClick={toggleWatch} title="Look, think and speak every 30 seconds">👀 <span className="cam-toggle-label">{watchMode ? "Watching…" : "Watch"}</span></button>}
                {camOn && <button className="chip" onClick={() => setVoiceAlerts((v) => !v)} title="Spoken vehicle alerts">{voiceAlerts ? "🔊" : "🔇"} <span className="cam-toggle-label">{voiceAlerts ? "Alerts on" : "Alerts off"}</span></button>}
                {camOn && <button className="chip" onClick={() => setDetectPaused((p) => !p)}>{detectPaused ? "▶ Resume" : "⏸ Pause"}</button>}
                {kioskOn ? <button className="chip cam-off" onClick={kioskStop}>🧑🤝🧑 Stop visitor mode</button> : <button className="chip cam-on" onClick={kioskStart}>🧑🤝🧑 Visitor mode</button>}
                {camOn ? <button className="chip cam-off" onClick={stopCamera}>■ Stop</button> : <button className="chip cam-on" onClick={startCamera}>● Start seeing</button>}
              </div>
            </header>
            <div className="cam-stage">
              <div className="cam-frame">
                <video ref={videoRef} muted playsInline />
                <canvas ref={overlayRef} className="cam-overlay" />
                {vehicleAlert && (
                  <div className="vehicle-alert">
                    <span className="vehicle-pulse" />
                    ⚠️ {VEHICLE_LABEL[vehicleAlert.name] || vehicleAlert.name} approaching — {vehicleAlert.dist === "near" ? "very close!" : vehicleAlert.dist === "medium" ? "getting closer" : "in the distance"} · {vehicleAlert.score}%
                  </div>
                )}
                {!camOn && (
                  <div className="cam-placeholder">
                    <span>👁</span>
                    <p className="cam-place-title">See the world live</p>
                    <p>Press <b>Start seeing</b> and I will detect <b>people, vehicles, animals, objects and documents</b> in real time — on your device. Ask questions, get spoken answers and live web data.</p>
                    <button className="send-btn cam-big" onClick={startCamera}>● Start seeing</button>
                  </div>
                )}
                {camOn && objects.length > 0 && (
                  <div className="overlay">
                    {objects.map((o, i) => (
                      <span className={`detect-chip ${o.name === "person" ? "chip-human" : o.name === "document" ? "chip-doc" : VEHICLES.includes(o.name) ? "chip-vehicle" : ""}`} key={i}>
                        {OBJECT_ICONS[o.name] || "🔸"} {o.name}{o.count > 1 ? ` ×${o.count}` : ""}
                      </span>
                    ))}
                  </div>
                )}
                <div className="cam-legend">
                  <span><i className="lg-human" /> human</span>
                  <span><i className="lg-vehicle" /> vehicle</span>
                  <span><i className="lg-doc" /> document</span>
                  <span><i className="lg-obj" /> object</span>
                </div>
              </div>
              <div className="detect-panel">
                <div className="detect-title">{camOn ? "I can see:" : "Detection is off"}</div>
                {camOn && !aiVision && !aiFailed && <div className="detect-empty">Loading on-device AI…</div>}
                {camOn && aiFailed && <div className="detect-empty">Offline model unavailable — using cloud vision (every ~3s).</div>}
                {camOn && objects.length === 0 && aiVision && <div className="detect-empty">{detecting ? "Looking…" : "Looking around…"}</div>}
                <div className="detect-list">
                  {boxes.filter((b) => b.name === "person").map((b, i) => (
                    <div className="detect-row row-human" key={`h${i}`}><span>🧍</span> human <em>{Math.round(b.score * 100)}%</em></div>
                  ))}
                  {boxes.filter((b) => VEHICLES.includes(b.name)).map((b, i) => (
                    <div className="detect-row row-vehicle" key={`v${i}`}><span>{OBJECT_ICONS[b.name] || "🚗"}</span> {VEHICLE_LABEL[b.name] || b.name} <em>{Math.round(b.score * 100)}%</em></div>
                  ))}
                  {docs.map((d, i) => (
                    <div className="detect-row row-doc" key={`d${i}`}><span>📄</span> document <em>detected</em></div>
                  ))}
                  {objects.filter((o) => o.name !== "person" && !VEHICLES.includes(o.name)).map((o, i) => (
                    <div className="detect-row" key={i}><span>{OBJECT_ICONS[o.name] || "🔸"}</span> {o.name} <em>×{o.count}</em></div>
                  ))}
                </div>
                {camOn && (
                  <button className="chip speak-seen" onClick={() => speak("I can see " + objects.map((o) => o.name + (o.count > 1 ? `, ${o.count}` : "")).join(", "), "en")}>🔊 Tell me what you see</button>
                )}
                {camOn && (
                  <div className="live-ask">
                    <div className="live-ask-head"><span>🎤 Live assistant</span><em>sees · speaks · searches the web</em></div>
                    {liveReplies.length > 0 && (
                      <div className="live-replies">
                        {liveReplies.map((r, i) => (
                          <div className="live-reply" key={i}>
                            <b>{r.t || ""}</b> {r.q && <em>“{r.q}”</em>}
                            <p>{r.a}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="live-ask-row">
                      <input className="live-ask-input" placeholder={liveBusy ? "Looking & thinking…" : "Ask about what I'm seeing…"} value={liveAsk}
                        onChange={(e) => setLiveAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") askLive(); }} disabled={liveBusy} />
                      <button className="send-btn live-ask-btn" disabled={!liveAsk.trim() || liveBusy} onClick={() => askLive()}>➤</button>
                    </div>
                    <div className="live-ask-hints">
                      <button className="chip" disabled={liveBusy} onClick={() => askLive("What am I looking at? Describe it in 2 short sentences.")}>👀 What do you see?</button>
                      <button className="chip" disabled={liveBusy} onClick={() => askLive("Look at this, check the web for the latest information about it, and tell me the newest details.")}>🔎 See + search web</button>
                      <button className="chip" disabled={liveBusy} onClick={toggleWatch}>{watchMode ? "⏸ Stop watching" : "👀 Watch mode (30s)"}</button>
                    </div>
                    {liveBusy && <div className="typing" style={{ alignSelf: "flex-start" }}><span /><span /><span /></div>}
                  </div>
                )}
                {kioskOn && (
                  <div className="kiosk-card">
                    <div className="kiosk-head">
                      <b>🧑🤝🧑 Visitor assistant</b>
                      <button className="chip" onClick={kioskReset}>↺ Reset</button>
                    </div>
                    <p className="kiosk-status">{kioskStatus || "Waiting…"}</p>
                    {kioskStep === "ask_name" && <p className="kiosk-hint">🎤 Speaking — mic listening for their name…</p>}
                    {kioskStep === "ask_looking" && <p className="kiosk-hint">🎤 Listening for what they need…</p>}
                    {kioskStep === "guiding" && <p className="kiosk-hint">⏳ Asking the assistant how to help…</p>}
                    {kioskName && <p className="kiosk-visitor">👤 Visitor: <b>{kioskName}</b>{kioskLooking ? ` — looking for: ${kioskLooking}` : ""}</p>}
                    <button className="chip kiosk-listen" disabled={kioskBusy || recording} onClick={kioskListen}>{recording ? "◼ Listening…" : "🎤 Answer now (voice)"}</button>
                    <div className="kiosk-visitors">
                      <div className="kiosk-visitors-head">📋 Visitors today <button className="icon-btn" title="Clear log" onClick={() => { setVisitors([]); save("arynox_visitors", []); try { fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ action: "clear_visitors" }) }).catch(() => {}); } catch {} }}>🗑</button></div>
                      {visitors.length === 0 && <div className="detect-empty">No visitors yet — turn on visitor mode and the assistant will greet people and save their name + what they need.</div>}
                      {visitors.slice(0, 12).map((v, i) => (
                        <div className="visitor-row" key={i}><span className="visitor-name">👤 {v.name}</span>{v.lookingFor ? <span className="visitor-need">🔍 {v.lookingFor}</span> : null}<em className="visitor-at">{v.at}</em></div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="detect-note">⚡ Real-time on-device AI (COCO-SSD + document scanner). Vehicle alerts, watch mode and the live assistant use your camera — nothing is recorded or uploaded.</p>
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
              <div className="auto-card guide-card">
                <div className="guide-card-head">
                  <span>📘 How to get credentials — step by step</span>
                  <button className="chip" onClick={() => setGuideOpen(guideOpen ? "" : "github")}>{guideOpen ? "Collapse" : "Open guides"}</button>
                </div>
                <div className="guide-list">
                  {CRED_GUIDES.map((g) => <CredGuide key={g.id} id={g.id} open={guideOpen} onToggle={setGuideOpen} />)}
                </div>
              </div>
              <div className="auto-strip">
                <div className="auto-card usage-mini">
                  <div className="auto-card-title">📊 Your usage</div>
                  {!user?.token ? (
                    <p className="auto-note">Sign in to get your personal dashboard — WhatsApp, chat, images, code and more.</p>
                  ) : (
                    <div className="usage-mini-grid">
                      {[["chat", "💬"], ["images", "🖼️"], ["code", "⚙️"], ["live_vision", "👁"], ["whatsapp", "🟢"], ["email", "✉️"], ["github", "🐙"], ["web", "🔎"]].map(([k, icon]) => (
                        <div className="usage-mini-tile" key={k}><span>{icon}</span><b>{usage?.usage?.[k] || 0}</b></div>
                      ))}
                    </div>
                  )}
                  <div className="auto-actions">
                    <button className="chip" onClick={() => { setSettingsTab("usage"); setSettingsOpen(true); refreshUsage(); }}>📊 Open full dashboard</button>
                  </div>
                </div>
                <div className="auto-card wa-templates">
                  <div className="auto-card-title">🟢 Ready-made WhatsApp automations</div>
                  <p className="auto-note">Pick a template, fill 4–5 fields, and send — perfect for banks (loan reminders), hotels (bookings) and restaurants (orders).</p>
                  <div className="wa-tpl-grid">
                    {WA_TEMPLATES.map((t) => (
                      <button className={`wa-tpl ${waTpl?.id === t.id ? "on" : ""}`} key={t.id} onClick={() => setWaTpl(waTpl?.id === t.id ? null : { ...t, f: {} })}>
                        <span>{t.icon}</span><b>{t.title}</b><em>{t.tag}</em>
                      </button>
                    ))}
                  </div>
                  {waTpl && (
                    <div className="wa-tpl-form">
                      {waTpl.fields.map((fld) => (
                        <input key={fld.k} className="auto-input" placeholder={fld.ph} value={waTpl.f[fld.k] || ""}
                          onChange={(e) => setWaTpl({ ...waTpl, f: { ...waTpl.f, [fld.k]: e.target.value } })} />
                      ))}
                      <textarea className="auto-input" rows={6} readOnly value={waTpl.make(waTpl.f)} />
                      <div className="auto-actions">
                        <button className="chip" disabled={waBusy} onClick={async () => {
                          const msg = waTpl.make(waTpl.f);
                          const phone = prompt("Send to WhatsApp number (with country code, e.g. 919876543210):");
                          if (!phone) return;
                          setWaBusy(true);
                          try {
                            const res = await fetch("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ to: phone, message: msg }), signal: AbortSignal.timeout(30000) });
                            const d = await res.json();
                            if (d.waLink) { window.open(d.waLink, "_blank"); showToast("WhatsApp API not configured — opened WhatsApp chat instead"); }
                            else if (res.ok) { showToast("✅ WhatsApp message sent!"); trackUsage("whatsapp"); }
                            else throw new Error(d.error || "send failed");
                          } catch (err) {
                            window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                            showToast("Opened WhatsApp — tap send to deliver");
                          } finally { setWaBusy(false); }
                        }}>{waBusy ? "Sending…" : "🟢 Send via WhatsApp"}</button>
                        <button className="chip" onClick={() => { navigator.clipboard?.writeText(waTpl.make(waTpl.f)); showToast("📋 copied — paste it into WhatsApp"); }}>📋 Copy message</button>
                        <button className="chip" onClick={() => { const to = prompt("Email it to:", creds.gmailUser || ""); if (to) runAutomation("gmail_send", { to, subject: waTpl.title, body: waTpl.make(waTpl.f) }); }}>✉️ Email it</button>
                      </div>
                      <p className="auto-note">💡 Need the real WhatsApp Business API for automatic sends? The app owner configures 3 server variables — see the guide above.</p>
                    </div>
                  )}
                </div>
                <div className="auto-card connect-ai">
                  <div className="auto-card-title">🤖 Connect anything with AI help</div>
                  <p className="auto-note">Not sure how to connect Gmail, GitHub, WhatsApp or any other app? Ask the assistant to walk you through it, or set it up for you.</p>
                  <div className="auto-actions">
                    <button className="chip" onClick={() => { setTab("chat"); send("Walk me through connecting Gmail, GitHub and WhatsApp to Arynox step by step — keep it simple."); }}>💬 Ask AI to connect</button>
                  </div>
                </div>
              </div>
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
                      <button className="chip" onClick={() => setGuideOpen("github")}>❓ How to get a token</button>
                    </div>
                  </div>
                  <div className="auto-card">
                    <div className="auto-card-title">✉️ Gmail</div>
                    <input className="auto-input" placeholder="Your Gmail address" value={creds.gmailUser} onChange={(e) => setCred("gmailUser", e.target.value)} />
                    <input className="auto-input" type="password" placeholder="App Password (Google > App passwords)" value={creds.gmailPass} onChange={(e) => setCred("gmailPass", e.target.value)} />
                    <div className="auto-actions">
                      <button className="chip" disabled={autoRunning !== ""} onClick={() => { const to = prompt("Send to:", creds.gmailUser); if (to) runAutomation("gmail_send", { to, subject: "Test from Arynox AI", body: "Hello! This is a test email sent by Arynox AI. 🚀" }); }}>✉️ Send test email</button>
                      <button className="chip" onClick={() => setGuideOpen("gmail")}>❓ How to get an app password</button>
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
                      <button className="chip" onClick={() => setGuideOpen("mcp")}>❓ How to add a server</button>
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
                    <div className="auto-card-title">🏨 Business assistant — concierge mode</div>
                    <p className="auto-note">Set up your hotel, resort or restaurant and the AI becomes its guest-facing assistant: bookings, itineraries, invoices and budgets — in English, Hindi or Marathi.</p>
                    <input className="auto-input" placeholder="Business name (e.g. Hotel Konkan Darshan)" value={business?.name || ""} onChange={(e) => setBusinessProfile({ name: e.target.value })} />
                    <select className="auto-input" value={business?.type || "Hotel"} onChange={(e) => setBusinessProfile({ type: e.target.value })}>
                      {["Hotel", "Resort", "Homestay", "Restaurant", "Travel & Tours", "Diving & Watersports", "Other"].map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <input className="auto-input" placeholder="Location (e.g. Ratnagiri, Maharashtra)" value={business?.location || ""} onChange={(e) => setBusinessProfile({ location: e.target.value })} />
                    <input className="auto-input" placeholder="Phone / WhatsApp number" value={business?.phone || ""} onChange={(e) => setBusinessProfile({ phone: e.target.value })} />
                    <input className="auto-input" placeholder="Email" value={business?.email || ""} onChange={(e) => setBusinessProfile({ email: e.target.value })} />
                    <textarea className="auto-input" rows={2} placeholder="Rooms, prices, food, activities... (what guests should know)" value={business?.services || ""} onChange={(e) => setBusinessProfile({ services: e.target.value })} />
                    <div className="auto-actions">
                      <button className="chip" disabled={!business?.name?.trim()} onClick={() => { setTab("chat"); send(`I have set up my business: ${JSON.stringify(business).slice(0, 300)}. Confirm you know my business now.`); }}>💬 Activate in chat</button>
                    </div>
                    {!user && (
                      <p className="auto-note">🔒 Save this to your account so it follows you: <button className="chip" onClick={() => setAuthOpen(true)}>Sign in</button></p>
                    )}
                  </div>
                  <div className="auto-card">
                    <div className="auto-card-title">💬 WhatsApp bot</div>
                    <p className="auto-note">Guests message your WhatsApp number and the AI answers in Marathi, Hindi or English — booking requests, timings, prices, nearby places.</p>
                    <div className="auto-actions">
                      <button className="chip" onClick={() => setGuideOpen("whatsapp")}>❓ How to get the WhatsApp API</button>
                    </div>
                    <p className="auto-note">The bot is enabled by the app owner (3 server variables: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN — see the guide for the full Meta setup).</p>
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

      {settingsOpen && (
        <div className="modal" onClick={() => setSettingsOpen(false)}>
          <div className="auth-modal settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-head">
              <span>⚙ Settings</span>
              <button className="icon-btn" onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <div className="auth-tabs">
              <button className={settingsTab === "voice" ? "active" : ""} onClick={() => setSettingsTab("voice")}>🎙 Voice</button>
              <button className={settingsTab === "usage" ? "active" : ""} onClick={() => { setSettingsTab("usage"); refreshUsage(); }}>📊 My usage</button>
            </div>
            {settingsTab === "voice" && (
              <div className="settings-body">
                <label className="settings-label">Voice provider</label>
                <div className="voice-providers">
                  {[{ id: "server", icon: "🔊", name: "Arynox voice", desc: "Premium cloud voice — works everywhere" }, { id: "browser", icon: "🌐", name: "Device voices", desc: "Free voices on this device (English, हिन्दी, मराठी)" }, { id: "voicebox", icon: "🎛", name: "Voicebox (my voices)", desc: "Use cloned / custom voices from the free Voicebox app" }].map((p) => (
                    <button key={p.id} className={`voice-provider ${voiceSet.provider === p.id ? "on" : ""}`} onClick={() => { const nv = { ...voiceSet, provider: p.id }; setVoiceSet(nv); save(KEY.voice, nv); }}>
                      <span>{p.icon}</span><b>{p.name}</b><em>{p.desc}</em>
                    </button>
                  ))}
                </div>
                {voiceSet.provider === "browser" && (
                  <div className="settings-section">
                    <label className="settings-label">Device voice</label>
                    <select className="auto-input" value={voiceSet.browserVoice || ""} onChange={(e) => { const nv = { ...voiceSet, browserVoice: e.target.value }; setVoiceSet(nv); save(KEY.voice, nv); }}>
                      <option value="">Auto (match language)</option>
                      {(window.speechSynthesis?.getVoices() || []).map((v, i) => (
                        <option key={i} value={v.voiceURI}>{v.name} ({v.lang})</option>
                      ))}
                    </select>
                    <div className="settings-sliders">
                      <label>Speed <input type="range" min="0.5" max="1.5" step="0.1" value={voiceSet.rate || 1} onChange={(e) => { const nv = { ...voiceSet, rate: Number(e.target.value) }; setVoiceSet(nv); save(KEY.voice, nv); }} /></label>
                      <label>Pitch <input type="range" min="0.5" max="1.5" step="0.1" value={voiceSet.pitch || 1} onChange={(e) => { const nv = { ...voiceSet, pitch: Number(e.target.value) }; setVoiceSet(nv); save(KEY.voice, nv); }} /></label>
                    </div>
                    <button className="chip" onClick={() => speakBrowser("Hello! This is how my voice sounds. नमस्कार! मी मराठीत बोलू शकतो.", "en")}>▶ Test this voice</button>
                  </div>
                )}
                {voiceSet.provider === "voicebox" && (
                  <div className="settings-section">
                    <label className="settings-label">Voicebox app URL</label>
                    <input className="auto-input" value={voiceSet.vbUrl || "http://127.0.0.1:17493"} onChange={(e) => { const nv = { ...voiceSet, vbUrl: e.target.value }; setVoiceSet(nv); save(KEY.voice, nv); }} />
                    <button className="chip" disabled={vbTesting} onClick={testVoicebox}>{vbTesting ? "Testing…" : "🔌 Test connection"}</button>
                    {vbProfiles && vbProfiles.length > 0 && (
                      <>
                        <label className="settings-label">Your voice</label>
                        <select className="auto-input" value={voiceSet.vbProfile || ""} onChange={(e) => { const nv = { ...voiceSet, vbProfile: e.target.value }; setVoiceSet(nv); save(KEY.voice, nv); }}>
                          <option value="">Default voice</option>
                          {vbProfiles.map((p, i) => (
                            <option key={i} value={p.id || p.name || ""}>{(p.name || p.id || "Voice " + (i + 1))}</option>
                          ))}
                        </select>
                      </>
                    )}
                    <p className="auto-note">🎛 Voicebox is a free open-source app (voicebox.sh). Install it on your PC, clone your voice with a few seconds of audio, and Arynox will speak in that voice. Make sure Voicebox is running before chatting.</p>
                  </div>
                )}
                {voiceSet.provider !== "voicebox" && (
                  <p className="auto-note">Tip: to use <b>your own cloned voice</b>, pick the Voicebox provider and install the free open-source app from voicebox.sh — clone any voice in seconds.</p>
                )}
              </div>
            )}
            {settingsTab === "usage" && (
              <div className="settings-body">
                {!user?.token ? (
                  <div className="usage-empty">
                    <p>📊 Your personal usage dashboard is saved to your account.</p>
                    <button className="send-btn" style={{ width: "100%" }} onClick={() => { setSettingsOpen(false); setAuthOpen(true); }}>Sign in to see it</button>
                  </div>
                ) : usage ? (
                  <>
                    <div className="usage-grid">
                      {[["chat", "💬", "Chat messages"], ["images", "🖼️", "Images"], ["code", "⚙️", "Code runs"], ["live_vision", "👁", "Live vision"], ["whatsapp", "🟢", "WhatsApp"], ["email", "✉️", "Emails"], ["github", "🐙", "GitHub"], ["web", "🔎", "Web searches"]].map(([k, icon, label]) => (
                        <div className="usage-tile" key={k}>
                          <span>{icon}</span>
                          <b>{usage.usage?.[k] || 0}</b>
                          <em>{label}</em>
                        </div>
                      ))}
                    </div>
                    <p className="auto-note">All-time totals for your account{usage.today ? ` · today: ${new Date().toISOString().slice(0, 10)}` : ""}. WhatsApp messages count when you send via the ready-made templates.</p>
                  </>
                ) : (
                  <p className="auto-note">Loading your usage…</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {authOpen && (
        <div className="modal" onClick={() => setAuthOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-head">
              <span>{user ? "Signed in" : authTab === "in" ? "Welcome back" : "Create your account"}</span>
              <button className="icon-btn" onClick={() => setAuthOpen(false)}>✕</button>
            </div>
            {user ? (
              <div className="auth-body">
                <div className="auth-avatar">{(user.name || "U")[0].toUpperCase()}</div>
                <b>{user.name}</b>
                <span className="auth-email">{user.email}</span>
                <p className="auto-note">✓ Signed in — your workspace and files are saved to your account.</p>
                <button className="send-btn" style={{ width: "100%" }} onClick={() => { setAuthOpen(false); signOut(); }}>Sign out</button>
              </div>
            ) : (
              <div className="auth-body">
                <div className="auth-tabs">
                  <button className={authTab === "in" ? "active" : ""} onClick={() => { setAuthTab("in"); setAuthError(""); setAuthForgot(false); }}>Sign in</button>
                  <button className={authTab === "up" ? "active" : ""} onClick={() => { setAuthTab("up"); setAuthError(""); setAuthForgot(false); }}>Create account</button>
                </div>
                {authReset ? (
                  <>
                    <input className="auto-input" type="password" placeholder="New password (min 6 characters)" value={authPass} onChange={(e) => setAuthPass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doResetPassword(); }} />
                    <input className="auto-input" type="password" placeholder="Confirm new password" value={authPass2} onChange={(e) => setAuthPass2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doResetPassword(); }} />
                    {authError && <div className="auth-error">{authError}</div>}
                    <button className="send-btn" style={{ width: "100%" }} disabled={authBusy} onClick={doResetPassword}>{authBusy ? "Working..." : "Save new password"}</button>
                    <button className="chip" style={{ width: "100%" }} onClick={() => { setAuthReset(false); setAuthPass(""); setAuthPass2(""); setAuthError(""); }}>← Back to sign in</button>
                  </>
                ) : authForgot ? (
                  <>
                    <input className="auto-input" type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") forgotPass(); }} />
                    {authError && <div className="auth-error">{authError}</div>}
                    {authMailInfo && <div className="auth-ok">{authMailInfo}</div>}
                    <button className="send-btn" style={{ width: "100%" }} disabled={authBusy} onClick={forgotPass}>{authBusy ? "Working..." : "Send reset link"}</button>
                    <button className="chip" style={{ width: "100%" }} onClick={() => { setAuthForgot(false); setAuthError(""); setAuthMailInfo(""); }}>← Back to sign in</button>
                  </>
                ) : (
                  <>
                    {authTab === "up" && <input className="auto-input" placeholder="Your name" value={authName} onChange={(e) => setAuthName(e.target.value)} />}
                    <input className="auto-input" type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                    <input className="auto-input" type="password" placeholder="Password (min 6 characters)" value={authPass} onChange={(e) => setAuthPass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doAuth(); }} />
                    {authTab === "in" && <button className="auth-forgot" onClick={() => { setAuthForgot(true); setAuthError(""); setAuthMailInfo(""); }}>Forgot password?</button>}
                    {authError && <div className="auth-error">{authError}</div>}
                    <button className="send-btn" style={{ width: "100%" }} disabled={authBusy} onClick={doAuth}>{authBusy ? "Working..." : authTab === "in" ? "Sign in" : "Create account"}</button>
                  </>
                )}
                <div className="auth-or">or</div>
                <button className="chip" style={{ width: "100%" }} disabled={authBusy} onClick={googleSignIn}>🔵 Continue with Google</button>
                <button className="chip face-btn" style={{ width: "100%" }} disabled={authBusy} onClick={() => { setFaceOpen(true); setFaceErr(""); setFaceMsg(""); setAuthError(""); }}>😀 {authTab === "up" ? "Create account with your face" : "Sign in with your face"}</button>
                <button className="chip demo-btn" style={{ width: "100%" }} disabled={authBusy} onClick={demoSignIn}>⚡ Try a quick demo — no account needed</button>
                <p className="auto-note">Your workspace, files and business profile are saved to your account — sign in on any device to continue.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {faceOpen && (
        <div className="modal" onClick={stopFace}>
          <div className="auth-modal face-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-head">
              <span>{authTab === "up" ? "😀 Create account with your face" : "😀 Sign in with your face"}</span>
              <button className="icon-btn" onClick={stopFace}>✕</button>
            </div>
            <div className="auth-body">
              <div className="face-box">
                <video ref={faceVideoRef} muted playsInline />
                {!faceErr && <div className="face-hint">{faceBusy ? "Scanning your face…" : "Look straight at the camera, in good light, and keep still."}</div>}
              </div>
              {faceErr && <div className="auth-error">{faceErr}</div>}
              {faceMsg && <div className="auth-ok">{faceMsg}</div>}
              <button className="send-btn" style={{ width: "100%" }} disabled={faceBusy} onClick={captureFace}>{faceBusy ? "Working…" : "📸 Capture my face"}</button>
              <button className="chip" style={{ width: "100%" }} onClick={stopFace}>← Back</button>
              <p className="auto-note">🔒 Your face is converted into a private mathematical signature and matched on the server. The raw photo is never stored or shared.</p>
            </div>
          </div>
        </div>
      )}

      {upgradeOpen && (
        <div className="modal" onClick={() => setUpgradeOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-head">
              <span>{adminMode ? "🛡 Admin panel" : "💎 Arynox Pro"}</span>
              <div className="admin-head-actions">
                {adminMode && <button className="chip" onClick={refreshAdminPanel}>{adminBusy ? "Refreshing…" : "↺ Refresh"}</button>}
                {adminToken && <button className="icon-btn" title="Log out of admin" onClick={() => { setAdminToken(null); save("arynox_admin", null); setMe((prev) => ({ ...prev, isAdmin: false })); showToast("Admin session closed"); }}>🚪</button>}
                <button className="icon-btn" onClick={() => setUpgradeOpen(false)}>✕</button>
              </div>
            </div>
            <div className="auth-body">
              {adminMode ? (
                <>
                  <div className="admin-tabs">
                    <button className={`chip ${adminTab === "grants" ? "on" : ""}`} onClick={() => setAdminTab("grants")}>💎 Access</button>
                    <button className={`chip ${adminTab === "users" ? "on" : ""}`} onClick={() => setAdminTab("users")}>👥 Users</button>
                    <button className={`chip ${adminTab === "settings" ? "on" : ""}`} onClick={() => setAdminTab("settings")}>🔧 Keys & connections</button>
                  </div>

                  {adminTab === "grants" && (
                    <div className="admin-panel">
                      <div className="admin-title">💎 Grant Pro access</div>
                      <div className="admin-row">
                        <input className="auto-input" placeholder="person@email.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                        <input className="auto-input admin-days" type="number" min="1" max="3650" value={adminDays} onChange={(e) => setAdminDays(Number(e.target.value) || 30)} title="Days of access" />
                        <button className="chip" disabled={adminBusy} onClick={async () => {
                          if (!adminEmail.includes("@")) { showToast("⚠️ enter the person's email"); return; }
                          const d = await adminAct("grant", { email: adminEmail.trim(), days: adminDays });
                          if (d) setAdminEmail("");
                        }}>{adminBusy ? "Granting…" : "💎 Grant"}</button>
                      </div>
                      <div className="admin-list">
                        {adminList.length === 0 && <div className="detect-empty">No active grants yet.</div>}
                        {adminList.map((p) => (
                          <div className="admin-grant" key={p.email}>
                            <span>{p.email}</span><em>until {new Date(p.until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</em>
                            <button className="icon-btn" title="Revoke" onClick={() => adminAct("revoke", { email: p.email })}>✕</button>
                          </div>
                        ))}
                      </div>
                      <div className="admin-title">📋 Visitors (from Live visitor mode)</div>
                      <div className="admin-list">
                        {visitors.length === 0 && <div className="detect-empty">No visitors recorded yet.</div>}
                        {visitors.slice(0, 15).map((v, i) => (
                          <div className="visitor-row" key={i}><span className="visitor-name">👤 {v.name}</span>{v.lookingFor ? <span className="visitor-need">🔍 {v.lookingFor}</span> : null}<em className="visitor-at">{v.at}</em></div>
                        ))}
                      </div>
                    </div>
                  )}

                  {adminTab === "users" && (
                    <div className="admin-panel">
                      <div className="admin-title">👥 Everyone who signed in</div>
                      <div className="admin-list">
                        {usersList.length === 0 && <div className="detect-empty">No users yet — when people sign in they appear here automatically.</div>}
                        {usersList.map((u) => (
                          <div className="admin-user" key={u.email}>
                            <div className="admin-user-main">
                              <b>{u.name || u.email}</b>
                              <span className="admin-user-mail">{u.email}</span>
                              <span className="admin-user-meta">last seen {new Date(u.lastSeen).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div className="admin-user-badges">
                              {u.premium > 0 && <span className="badge badge-pro">💎 {Math.ceil((u.premium - Date.now()) / 86400000)}d</span>}
                              {u.blocked && <span className="badge badge-block">🔒 blocked</span>}
                            </div>
                            <div className="admin-user-actions">
                              <button className="chip" disabled={adminBusy} onClick={() => adminAct("grant", { email: u.email, days: 30 })}>💎 30d</button>
                              {u.blocked
                                ? <button className="chip" disabled={adminBusy} onClick={() => adminAct("unblock", { email: u.email })}>🔓 Unblock</button>
                                : <button className="chip cam-off" disabled={adminBusy} onClick={() => adminAct("block", { email: u.email, name: u.name })}>🔒 Block</button>}
                              <button className="icon-btn danger" title="Remove user" disabled={adminBusy} onClick={async () => {
                                if (confirm(`Remove ${u.email} completely? This deletes their account and access.`)) await adminAct("remove", { email: u.email });
                              }}>🗑</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="auto-note">Block = they cannot chat or build until unblocked. Remove = account deleted (needs SUPABASE_SECRET_KEY for full deletion) + premium revoked.</p>
                    </div>
                  )}

                  {adminTab === "settings" && (
                    <div className="admin-panel">
                      <div className="admin-title">🔑 API keys & connections</div>
                      <p className="auto-note">Saved here → active immediately. To make them permanent, download the .env below and paste it on Render & Vercel.</p>
                      {keysList.map((k) => (
                        <div className="key-row" key={k.key}>
                          <label className="key-label">{k.key.replace(/_/g, " ")}{k.runtime ? <span className="badge badge-pro">runtime</span> : k.value ? <span className="badge badge-ok">set</span> : <span className="badge badge-miss">missing</span>}</label>
                          <input className="auto-input" type={/PASS|TOKEN|KEY|SECRET/.test(k.key) ? "password" : "text"} value={k.value} placeholder={`${k.key}=`} onChange={(e) => {
                            const v = e.target.value;
                            setKeysList((prev) => prev.map((x) => (x.key === k.key ? { ...x, value: v } : x)));
                          }} />
                        </div>
                      ))}
                      <div className="admin-row" style={{ marginTop: 10 }}>
                        <button className="chip" disabled={keysBusy} onClick={async () => {
                          setKeysBusy(true);
                          try {
                            const h = { "Content-Type": "application/json", ...(me.isAdmin ? authHeaders() : adminHeaders()) };
                            const res = await fetch("/api/admin", { method: "POST", headers: h, body: JSON.stringify({ action: "keys_set", keys: keysList.map((k) => ({ key: k.key, value: k.value })) }), signal: AbortSignal.timeout(20000) });
                            const d = await res.json();
                            if (!res.ok) throw new Error(d.error || "failed");
                            showToast(d.result || "Settings saved");
                            setKeysList(d.keys || keysList);
                          } catch (err) { showToast("⚠️ " + err.message); }
                          finally { setKeysBusy(false); }
                        }}>{keysBusy ? "Saving…" : "💾 Save all"}</button>
                        <button className="chip" disabled={keysBusy} onClick={async () => {
                          try {
                            const h = { "Content-Type": "application/json", ...(me.isAdmin ? authHeaders() : adminHeaders()) };
                            const res = await fetch("/api/admin", { method: "POST", headers: h, body: JSON.stringify({ action: "env" }), signal: AbortSignal.timeout(20000) });
                            const d = await res.json();
                            if (!res.ok) throw new Error(d.error || "failed");
                            const url = URL.createObjectURL(new Blob([d.env], { type: "text/plain" }));
                            const a = document.createElement("a"); a.href = url; a.download = ".env"; a.click();
                            URL.revokeObjectURL(url);
                            showToast("📄 .env downloaded — paste into Render/Vercel to make permanent");
                          } catch (err) { showToast("⚠️ " + err.message); }
                        }}>📄 Download .env</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="premium-banner off">You are on the <b>free plan</b> — everything you see works now.</div>
                  <div className="plan-price">₹299<span>/month</span></div>
                  <ul className="plan-features">
                    <li>⚡ Faster models with unlimited deep research</li>
                    <li>💬 WhatsApp bot for your own business number</li>
                    <li>🏨 Concierge mode with booking & invoice flows</li>
                    <li>📁 Bigger workspaces & longer projects</li>
                    <li>⭐ Priority support in Marathi / Hindi / English</li>
                  </ul>
                  <button className="send-btn" style={{ width: "100%" }} onClick={() => { setUpgradeOpen(false); showToast("🎉 you are on the waitlist — Pro launches soon"); }}>Join the waitlist</button>
                  <p className="auto-note">Pro access is granted by the app owner. Ask them for a 💎 grant with your email.</p>
                  <button className="chip admin-login-btn" onClick={() => setAdminOpen(true)}>🛡 Admin login</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {adminOpen && (
        <div className="modal" onClick={() => setAdminOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-head">
              <span>🛡 Admin login</span>
              <button className="icon-btn" onClick={() => setAdminOpen(false)}>✕</button>
            </div>
            <div className="auth-body">
              <input className="auto-input" placeholder="Username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doAdminLogin(); }} />
              <input className="auto-input" type="password" placeholder="Password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doAdminLogin(); }} />
              {adminLoginErr && <p className="auth-err">{adminLoginErr}</p>}
              <button className="send-btn" style={{ width: "100%" }} disabled={adminLoginBusy} onClick={doAdminLogin}>{adminLoginBusy ? "Checking…" : "🛡 Unlock admin panel"}</button>
              <p className="auto-note">Only the app owner should have these credentials.</p>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function hour() { return new Date().getHours(); }

const CRED_GUIDES = [
  {
    id: "google",
    icon: "🔵",
    title: "Google sign-in (one-time setup)",
    what: "Lets every visitor log in with one click instead of typing a password. Only the app owner does this once.",
    steps: [
      "Create a Google Cloud project + OAuth client (console.cloud.google.com → APIs & Services → Credentials → Create OAuth client ID → Web application).",
      "Authorized JavaScript origins: https://arynox-ai.vercel.app (and http://localhost:3000 while developing).",
      "Authorized redirect URI: https://offnevsupwnwqnhtexed.supabase.co/auth/v1/callback (Supabase handles the Google handshake).",
      "Copy the Client ID and Client Secret from Google Cloud.",
      "Google Cloud → OAuth consent screen → set app name, user type External, then PUBLISH the app (Status: In production). If you keep it in Testing, ONLY Google accounts you added as Test users can sign in — everyone else gets \"Access blocked\".",
      "Supabase dashboard → Authentication → Sign In / Up → Providers → Google → Enable, paste the exact Client ID + Secret, Save.",
      "Supabase → Authentication → URL Configuration: Site URL = https://arynox-ai.vercel.app and add the same URL to Redirect URLs.",
      "Done — the 🔵 Continue with Google button in Sign in now works for everyone.",
    ],
    link: { label: "Google Cloud console", url: "https://console.cloud.google.com/apis/credentials" },
  },
  {
    id: "github",
    icon: "🐙",
    title: "GitHub token",
    what: "Unlocks: search repos, list & create issues, and let the AI work on your repositories.",
    steps: [
      "Sign in to GitHub and open https://github.com/settings/tokens (Settings → Developer settings → Personal access tokens).",
      "Click Generate new token → Generate new token (classic).",
      "Name it e.g. \"Arynox AI\" and set an expiry.",
      "Tick the scopes: repo (full access) — or for fine-grained: Repository access → All repositories, then Permissions → Issues: Read and write, Contents: Read and write.",
      "Click Generate token. Copy it immediately — GitHub shows it only once.",
      "Paste it in the GitHub field below, then press 🔎 Test search to confirm.",
    ],
    link: { label: "Open token page", url: "https://github.com/settings/tokens" },
  },
  {
    id: "gmail",
    icon: "✉️",
    title: "Gmail App Password",
    what: "Unlocks: sending emails from chat (reports, invoices, booking forms, summaries).",
    steps: [
      "Your Google account must have 2-Step Verification ON: https://myaccount.google.com/security",
      "Open https://myaccount.google.com/apppasswords (Google Account → Security → 2-Step Verification → App passwords).",
      "Under \"App passwords\", choose Mail → Other (Custom name) → type \"Arynox\" → Generate.",
      "Copy the 16-character password shown (spaces are fine, e.g. abcd efgh ijkl mnop).",
      "Enter your full Gmail address and this app password in the Gmail fields below.",
      "Press ✉️ Send test email to confirm. Never use your normal password here.",
    ],
    link: { label: "Create an app password", url: "https://myaccount.google.com/apppasswords" },
  },
  {
    id: "mcp",
    icon: "🔌",
    title: "MCP server (extra apps)",
    what: "Unlocks: the AI can call tools from other apps — databases, Slack, Notion, GitHub, Google Drive and more.",
    steps: [
      "MCP servers are hosted services with a \"streamable HTTP\" URL that the AI calls directly.",
      "Easiest way: browse ready-made servers on Smithery: https://smithery.ai (free tier available).",
      "Pick a server (e.g. GitHub, Fetch, Filesystem, Google Drive, Notion, PostgreSQL) and copy its streamable HTTP endpoint URL.",
      "Back in this app: press ＋ Add server, enter a name and the URL (add a token too if the server asks for one).",
      "Press 🔍 Discover tools — the server's tools appear here and the AI can call them from chat automatically.",
      "No server running? Advanced: any local MCP server can be exposed with the MCP SDK's StreamableHTTP transport (see README).",
    ],
    link: { label: "Browse MCP servers", url: "https://smithery.ai" },
  },
  {
    id: "whatsapp",
    icon: "💬",
    title: "WhatsApp Business Cloud API",
    what: "Unlocks: the WhatsApp bot — guests can message your business number and the AI replies in Marathi/Hindi/English.",
    steps: [
      "Create a free Meta developer account: https://developers.facebook.com",
      "Create an app → Add product → WhatsApp → open API Setup.",
      "You get: an Access Token and a Phone Number ID (and a free test number to start).",
      "Invent a random \"verify token\" string (any text, e.g. arynox12345) — you will paste it in two places.",
      "The app owner sets 3 variables on the server (see README → Environment variables): WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN.",
      "In Meta: WhatsApp → Configuration → Webhook: set Callback URL to https://your-domain.com/api/whatsapp and the Verify token from step 4, then Subscribe to the \"messages\" field.",
      "Save, then send any message to your WhatsApp number — the bot answers within seconds.",
    ],
    link: { label: "WhatsApp API setup", url: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" },
  },
  {
    id: "keys",
    icon: "🔑",
    title: "AI model & research keys",
    what: "Everything else (chat models, web research, voice) already works — these keys are configured by the app owner and are never needed from you.",
    steps: [
      "Chat models: Cerebras, Groq, and a free fallback tier are configured server-side — you need nothing.",
      "Deep research (Exa) is server-side too — just ask in chat.",
      "Image generation uses a free service — no key, works out of the box.",
      "If you self-host the app, copy .env.example → .env and fill: GROQ_API_KEY, CEREBRAS_API_KEY, EXA_API_KEY, OPENCODE_API_KEY, Supabase and WhatsApp vars (see README).",
    ],
    link: { label: "App setup docs", url: "https://github.com/aryaanchavan1-commits/Arynox-Ai#readme" },
  },
];

function CredGuide({ id, open, onToggle }) {
  const g = CRED_GUIDES.find((x) => x.id === id);
  if (!g) return null;
  const isOpen = open === id;
  return (
    <div className={`guide-item ${isOpen ? "open" : ""}`}>
      <button className="guide-head" onClick={() => onToggle(isOpen ? "" : id)}>
        <span className="guide-icon">{g.icon}</span>
        <span className="guide-title">{g.title}</span>
        <span className="guide-what">{g.what}</span>
        <span className="guide-caret">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <div className="guide-body">
          <ol className="guide-steps">
            {g.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          {g.link && <a className="chip guide-link" href={g.link.url} target="_blank" rel="noreferrer">↗ {g.link.label}</a>}
        </div>
      )}
    </div>
  );
}

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
