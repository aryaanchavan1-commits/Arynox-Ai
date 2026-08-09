export const metadata = {
  title: "Arynox AI — Trilingual AI Assistant for Maharashtra | Chat, Code, Create",
  description: "Arynox AI is Maharashtra's premium AI workspace — trilingual chat, voice, vision, a coding IDE with live website preview, Excel/PDF/Word files, images, deep research and automations. Built by Arynox Tech, Ratnagiri.",
};

const FEATURES = [
  { icon: "💬", title: "Trilingual chat", desc: "Speak English, हिन्दी or मराठी — Arynox answers in your language, and remembers context across chats." },
  { icon: "🛠", title: "Coding IDE + live preview", desc: "Ask for an app or website and it is built instantly in the IDE — folders, files, run console and a live website preview." },
  { icon: "🎤", title: "Voice & vision", desc: "Talk to it or show it what is in front of the camera. It hears, sees and responds." },
  { icon: "📊", title: "Excel, PDF & Word", desc: "Create budgets, booking forms, itineraries and reports as real downloadable files — no formulas needed." },
  { icon: "🖼", title: "Image generation", desc: "Describe any scene and get an image — futuristic cities, hotel photos, product mockups, art." },
  { icon: "🔎", title: "Deep research", desc: "Live web search with sources for news, prices, trends and answers from the real world." },
  { icon: "⚡", title: "Automations", desc: "Connect Gmail, GitHub, WhatsApp and MCP servers — the AI performs actions for you." },
  { icon: "📱", title: "Installable app", desc: "Install Arynox on your phone or desktop like a native app — works offline-friendly and opens instantly." },
];

const STEPS = [
  { n: "1", title: "Sign in", desc: "One tap with Google, or email — your workspace follows you on any device." },
  { n: "2", title: "Ask anything", desc: "In English, हिन्दी or मराठी — by typing, voice or camera." },
  { n: "3", title: "Get it done", desc: "Websites, Excel sheets, PDFs, images, code — built, run and ready to download." },
];

const FAQS = [
  { q: "Is Arynox AI really free right now?", a: "Yes — while in testing, everything is free. A Pro tier (₹299/month, on waitlist) is coming with higher limits, priority speed and bigger workspaces." },
  { q: "Does it understand Marathi and Hindi?", a: "Yes. Chat, voice input and replies all work in English, Hindi and Marathi, and the business concierge mode speaks all three naturally." },
  { q: "Can it really build websites and apps?", a: "It writes complete multi-file projects — HTML/CSS/JS websites with a live preview, Python and JavaScript programs — runs them in a sandbox and shows the output." },
  { q: "Where are my files and chats saved?", a: "To your account. Sign in on any device and your workspace, memory and business profile come back with you." },
  { q: "Is it useful for hotels and businesses?", a: "That is its home turf — booking forms, itineraries, budgets, WhatsApp messages and a concierge that answers in Marathi, Hindi and English for guests." },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-logo" href="/">✦<span>Arynox AI</span></a>
        <nav className="landing-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="landing-cta">
          <a className="landing-btn ghost" href="/app">Sign in</a>
          <a className="landing-btn" href="/app">Get started free</a>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-badge">🇮🇳 Built in Ratnagiri, Maharashtra</div>
            <h1>The AI that <span>works</span> for you —<br />chats, codes and creates</h1>
            <p className="landing-sub">Arynox AI is a complete AI workspace in English, हिन्दी and मराठी — chat, voice, vision, a coding IDE with live preview, Excel/PDF/Word files, images and automations.</p>
            <div className="landing-cta big">
              <a className="landing-btn" href="/app">Start free — sign in →</a>
              <a className="landing-btn ghost" href="#features">See what it can do</a>
            </div>
            <p className="landing-hero-note">No credit card · Works on phone, tablet & desktop · Installable like an app</p>
          </div>

          <div className="landing-mock" aria-hidden="true">
            <div className="mock-chat">
              <div className="mock-top"><span className="mock-dot" /><span className="mock-dot" /><span className="mock-dot" /></div>
              <div className="mock-line user">Make a 2-day Ratnagiri itinerary as a PDF</div>
              <div className="mock-line ai">🏖 Day 1 — Ratnadurg Fort, Ganpatipule beach, fresh seafood… I have made the PDF and added a booking form for your guests.</div>
              <div className="mock-line ai files">📄 ratnagiri-itinerary.pdf · 📋 booking-request.xlsx</div>
              <div className="mock-line user">Now build a website for my hotel</div>
              <div className="mock-line ai">🛠 Built in the IDE — 4 files, live preview ready:</div>
              <div className="mock-browser">
                <div className="mock-browser-bar"><span className="mock-dot g" /><span className="mock-dot y" /><span className="mock-dot r" /></div>
                <div className="mock-site"><b>Sea Breeze Resort</b><i>Ratnagiri · Book now</i></div>
              </div>
            </div>
            <div className="mock-chip c1">🛠 index.html · style.css · app.js</div>
            <div className="mock-chip c2">🎤 Talking…</div>
            <div className="mock-chip c3">📊 budget.xlsx ready</div>
          </div>
        </section>

        <section className="landing-strip">
          <span>⚡ Answers in seconds</span><span>🔒 Your data, your account</span><span>📱 Installable app</span><span>🧠 Remembers your context</span>
        </section>

        <section className="landing-section" id="features">
          <span className="landing-overline">Features</span>
          <h2>Everything, in one place</h2>
          <p className="landing-section-sub">Stop juggling apps — one AI does the work.</p>
          <div className="landing-grid">
            {FEATURES.map((f) => (
              <div className="landing-card" key={f.title}>
                <div className="landing-card-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section landing-alt" id="how">
          <span className="landing-overline">How it works</span>
          <h2>Three steps to done</h2>
          <div className="landing-steps">
            {STEPS.map((s) => (
              <div className="landing-step" key={s.n}>
                <div className="landing-step-n">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section" id="pricing">
          <span className="landing-overline">Pricing</span>
          <h2>Simple pricing</h2>
          <p className="landing-section-sub">Free while in testing — pay only when you love it.</p>
          <div className="landing-plans">
            <div className="landing-plan">
              <h3>Free</h3>
              <div className="landing-price">₹0<span>/month</span></div>
              <ul>
                <li>Trilingual chat with memory</li>
                <li>Voice, vision & camera</li>
                <li>Coding IDE with live preview</li>
                <li>Excel, PDF & Word files</li>
                <li>Daily usage limits</li>
              </ul>
              <a className="landing-btn" href="/app">Start free</a>
            </div>
            <div className="landing-plan featured">
              <div className="landing-plan-tag">Coming soon</div>
              <h3>Pro</h3>
              <div className="landing-price">₹299<span>/month</span></div>
              <ul>
                <li>Everything in Free, unlimited</li>
                <li>Priority speed & bigger workspaces</li>
                <li>Image generation, higher limits</li>
                <li>Automations & MCP servers</li>
                <li>Early-access features</li>
              </ul>
              <a className="landing-btn ghost" href="/app">Join the waitlist</a>
            </div>
          </div>
        </section>

        <section className="landing-section landing-alt" id="faq">
          <span className="landing-overline">FAQ</span>
          <h2>Questions, answered</h2>
          <div className="landing-faq">
            {FAQS.map((f) => (
              <details className="landing-faq-item" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-brand">✦ Arynox AI</div>
        <p>Arynox Tech · Ratnagiri, Maharashtra, India 🇮🇳</p>
        <div className="landing-footer-links">
          <a href="/app">Open the app</a>
          <a href="https://github.com/aryaanchavan1-commits" rel="noreferrer">GitHub</a>
        </div>
        <p className="landing-footer-copy">© 2026 Arynox Tech. Built with pride in the Konkan.</p>
      </footer>
    </div>
  );
}
