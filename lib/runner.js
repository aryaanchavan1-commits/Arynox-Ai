import vm from "vm";
import { spawn } from "child_process";

const SANDBOX_GLOBALS = [
  "Math", "JSON", "Date", "String", "Number", "Boolean",
  "Array", "Object", "RegExp", "Promise", "Set", "Map", "Error",
  "parseInt", "parseFloat", "isNaN", "isFinite", "Infinity", "NaN",
  "undefined", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "Symbol", "BigInt", "Int8Array", "Uint8Array", "Int16Array", "Uint16Array",
  "Int32Array", "Uint32Array", "Float32Array", "Float64Array", "ArrayBuffer",
  "DataView", "TextEncoder", "TextDecoder", "URL", "URLSearchParams",
  "fetch", "structuredClone", "atob", "btoa", "encodeURIComponent",
  "decodeURIComponent", "encodeURI", "decodeURI", "escape", "unescape",
  "AbortController", "AbortSignal", "crypto", "getRandomValues", "queueMicrotask",
];

function buildContext() {
  const logs = [];
  const context = {
    console: {
      log: (...a) => logs.push(a.map(fmt).join(" ")),
      info: (...a) => logs.push(a.map(fmt).join(" ")),
      warn: (...a) => logs.push("WARN " + a.map(fmt).join(" ")),
      error: (...a) => logs.push("ERROR " + a.map(fmt).join(" ")),
    },
  };
  for (const g of SANDBOX_GLOBALS) {
    if (globalThis[g] !== undefined) context[g] = globalThis[g];
  }
  return { context, logs };
}

function fmt(v) {
  try {
    if (typeof v === "string") return v;
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    return JSON.stringify(v, (k, x) => (typeof x === "bigint" ? x.toString() : x), 2);
  } catch {
    return String(v);
  }
}

function extractCode(text) {
  const m = text.match(/```(?:javascript|js|node)?\s*([\s\S]*?)```/i);
  return m ? m[1] : text;
}

export async function runCode(rawCode, language = "javascript") {
  const code = extractCode(rawCode);
  if (language === "python") return runPython(code);
  const { context, logs } = buildContext();
  const result = {
    output: "",
    error: null,
    durationMs: 0,
    code,
  };
  const start = Date.now();
  try {
    const p = vm.runInNewContext(
      `"use strict";\n(async () => {\n${code}\n})();`,
      context,
      { timeout: 8000, filename: "user_code.js" }
    );
    if (p && typeof p.then === "function") {
      await Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Script timed out after 8000ms")), 8000)),
      ]);
    }
  } catch (err) {
    result.error = err?.message || String(err);
  }
  result.durationMs = Date.now() - start;
  result.output = logs.join("\n");
  return result;
}

function runPython(code) {
  const result = { output: "", error: null, durationMs: 0, code };
  const start = Date.now();
  return new Promise((resolve) => {
    const bin = process.platform === "win32" ? "python" : "python3";
    let child;
    try {
      child = spawn(bin, ["-c", code], { windowsHide: true });
    } catch {
      result.error = "Python interpreter not found on the server.";
      resolve(result);
      return;
    }
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      result.error = "Script timed out after 8000ms";
      resolve(result);
    }, 8000);
    child.stdout.on("data", (d) => { out += d; if (out.length > 60000) out = out.slice(-60000); });
    child.stderr.on("data", (d) => { err += d; if (err.length > 60000) err = err.slice(-60000); });
    child.on("error", (e) => {
      clearTimeout(timer);
      result.error = `Python not available: ${e.message}`;
      result.durationMs = Date.now() - start;
      resolve(result);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      result.output = out.slice(0, 60000);
      if (err && exitCode !== 0) result.error = err.slice(0, 60000);
      result.durationMs = Date.now() - start;
      resolve(result);
    });
  });
}
