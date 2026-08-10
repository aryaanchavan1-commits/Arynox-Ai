// On-device vision engine: COCO-SSD (objects + humans) + contour-based document detection.
// All model imports are dynamic so this module never executes on the server.

let objModel = null;
let objLoadPromise = null;
let objFailed = false;

export async function loadObjectModel() {
  if (objModel) return objModel;
  if (objLoadPromise) return objLoadPromise;
  objLoadPromise = (async () => {
    try {
      await import("@tensorflow/tfjs");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      objModel = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      return objModel;
    } catch (err) {
      objFailed = true;
      throw err;
    }
  })();
  return objLoadPromise;
}

export function objectModelFailed() {
  return objFailed;
}

// Detect objects + humans from a <video> element. Returns [{ name, score, box: [x, y, w, h] }]
// in the video's intrinsic resolution.
export async function detectObjects(video) {
  const model = await loadObjectModel();
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);
  const preds = await model.detect(canvas);
  return preds.map((p) => ({
    name: String(p.class || "object"),
    score: Math.round((p.score || 0) * 100) / 100,
    box: Array.isArray(p.bbox) ? p.bbox.map(Number) : [0, 0, w, h],
  }));
}

// Detect document-like regions (white, roughly rectangular surfaces) in a video frame.
// Pure canvas CV: grayscale -> luminance threshold -> connected components -> fill-ratio.
// Returns [{ box: [x, y, w, h] }] in video resolution.
export function detectDocuments(video, vw, vh) {
  const W = 320;
  const H = Math.round((vh / vw) * W);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  const px = img.data;

  const lum = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const j = i * 4;
    lum[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
  }

  // Binary: bright pixels (white paper) => 1
  const bin = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) bin[i] = lum[i] > 158 ? 1 : 0;

  // Union-find connected components on 4-neighbourhood
  const parent = new Int32Array(W * H);
  for (let i = 0; i < W * H; i++) parent[i] = i;
  const find = (a) => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let y = 1; y < H; y++) {
    for (let x = 1; x < W; x++) {
      const i = y * W + x;
      if (!bin[i]) continue;
      if (bin[i - 1]) union(i, i - 1);
      if (bin[i - W]) union(i, i - W);
    }
  }

  const stats = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!bin[i]) continue;
      const r = find(i);
      let s = stats.get(r);
      if (!s) { s = { n: 0, minX: W, minY: H, maxX: 0, maxY: 0 }; stats.set(r, s); }
      s.n++;
      if (x < s.minX) s.minX = x;
      if (y < s.minY) s.minY = y;
      if (x > s.maxX) s.maxX = x;
      if (y > s.maxY) s.maxY = y;
    }
  }

  const frameArea = W * H;
  const minArea = frameArea * 0.012;
  const docs = [];
  for (const s of stats.values()) {
    if (s.n < minArea) continue;
    const bw = s.maxX - s.minX + 1;
    const bh = s.maxY - s.minY + 1;
    if (bw <= 0 || bh <= 0) continue;
    const fill = s.n / (bw * bh);
    const aspect = bw / bh;
    if (fill < 0.55 || aspect < 0.32 || aspect > 3.2) continue;
    docs.push({ box: [s.minX / W * vw, s.minY / H * vh, (bw / W) * vw, (bh / H) * vh] });
  }

  // Merge overlapping documents
  const merged = [];
  for (const d of docs) {
    let absorbed = false;
    for (const m of merged) {
      const [x1, y1, w1, h1] = d.box;
      const [x2, y2, w2, h2] = m.box;
      const ix = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2));
      const iy = Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2));
      if (ix > 0.6 * w1 && iy > 0.6 * h1) { absorbed = true; break; }
    }
    if (!absorbed) merged.push(d);
  }
  return merged.slice(0, 6);
}

// Draw detection boxes on the overlay canvas. Canvas is sized to the displayed video area.
export function drawDetections(ctx, video, boxes, docs, displayW, displayH) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  ctx.clearRect(0, 0, displayW, displayH);
  if (!boxes?.length && !docs?.length) return;
  const sx = displayW / vw;
  const sy = displayH / vh;

  const drawBox = (box, label, color) => {
    const [x, y, w, h] = box;
    const X = x * sx, Y = y * sy, W = w * sx, H = h * sy;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, Math.round(displayW / 480));
    ctx.strokeRect(X, Y, W, H);
    if (label) {
      ctx.font = `600 ${Math.max(11, Math.round(displayW / 64))}px Segoe UI, system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color;
      const ly = Y - 4 - Math.round(displayW / 64) - 8 < 0 ? Y + 4 : Y - 4 - Math.round(displayW / 64) - 8;
      ctx.fillRect(X, ly, tw + 12, Math.round(displayW / 64) + 10);
      ctx.fillStyle = "#141413";
      ctx.fillText(label, X + 6, ly + Math.round(displayW / 64) + 2);
    }
  };

  const humans = [];
  for (const b of boxes || []) {
    const isPerson = b.name === "person";
    const color = isPerson ? "#ff7a59" : "#3898ec";
    if (isPerson) humans.push(b);
    drawBox(b.box, `${isPerson ? "human" : b.name} ${Math.round(b.score * 100)}%`, color);
  }
  for (const d of docs || []) {
    drawBox(d.box, "document", "#f0b429");
  }
}

// ---- Face recognition (sign-in with your face) ----

let faceReady = null;

export async function loadFaceModel() {
  if (faceReady) return faceReady;
  faceReady = (async () => {
    const tf = await import("@tensorflow/tfjs");
    await tf.ready();
    const faceapi = await import("@vladmandic/face-api");
    const MODEL = "https://vladmandic.github.io/face-api/model/";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL),
    ]);
    return faceapi;
  })();
  return faceReady;
}

// Returns a 128-length Float32Array descriptor for the largest face in the frame, or null.
export async function getFaceDescriptor(video) {
  const faceapi = await loadFaceModel();
  const result = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result?.descriptor ? Array.from(result.descriptor) : null;
}
