export const metadata = {
  title: "Arynox AI — Trilingual AI Assistant for Maharashtra | Chat, Code, Create",
  description: "Arynox AI is Maharashtra's premium AI workspace — trilingual chat, voice, vision, an AI coding studio with live website preview, Excel/PDF/Word files, images, deep research and automations. Built by Arynox Tech, Ratnagiri.",
};

const FEATURES = [
  { icon: "💬", title: "Normal chat", desc: "Speak English, हिन्दी or मराठी — Arynox answers in your language, remembers context across chats, and reads your files." },
  { icon: "💻", title: "Coding studio + agent", desc: "Just type \"build me a website\" and it is built instantly in Code — files, folder tree, run console, live preview, and a coding agent that edits and fixes your project on demand." },
  { icon: "👁", title: "Live detection", desc: "Real-time camera AI sees people, objects and documents on your device — with a visitor assistant that greets people, asks their name, saves what they need and guides them out loud." },
  { icon: "🎤", title: "Voice everywhere", desc: "Talk to it or show it what is in front of the camera. It hears, sees, speaks back — and announces builds, detections and answers." },
  { icon: "📊", title: "Excel, PDF & Word", desc: "Create budgets, booking forms, itineraries and reports as real downloadable files — no formulas needed." },
  { icon: "🖼", title: "Image generation", desc: "Describe any scene and get an image — futuristic cities, hotel photos, product mockups, art." },
  { icon: "🔎", title: "Deep research", desc: "Live web search with sources for news, prices, trends and answers from the real world." },
  { icon: "⚡", title: "Automations", desc: "Connect Gmail, GitHub, WhatsApp and MCP servers — the AI performs actions for you." },
  { icon: "💎", title: "Pro access by the owner", desc: "The app owner can grant anyone Pro access in one tap — no payment needed, no cards. Bigger workspaces, faster models, priority support." },
  { icon: "📱", title: "Installable app", desc: "Install Arynox on your phone or desktop like a native app — works offline-friendly and opens instantly." },
];

const STEPS = [
  { n: "1", title: "Sign in", desc: "One tap with Google, or email — your workspace follows you on any device." },
  { n: "2", title: "Ask anything", desc: "In English, हिन्दी or मराठी — by typing, voice, camera or any file (Excel, Word, PDF, audio…)." },
  { n: "3", title: "Get it done", desc: "Websites, Excel sheets, PDFs, images, code — built, run and ready to download." },
];

const FAQS = [
  { q: "Is Arynox AI really free right now?", a: "Yes — while in testing, everything is free. A Pro tier (₹299/month, on waitlist) is coming with higher limits, priority speed and bigger workspaces." },
  { q: "Does it understand Marathi and Hindi?", a: "Yes. Chat, voice input and replies all work in English, Hindi and Marathi, and the business concierge mode speaks all three naturally." },
  { q: "Can it really build websites and apps?", a: "Yes — just type \"build me a calculator\" or \"make a website for my hotel\" in chat and the build happens automatically in the Code section: complete multi-file projects with a folder tree, run console and live preview." },
  { q: "What is live detection and visitor mode?", a: "The Live section uses real-time on-device camera AI to see people, objects and documents. Turn on Visitor mode and it greets each person out loud, asks their name, saves what they are looking for, and guides them — like a smart shop assistant on your phone." },
  { q: "How do I get Pro access?", a: "The app owner grants it — ask them for a 💎 Pro grant with your email. No cards, no payments needed while in testing." },
  { q: "Are its facts real or made up?", a: "Arynox verifies facts with live web search (MWMBL + Exa) before answering and cites its sources. When it cannot verify something online, it says so honestly instead of guessing." },
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
            <p className="landing-sub">Arynox AI is a complete AI workspace in English, हिन्दी and मराठी — three clean sections: 💬 normal chat, 💻 a coding studio that builds apps the moment you ask, and 👁 live camera detection that greets people, asks their name and guides them. Plus voice, Excel/PDF/Word files, images and automations — with live web search so every answer is verified.</p>
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
              <div className="mock-line ai">🛠 Built in Code — 4 files, live preview ready:</div>
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
                <li>AI coding studio with live preview & a coding agent</li>
                <li>Excel, PDF & Word files</li>
                <li>Live web search with cited sources</li>
                <li>Daily usage limits</li>
              </ul>
              <a className="landing-btn" href="/app">Start free</a>
            </div>
            <div className="landing-plan featured">
              <div className="landing-plan-tag">Granted by the owner</div>
              <h3>Pro</h3>
              <div className="landing-price">₹299<span>/month</span></div>
              <ul>
                <li>Everything in Free, unlimited</li>
                <li>Priority speed & bigger workspaces</li>
                <li>Image generation, higher limits</li>
                <li>Automations & MCP servers</li>
                <li>Early-access features</li>
              </ul>
              <a className="landing-btn ghost" href="/app">Ask the owner to unlock 💎</a>
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
