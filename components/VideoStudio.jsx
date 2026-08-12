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
  const [generatingAvatar, setGeneratingAvatar] = useState(false);

  // Audio (uploaded or TTS)
  const [audioPreview, setAudioPreview] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState("idle"); // idle | uploading | submitted | processing | done | error
  const [resultVideo, setResultVideo] = useState(null);
  const [error, setError] = useState("");

  const avatarInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const pollRef = useRef(null);

  const toast = (msg) => onToast && onToast(msg);

  // ── Upload a file to Hedra, return its URL ──
  const uploadToHedra = useCallback(async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/video/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "upload failed");
    return data.url;
  }, []);

  // ── Handle avatar image selection ──
  const onAvatarPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
    setAvatarUrl(null);
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
    if (!f) return;
    setAudioFile(f);
    setAudioPreview(URL.createObjectURL(f));
    setAudioUrl(null);
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

    // Resolve avatar URL
    let finalImage = avatarUrl;
    let finalAudio = audioUrl;

    if (mode === "generate") {
      if (!finalImage) { toast("Generate or upload an avatar image"); return; }
      if (!finalAudio) { toast("Generate or upload audio"); return; }
    } else {
      if (!avatarFile && !finalImage) { toast("Please add an avatar image"); return; }
      if (!audioFile && !finalAudio) { toast("Please add audio"); return; }
    }

    setGenerating(true);
    setStatus("uploading");
    setProgress("Uploading to Hedra...");

    try {
      // Upload files to Hedra if not already URLs
      if (!finalImage && avatarFile) {
        finalImage = await uploadToHedra(avatarFile);
        setAvatarUrl(finalImage);
      }
      if (!finalAudio && audioFile) {
        finalAudio = await uploadToHedra(audioFile);
        setAudioUrl(finalAudio);
      }
      if (!finalImage) throw new Error("no avatar image");
      if (!finalAudio) throw new Error("no audio");

      setStatus("submitted");
      setProgress("Generating video...");

      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: finalImage,
          audioUrl: finalAudio,
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
      setError(err.message);
      setGenerating(false);
      toast("Error: " + err.message);
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
            {avatarPreview && <div className="studio-preview-label">Avatar ready ✓</div>}
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
              {status === "error" && <p className="studio-error">⚠️ {error || "Something went wrong"}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}