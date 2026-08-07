export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg, #06060c)", color: "var(--text, #e8e8f0)", fontFamily: "Segoe UI, system-ui, sans-serif", textAlign: "center" }}>
      <div style={{ fontSize: 64, background: "linear-gradient(135deg, #7c5cff, #00d4ff)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>✦</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>404</div>
      <div style={{ color: "#9a9ab2" }}>This page does not exist.</div>
      <a href="/" style={{ marginTop: 8, padding: "10px 22px", borderRadius: 999, background: "linear-gradient(135deg, #7c5cff, #00d4ff)", color: "#fff", textDecoration: "none", fontWeight: 700 }}>Back to Arynox AI</a>
    </div>
  );
}
