import vm from "vm";

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
  "AbortController", "crypto", "getRandomValues", "queueMicrotask",
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

export async function runCode(rawCode) {
  const code = extractCode(rawCode);
  const { context, logs } = buildContext();
  const result = {
    output: "",
    error: null,
    durationMs: 0,
    code,
  };
  const start = Date.now();
  try {
    vm.runInNewContext(
      `"use strict";\n(async () => {\n${code}\n})();`,
      context,
      { timeout: 8000, filename: "user_code.js" }
    );
  } catch (err) {
    result.error = err?.message || String(err);
  }
  result.durationMs = Date.now() - start;
  result.output = logs.join("\n");
  return result;
}
