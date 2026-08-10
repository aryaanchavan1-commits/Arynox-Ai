const BASE_INR = 299;

const COUNTRY_CURRENCY = {
  IN: "INR", US: "USD", GB: "GBP", EU: "EUR", AE: "AED", SA: "SAR", CA: "CAD",
  AU: "AUD", SG: "SGD", JP: "JPY", NZ: "NZD", CH: "CHF", LK: "LKR", BD: "BDT",
  NP: "NPR", PK: "PKR", MY: "MYR", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
  NL: "EUR", BE: "EUR", AT: "EUR", IE: "EUR", PT: "EUR", GR: "EUR", FI: "EUR",
};

const CURRENCIES = [
  { code: "INR", flag: "🇮🇳", name: "India", symbol: "₹" },
  { code: "USD", flag: "🇺🇸", name: "USA", symbol: "$" },
  { code: "EUR", flag: "🇪🇺", name: "Europe", symbol: "€" },
  { code: "GBP", flag: "🇬🇧", name: "UK", symbol: "£" },
  { code: "AED", flag: "🇦🇪", name: "UAE", symbol: "د.إ" },
  { code: "SAR", flag: "🇸🇦", name: "Saudi Arabia", symbol: "﷼" },
  { code: "CAD", flag: "🇨🇦", name: "Canada", symbol: "C$" },
  { code: "AUD", flag: "🇦🇺", name: "Australia", symbol: "A$" },
  { code: "SGD", flag: "🇸🇬", name: "Singapore", symbol: "S$" },
  { code: "JPY", flag: "🇯🇵", name: "Japan", symbol: "¥" },
  { code: "NZD", flag: "🇳🇿", name: "New Zealand", symbol: "NZ$" },
  { code: "CHF", flag: "🇨🇭", name: "Switzerland", symbol: "CHF" },
];

const FALLBACK_RATES = {
  INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0094, AED: 0.044, SAR: 0.045,
  CAD: 0.0165, AUD: 0.018, SGD: 0.016, JPY: 1.85, NZD: 0.02, CHF: 0.0105,
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const d = JSON.parse(raw);
    if (!d.t || Date.now() - d.t > (d.max || 24 * 3600 * 1000)) return fallback;
    return d;
  } catch { return fallback; }
}

function save(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
}

async function detectRegion() {
  const cached = load("arynox_region", null);
  if (cached?.country) return cached;
  for (const url of ["https://ipwho.is/", "https://ipapi.co/json/"]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const d = await res.json();
      const country = String(d.country_code || d.countryCode || "").toUpperCase();
      if (!country) continue;
      const out = { country, name: d.country_name || d.country || country, flag: d.flag?.emoji || d.flag || "", t: Date.now(), max: 7 * 24 * 3600 * 1000 };
      save("arynox_region", out);
      return out;
    } catch {}
  }
  return { country: "IN", name: "India", flag: "🇮🇳", t: Date.now(), max: 7 * 24 * 3600 * 1000 };
}

async function getRates() {
  const cached = load("arynox_fx", null);
  if (cached?.rates) return cached.rates;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/INR", { signal: AbortSignal.timeout(8000) });
    const d = await res.json();
    if (d.rates) {
      save("arynox_fx", { rates: d.rates, t: Date.now(), max: 24 * 3600 * 1000 });
      return d.rates;
    }
  } catch {}
  return FALLBACK_RATES;
}

function pretty(n, code) {
  if (code === "INR") return Math.round(n).toLocaleString("en-IN");
  if (n >= 100) return Math.round(n).toLocaleString("en-IN");
  if (n >= 10) return n.toFixed(0);
  return (Math.round(n * 100) / 100).toFixed(2);
}

function priceFor(code, rates) {
  const rate = (rates && rates[code]) || FALLBACK_RATES[code] || 1;
  return { amount: pretty(BASE_INR * rate, code), raw: BASE_INR * rate };
}

export { BASE_INR, COUNTRY_CURRENCY, CURRENCIES, detectRegion, getRates, priceFor, pretty };
