// Load environment variables from .env.local
require("dotenv").config({ path: "../../.env.local" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Включаем поддержку Turborepo (transpilePackages вынесен из experimental в Next.js 14)
  transpilePackages: [
    "@shipvibes/shared",
    "@shipvibes/database",
    "@shipvibes/storage",
  ],
  // Настройки для работы с WebSocket
  async rewrites() {
    return [
      {
        source: "/api/ws/:path*",
        destination: `${process.env.WS_URL || "http://localhost:8080"}/:path*`,
      },
    ];
  },
  // Explicitly define environment variables for server-side
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    WS_PORT: process.env.WS_PORT,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  },
};

module.exports = nextConfig;
