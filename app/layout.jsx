import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://arynox-ai.vercel.app"),
  title: {
    default: "Arynox AI — Trilingual AI Assistant (Hindi, Marathi, English) | Maharashtra",
    template: "%s | Arynox AI",
  },
  description:
    "Arynox AI is Maharashtra's premium trilingual AI assistant — chat, voice, vision, coding, images, PDF & Excel files and automations in English, हिन्दी and मराठी. Built for hotels, resorts and businesses across Ratnagiri, Sindhudurg and the Konkan region, India.",
  keywords: [
    "AI assistant Maharashtra", "Marathi AI", "Hindi AI", "trilingual AI assistant",
    "AI for hotels India", "Ratnagiri AI", "Sindhudurg AI", "Konkan AI",
    "Arynox AI", "Arynox Tech", "AI chatbot Marathi", "voice AI Hindi Marathi",
    "AI office automation", "WhatsApp AI bot India",
  ],
  authors: [{ name: "Arynox Tech", url: "https://github.com/aryaanchavan1-commits" }],
  creator: "Arynox Tech",
  publisher: "Arynox Tech",
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://arynox-ai.vercel.app",
    siteName: "Arynox AI",
    title: "Arynox AI — Trilingual AI Assistant for Maharashtra",
    description:
      "Chat, voice, vision, code, images and office files — in English, हिन्दी and मराठी. Built by Arynox Tech, Ratnagiri, Maharashtra.",
    locale: "en_IN",
    countryName: "India",
    images: [{ url: "/icon.svg", width: 512, height: 512, alt: "Arynox AI logo" }],
  },
  twitter: {
    card: "summary",
    title: "Arynox AI — Trilingual AI Assistant for Maharashtra",
    description: "Chat, voice, vision, code, images and office files — in English, हिन्दी and मराठी.",
    images: ["/icon.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  other: {
    "geo.region": "IN-MH",
    "geo.placename": "Ratnagiri, Maharashtra, India",
    "geo.position": "16.990;73.312",
    ICBM: "16.990, 73.312",
    "og:country-name": "IN",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f4ed",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Arynox AI" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Arynox AI",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Trilingual AI assistant for Maharashtra — chat, voice, vision, coding IDE, office files (Excel/PDF/Word), deep research and automations in English, Hindi and Marathi.",
      url: "https://arynox-ai.vercel.app",
      inLanguage: ["en", "hi", "mr"],
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR", description: "Free while in testing" },
      publisher: {
        "@type": "Organization",
        name: "Arynox Tech",
        url: "https://github.com/aryaanchavan1-commits",
        address: { "@type": "PostalAddress", addressRegion: "Maharashtra", addressCountry: "IN" },
      },
    },
    {
      "@type": "Organization",
      name: "Arynox Tech",
      url: "https://github.com/aryaanchavan1-commits",
      address: { "@type": "PostalAddress", addressLocality: "Ratnagiri", addressRegion: "Maharashtra", addressCountry: "IN" },
      areaServed: ["Ratnagiri", "Sindhudurg", "Konkan", "Maharashtra", "India"],
      knowsLanguage: ["en", "hi", "mr"],
      foundingLocation: { "@type": "Place", name: "Ratnagiri, Maharashtra, India" },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
