import "./globals.css";

export const metadata = {
  title: "Arynox AI - Trilingual AI Assistant",
  description: "Arynox AI: your trilingual AI assistant - English, Hindi, Marathi. Chat, voice, vision and image generation.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
