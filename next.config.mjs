/** @type {import('next').NextConfig} */
const API_ORIGIN = (process.env.API_ORIGIN || "").replace(/\/+$/, "");

const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({ "pdf-parse": "commonjs pdf-parse" });
    }
    return config;
  },
};

if (API_ORIGIN) {
  nextConfig.rewrites = async () => ({
    beforeFiles: [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
    ],
  });
}

export default nextConfig;
