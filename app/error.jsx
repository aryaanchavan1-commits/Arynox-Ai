"use client";

export default function ErrorBoundary({ error, reset }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg, #f5f4ed)", color: "var(--text, #2b2a28)", fontFamily: "Georgia, 'Times New Roman', serif", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 56, lineHeight: 1, fontWeight: 500 }}>✦</div>
      <div style={{ fontSize: 30, fontWeight: 500 }}>Something went wrong</div>
      <div style={{ fontSize: 14.5, fontFamily: "Segoe UI, system-ui, sans-serif", color: "#87867f", maxWidth: 420, lineHeight: 1.6 }}>
        {String(error?.message || "An unexpected error occurred.").slice(0, 200)}
      </div>
      <button onClick={reset} style={{ marginTop: 10, padding: "10px 22px", borderRadius: 12, background: "#c96442", color: "#faf9f5", border: "none", fontWeight: 600, fontFamily: "Segoe UI, system-ui, sans-serif", fontSize: 14.5, cursor: "pointer", boxShadow: "0 0 0 1px rgba(201, 100, 66, 0.9)" }}>
        Try again
      </button>
    </div>
  );
}
