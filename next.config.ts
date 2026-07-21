// next.config.js
const buildId = Date.now().toString();

// Importa el plugin
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',

  // ✅ Apunta a tu Service Worker personalizado (el polyfill se aplica ahí)
  swSrc: 'public/sw.js',

  // 🧹 Ya no necesitas workboxOptions aquí; se usarán las que vienen en el swe-worker
  // workboxOptions: { ... }
});

const nextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        source: '/sql-wasm.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);