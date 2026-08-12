"use client";

import { useCallback, useRef, useState } from "react";

const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1", desc: "Square" },
  { id: "16:9", label: "16:9", desc: "Landscape" },
  { id: "9:16", label: "9:16", desc: "Portrait" },
  { id: "4:3", label: "4:3", desc: "Classic" },
];

const RESOLUTIONS = [
  { id: "540p", label: "540p", desc: "Fast" },
  { id: "720p", label: "720p", desc: "HD" },
  { id: "1080p", label: "1080p", desc: "Full HD" },
];

const AVATAR_PRESETS = [
  { id: "business", label: "Business Pro", prompt: "A confident professional in a sharp suit, clean background, studio lighting, photorealistic portrait" },
  { id: "casual", label: "Friendly Host", prompt: "A warm smiling casual presenter, soft lighting, friendly expression, photorealistic" },
  { id: "news", label: "News Anchor", prompt: "A professional news anchor, formal attire, serious expression, studio background" },
  { id: "custom", label: "Custom", prompt: "" },
];

export default function VideoStudio({ onToast }) {
  const [mode, setMode] = useState("generate"); // "generate" | "upload"
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("Hello! Welcome to our brand. Today we are excited to share something amazing with you.");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("720p");

  // Avatar image (uploaded or generated)
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarHedraUrl, setAvatarHedraUrl] = useState(null);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);

  // Audio (uploaded or TTS)
  const [audioPreview, setAudioPreview] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioHedraUrl, setAudioHedraUrl] = useState(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState("idle"); // idle | uploading | submitted | processing | done | error
  const [resultVideo, setResultVideo] = useState(null);
  const [error, setError] = useState("");
  const [needsFunding, setNeedsFunding] = useState(false);
  const [fundingUrl, setFundingUrl] = useState("https://www.hedra.com/develop/billing");

  const FUNDING_HINT = /(insufficient|wallet|balance|funding|402|billing|credits)/i;

  const avatarInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const pollRef = useRef(null);

  const toast = (msg) => onToast && onToast(msg);

  // ── Upload a file to Hedra, return { url, content_type, expires_at } ──
  const uploadToHedra = useCallback(async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/video/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "upload failed");
    if (!data.url) throw new Error("upload did not return a URL");
    return data;
  }, []);

  const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  const AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/m4a", "audio/mp4"];
  const MAX_BYTES = 10 * 1024 * 1024;

  const validateFile = (file, allowed, kind) => {
    if (!file) return null;
    if (!allowed.includes(file.type)) return `Use a ${kind} file (PNG, JPG or WebP for images / MP3, WAV or M4A for audio).`;
    if (file.size > MAX_BYTES) return `${kind} is too large — max 10 MB.`;
    return null;
  };

  // ── Handle avatar image selection ──
  const onAvatarPick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const err = validateFile(f, IMAGE_TYPES, "image");
    if (err) { toast("⚠️ " + err); return; }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
    setAvatarUrl(null);
    setAvatarHedraUrl(null);
  };

  // ── Generate avatar image from prompt ──
  const generateAvatar = async () => {
    if (!prompt.trim()) { toast("Describe your avatar first"); return; }
    setGeneratingAvatar(true);
    try {
      const res = await fetch("/api/gen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, width: 1024, height: 1024 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "image generation failed");
      setAvatarUrl(data.url);
      setAvatarPreview(data.url);
      setAvatarHedraUrl(null);
      toast("Avatar generated");
    } catch (err) {
      toast("Avatar gen failed: " + err.message);
    } finally {
      setGeneratingAvatar(false);
    }
  };

  // ── Handle audio selection ──
  const onAudioPick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const err = validateFile(f, AUDIO_TYPES, "audio");
    if (err) { toast("⚠️ " + err); return; }
    setAudioFile(f);
    setAudioPreview(URL.createObjectURL(f));
    setAudioUrl(null);
    setAudioHedraUrl(null);
  };

  // ── Generate audio via TTS from script ──
  const generateAudio = async () => {
    if (!script.trim()) { toast("Write a script first"); return; }
    setGeneratingAudio(true);
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: script, lang: "en" }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "TTS failed"); }
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setAudioPreview(url);
      setAudioHedraUrl(null);
      toast("Voice generated");
    } catch (err) {
      toast("Voice gen failed: " + err.message);
    } finally {
      setGeneratingAudio(false);
    }
  };

  // ── Poll job status ──
  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (id) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/video/status/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "status check failed");
        setStatus("processing");
        setProgress(data.status || "working...");
        if (data.status === "COMPLETED" || data.status === "SUCCEEDED") {
          stopPolling();
          setStatus("done");
          setProgress("Done!");
          if (data.videos?.length) setResultVideo(data.videos[0]);
          else throw new Error("no video in result");
        } else if (data.status === "FAILED" || data.status === "ERROR") {
          stopPolling();
          setStatus("error");
          setProgress("Failed");
          throw new Error("generation failed");
        }
      } catch (err) {
        stopPolling();
        setStatus("error");
        setError(err.message);
        setGenerating(false);
        toast("Video failed: " + err.message);
      }
    }, 4000);
  };

  // ── Generate the talking avatar video ──
  const generate = async () => {
    setError("");
    setResultVideo(null);
    setProgress("");

    // Check we have a source for the avatar image and audio
    const hasImage = avatarHedraUrl || avatarFile || avatarUrl;
    const hasAudio = audioHedraUrl || audioFile || audioUrl;

    if (mode === "generate") {
      if (!hasImage) { toast("Generate or upload an avatar image"); return; }
      if (!hasAudio) { toast("Generate or upload audio"); return; }
    } else {
      if (!hasImage) { toast("Please add an avatar image"); return; }
      if (!hasAudio) { toast("Please add audio"); return; }
    }

    setGenerating(true);
    setStatus("uploading");
    setProgress("Uploading to Hedra...");

    // Fetch a URL as a File (for generated avatars / TTS audio blob URLs)
    const urlToFile = async (url, fallbackName, fallbackType) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`could not download ${fallbackName}`);
      const blob = await r.blob();
      return new File([blob], fallbackName, { type: blob.type || fallbackType });
    };
    try {
      let imgUrl = avatarHedraUrl;
      let audUrl = audioHedraUrl;

      if (!imgUrl) {
        const src = avatarFile || (avatarUrl && (await urlToFile(avatarUrl, "avatar.png", "image/png")));
        if (!src) throw new Error("no avatar image");
        const up = await uploadToHedra(src);
        if (!up || !up.url) throw new Error("image upload to Hedra failed");
        setAvatarHedraUrl(up.url);
        setAvatarUrl(up.url);
        imgUrl = up.url;
      }
      if (!audUrl) {
        const src = audioFile || (audioUrl && (await urlToFile(audioUrl, "voice.mp3", "audio/mpeg")));
        if (!src) throw new Error("no audio");
        const up = await uploadToHedra(src);
        if (!up || !up.url) throw new Error("audio upload to Hedra failed");
        setAudioHedraUrl(up.url);
        setAudioUrl(up.url);
        audUrl = up.url;
      }
      if (!imgUrl) throw new Error("no avatar image");
      if (!audUrl) throw new Error("no audio");

      setStatus("submitted");
      setProgress("Generating video...");

      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imgUrl,
          audioUrl: audUrl,
          prompt: script || prompt || "A person speaking naturally and clearly.",
          aspect_ratio: aspectRatio,
          resolution,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "generation request failed");

      setJobId(data.jobId);
      setStatus("processing");
      setProgress("Processing (this can take a minute or two)...");
      startPolling(data.jobId);
    } catch (err) {
      setStatus("error");
      const msg = String(err?.message || err || "");
      setError(msg);
      setGenerating(false);
      if (FUNDING_HINT.test(msg)) {
        setNeedsFunding(true);
        const m = msg.match(/https:\/\/[^\s",]+/);
        if (m) setFundingUrl(m[0]);
      }
      toast("Error: " + msg.slice(0, 160));
    }
  };

  const reset = () => {
    stopPolling();
    setGenerating(false);
    setJobId(null);
    setProgress("");
    setStatus("idle");
    setResultVideo(null);
    setError("");
  };

  const canGenerate = (avatarPreview || avatarUrl) && (audioPreview || audioUrl) && !generating;

  return (
    <div className="studio">
      <header className="topbar">
        <div className="brand"><span className="dot busy" /><span className="status">Video Studio — AI talking avatar & lip-sync</span></div>
        <div className="toggles">
          <button className={mode === "generate" ? "active" : ""} onClick={() => setMode("generate")}>✨ Generate</button>
          <button className={mode === "upload" ? "active" : ""} onClick={() => setMode("upload")}>📤 Upload</button>
        </div>
      </header>

      <div className="studio-body">
        <div className="studio-col">
          {/* ── Avatar ── */}
          <div className="studio-card">
            <div className="studio-card-title">🧑 Avatar {mode === "generate" ? "(generated)" : "(upload)"}</div>
            {mode === "generate" ? (
              <>
                <textarea className="studio-textarea" placeholder="Describe your avatar... e.g. A confident business professional in a navy suit, studio lighting, photorealistic" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
                <div className="studio-presets">
                  {AVATAR_PRESETS.map((p) => (
                    <button key={p.id} className="chip" onClick={() => { setPrompt(p.prompt); }} disabled={p.id === "custom"}>{p.label}</button>
                  ))}
                </div>
                <button className="send-btn studio-btn" disabled={generatingAvatar || !prompt.trim()} onClick={generateAvatar}>{generatingAvatar ? "Generating..." : "✨ Generate Avatar"}</button>
              </>
            ) : (
              <>
                <div className="studio-drop" onClick={() => avatarInputRef.current?.click()}>
                  {avatarPreview ? <img src={avatarPreview} alt="avatar" /> : <div className="studio-drop-place"><span>🖼️</span><p>Click to upload avatar image</p><em>PNG, JPG — a clear front-facing photo works best</em></div>}
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={onAvatarPick} />
              </>
            )}
            {avatarPreview && (
              <div className="studio-ready-row">
                <span className="studio-preview-label">Avatar ready ✓</span>
                <button className="chip" onClick={() => { setAvatarFile(null); setAvatarPreview(null); setAvatarUrl(null); setAvatarHedraUrl(null); }}>🗑 Clear</button>
              </div>
            )}
          </div>

          {/* ── Voice ── */}
          <div className="studio-card">
            <div className="studio-card-title">🎙️ Voice</div>
            <textarea className="studio-textarea" placeholder="Write the script your avatar will speak..." value={script} onChange={(e) => setScript(e.target.value)} rows={4} />
            <button className="send-btn studio-btn" disabled={generatingAudio || !script.trim()} onClick={generateAudio}>{generatingAudio ? "Generating..." : "🔊 Generate Voice (TTS)"}</button>
            <div className="studio-or">— or upload your own audio —</div>
            <div className="studio-drop studio-drop-sm" onClick={() => audioInputRef.current?.click()}>
              {audioPreview ? <div className="studio-audio-ready">🔊 Audio ready ✓<audio src={audioPreview} controls /></div> : <div className="studio-drop-place"><span>🎵</span><p>Click to upload audio</p><em>MP3, WAV, M4A</em></div>}
            </div>
            <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={onAudioPick} />
            {audioPreview && (
              <div className="studio-ready-row">
                <span className="studio-audio-clear" onClick={() => { setAudioFile(null); setAudioPreview(null); setAudioUrl(null); setAudioHedraUrl(null); }}>🗑 Remove audio</span>
              </div>
            )}
          </div>
        </div>

        <div className="studio-col studio-col-sm">
          {/* ── Settings ── */}
          <div className="studio-card">
            <div className="studio-card-title">⚙️ Settings</div>
            <div className="studio-field">
              <label>Aspect ratio</label>
              <div className="studio-options">
                {ASPECT_RATIOS.map((a) => (
                  <button key={a.id} className={`opt-btn ${aspectRatio === a.id ? "opt-active" : ""}`} onClick={() => setAspectRatio(a.id)}>
                    <b>{a.label}</b><em>{a.desc}</em>
                  </button>
                ))}
              </div>
            </div>
            <div className="studio-field">
              <label>Resolution</label>
              <div className="studio-options">
                {RESOLUTIONS.map((r) => (
                  <button key={r.id} className={`opt-btn ${resolution === r.id ? "opt-active" : ""}`} onClick={() => setResolution(r.id)}>
                    <b>{r.label}</b><em>{r.desc}</em>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Generate ── */}
          <div className="studio-card">
            <button className="send-btn studio-generate" disabled={!canGenerate} onClick={generate}>
              {generating ? "Working..." : "🎬 Generate Talking Video"}
            </button>
            {!canGenerate && <p className="studio-hint">Add an avatar + voice to generate</p>}
          </div>

          {/* ── Progress ── */}
          {(generating || status === "done" || status === "error") && (
            <div className="studio-card">
              <div className="studio-card-title">📊 Status</div>
              {status !== "done" && status !== "error" && (
                <div className="studio-progress">
                  <div className="studio-progress-bar"><div className="studio-progress-fill" /></div>
                  <p>{progress || "Preparing..."}</p>
                </div>
              )}
              {status === "done" && resultVideo && (
                <div className="studio-result">
                  <video src={resultVideo} controls playsInline />
                  <div className="studio-result-actions">
                    <a className="send-btn" href={resultVideo} download="arynox-video.mp4" target="_blank" rel="noreferrer">⬇ Download</a>
                    <button className="chip" onClick={reset}>↺ New video</button>
                  </div>
                </div>
              )}
              {status === "error" && (
                <div className="studio-error-box">
                  <p className="studio-error">⚠️ {error || "Something went wrong"}</p>
                  {needsFunding && (
                    <div className="studio-fund">
                      <b>API wallet needs funds</b>
                      <p>Video generation is billed to your Hedra API wallet. Add a small balance, then try again — your avatar and audio are already prepared.</p>
                      <div className="studio-result-actions">
                        <a className="send-btn" href={fundingUrl} target="_blank" rel="noreferrer">💳 Add funds</a>
                        <button className="chip" onClick={reset}>↺ Try again</button>
                      </div>
                    </div>
                  )}
                  {!needsFunding && <button className="chip" onClick={reset}>↺ Reset</button>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}