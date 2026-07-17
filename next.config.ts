import type { NextConfig } from "next";

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',

  // SW toma control inmediatamente sin esperar a que se cierren tabs
  skipWaiting: true,
  clientsClaim: true,

  fallbacks: {
    document: '/offline',
  },

  workboxOptions: {
    // Estos dos son críticos para cold start offline
    skipWaiting: true,
    clientsClaim: true,

    runtimeCaching: [
      // ─── 1. RUTA RAÍZ ────────────────────────────────────────────────────
{
  urlPattern: ({ url }: any) => url.pathname === '/',
  handler: 'StaleWhileRevalidate',
  options: {
    cacheName: 'start-url',
  },
},

      // ─── 2. WASM (sql.js) ────────────────────────────────────────────
      // CacheFirst: una vez descargado nunca vuelve a la red.
      // Es el archivo más crítico para que la BD local funcione offline.
      {
        urlPattern: /\.wasm$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'wasm-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },

      // ─── 3. NAVEGACIONES (páginas) ───────────────────────────────────
      // NetworkFirst con timeout corto: intenta red 3s,
      // si no hay respuesta sirve la página cacheada.
      // El fallback /offline cubre rutas que nunca se visitaron online.
      {
        urlPattern: ({ request }: any) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache',
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 60,
            maxAgeSeconds: 60 * 60 * 24 * 7,
          },
        },
      },

      // ─── 4. JS Y CSS ─────────────────────────────────────────────────
      // StaleWhileRevalidate: sirve desde caché al instante,
      // actualiza en segundo plano. Cubre todos los chunks de Next.js.
      {
        urlPattern: ({ request }: any) =>
          request.destination === 'script' || request.destination === 'style',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-resources',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 7,
          },
        },
      },

      // ─── 5. IMÁGENES Y FUENTES ───────────────────────────────────────
      // CacheFirst: activos que nunca cambian entre visitas.
      {
        urlPattern: ({ request }: any) =>
          request.destination === 'image' || request.destination === 'font',
        handler: 'CacheFirst',
        options: {
          cacheName: 'assets-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
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

export default withPWA(nextConfig);