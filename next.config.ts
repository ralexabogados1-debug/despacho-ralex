import type { NextConfig } from "next";
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /\.wasm$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'wasm-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {};

export default withPWA(nextConfig);