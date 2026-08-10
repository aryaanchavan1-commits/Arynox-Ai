"use client";

import { useEffect, useMemo, useState } from "react";
import { BASE_INR, COUNTRY_CURRENCY, CURRENCIES, detectRegion, getRates, priceFor } from "@/lib/currency";

export default function Pricing() {
  const [region, setRegion] = useState(null);
  const [rates, setRates] = useState(null);
  const [currency, setCurrency] = useState("auto");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      const [r, fx] = await Promise.all([detectRegion(), getRates()]);
      if (dead) return;
      setRegion(r);
      setRates(fx);
      try {
        const saved = localStorage.getItem("arynox_currency");
        if (saved) setCurrency(saved);
      } catch {}
      setReady(true);
    })();
    return () => { dead = true; };
  }, []);

  const code = useMemo(() => {
    if (currency !== "auto") return currency;
    return COUNTRY_CURRENCY[region?.country] || "USD";
  }, [currency, region]);

  const info = useMemo(() => {
    const cur = CURRENCIES.find((c) => c.code === code) || CURRENCIES[1];
    const free = priceFor("INR", rates);
    const pro = priceFor(code, rates);
    return { cur, free, pro };
  }, [code, rates]);

  const setCur = (c) => {
    setCurrency(c);
    try { localStorage.setItem("arynox_currency", c); } catch {}
  };

  return (
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
        <div className="landing-price">{ready ? `${info.cur.symbol}${info.pro.amount}` : "…"}<span>/month</span></div>
        <ul>
          <li>Everything in Free, unlimited</li>
          <li>Priority speed & bigger workspaces</li>
          <li>Image generation, higher limits</li>
          <li>Automations & MCP servers</li>
          <li>Early-access features</li>
        </ul>
        <a className="landing-btn ghost" href="/app">Ask the owner to unlock 💎</a>
      </div>
      <div className="landing-pricing-note">
        <span>{ready ? (region?.flag || "🌍") : "🌍"}</span>
        <span>Price in your region{ready && region ? ` (${region.name})` : ""}: {ready ? `${info.cur.symbol}${info.pro.amount}` : "…"} ≈ ₹{BASE_INR}/month · </span>
        <select className="landing-currency" value={currency} onChange={(e) => setCur(e.target.value)} aria-label="Choose currency">
          <option value="auto">Auto — detect region</option>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.symbol}{c.code})</option>
          ))}
        </select>
      </div>
    </div>
  );
}
