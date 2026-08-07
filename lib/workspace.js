import JSZip from "jszip";

const MAX_FILES = 60;
const MAX_FILE_BYTES = 512 * 1024;
const SNAPSHOT_LIMIT = 12;
const SNAPSHOT_FILE_BYTES = 100 * 1024;

const stores = new Map();

function storeFor(owner) {
  const key = owner && owner !== "null" ? String(owner) : "__guest__";
  if (!stores.has(key)) stores.set(key, new Map());
  return stores.get(key);
}

function sanitize(name) {
  const n = String(name || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.\./g, "")
    .replace(/[<>:"|?*]/g, "_")
    .slice(0, 120);
  return n || "file.txt";
}

function listFiles(owner) {
  return [...storeFor(owner).keys()]
    .map((name) => ({ name, bytes: storeFor(owner).get(name).code.length, updated: storeFor(owner).get(name).updated }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function tree(owner) {
  const l = listFiles(owner);
  return l.length ? l.map((f) => `- ${f.name} (${f.bytes} B)`).join("\n") : "- (workspace is empty)";
}

function writeFile(name, code, owner) {
  name = sanitize(name);
  const files = storeFor(owner);
  if (!files.has(name) && files.size >= MAX_FILES) throw new Error(`Workspace limit reached (${MAX_FILES} files). Delete files first.`);
  code = String(code ?? "");
  if (code.length > MAX_FILE_BYTES) throw new Error(`File too large (max ${MAX_FILE_BYTES} bytes)`);
  files.set(name, { code, updated: Date.now() });
  return `File written: ${name} (${code.length} bytes).`;
}

function readFile(name, owner) {
  name = sanitize(name);
  const f = storeFor(owner).get(name);
  if (!f) throw new Error(`File not found: ${name}. Use write_file first or list_files to see the workspace.`);
  return `--- ${name} (${f.code.length} bytes) ---\n${f.code}`;
}

function editFile(name, search, replace, owner) {
  name = sanitize(name);
  const files = storeFor(owner);
  const f = files.get(name);
  if (!f) throw new Error(`File not found: ${name}`);
  const idx = f.code.indexOf(String(search ?? ""));
  if (idx === -1) throw new Error(`Could not find the exact text to edit in ${name}. Use read_file to see the current content.`);
  const next = f.code.slice(0, idx) + String(replace ?? "") + f.code.slice(idx + String(search ?? "").length);
  files.set(name, { code: next, updated: Date.now() });
  return `Edited ${name} (now ${next.length} bytes).`;
}

function deleteFile(name, owner) {
  name = sanitize(name);
  const files = storeFor(owner);
  if (!files.has(name)) throw new Error(`File not found: ${name}`);
  files.delete(name);
  return `Deleted ${name}.`;
}

function clear(owner) {
  storeFor(owner).clear();
  return "Workspace cleared.";
}

async function buildZip(owner) {
  const zip = new JSZip();
  const files = storeFor(owner);
  for (const name of files.keys()) zip.file(name, files.get(name).code);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer, count: files.size };
}

function snapshot(owner) {
  const out = [];
  const files = storeFor(owner);
  for (const name of files.keys()) {
    if (out.length >= SNAPSHOT_LIMIT) break;
    const f = files.get(name);
    out.push({ name, code: f.code.slice(0, SNAPSHOT_FILE_BYTES) });
  }
  return out;
}

function all(owner) {
  return [...storeFor(owner).entries()].map(([name, f]) => ({ name, code: f.code }));
}

export { writeFile, readFile, editFile, deleteFile, listFiles, clear, buildZip, snapshot, tree, all };
