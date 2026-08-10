export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg, #f5f4ed)", color: "var(--text, #2b2a28)", fontFamily: "Georgia, 'Times New Roman', serif", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 56, lineHeight: 1, fontWeight: 500, letterSpacing: "-0.02em" }}>✦</div>
      <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.01em" }}>Page not found</div>
      <div style={{ fontSize: 14.5, fontFamily: "Segoe UI, system-ui, sans-serif", color: "#87867f", maxWidth: 380, lineHeight: 1.6 }}>
        This page does not exist, or the link has changed.
      </div>
      <a href="/" style={{ marginTop: 10, padding: "10px 22px", borderRadius: 12, background: "#c96442", color: "#faf9f5", textDecoration: "none", fontWeight: 600, fontFamily: "Segoe UI, system-ui, sans-serif", fontSize: 14.5, boxShadow: "0 0 0 1px rgba(201, 100, 66, 0.9)" }}>
        ← Back to Arynox AI
      </a>
    </div>
  );
}
