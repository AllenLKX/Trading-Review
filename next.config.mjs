/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["192.168.2.100"],
  experimental: {
    // Avoid a Next.js 15.5 devtools manifest mismatch in local Webpack dev mode.
    devtoolSegmentExplorer: false
  }
};

export default nextConfig;
