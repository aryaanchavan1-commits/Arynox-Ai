/** @type {import('next').NextConfig} */
const API_ORIGIN = (process.env.API_ORIGIN || "").replace(/\/+$/, "");

const nextConfig = {
  reactStrictMode: false,
};

if (API_ORIGIN) {
  nextConfig.rewrites = async () => ({
    beforeFiles: [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
    ],
  });
}

export default nextConfig;
