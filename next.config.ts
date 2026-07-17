import type { NextConfig } from "next";
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',

  // 🆕 Si una navegación (clic en una causa, por ejemplo) cae a "hard
  // navigation" por falta de red y esa ruta tampoco está en el cache de
  // páginas de abajo, el service worker sirve esta página en vez de dejar
  // que el navegador muestre su pantalla nativa de "sin conexión".
  // Crea el archivo app/offline/page.tsx con un mensaje simple (ver nota).
  fallbacks: {
    document: '/offline',
  },

  workboxOptions: {
    runtimeCaching: [
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
      // 🆕 Páginas (navegaciones): intenta red primero (máx 3s), y si no
      // hay red, sirve la versión cacheada de esa MISMA ruta si el usuario
      // ya la visitó antes estando en línea. Antes no existía ninguna
      // regla para navegaciones, así que next-pwa no cacheaba nada del
      // "document" y cualquier hard-navigation offline fallaba en seco.
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
      // 🆕 JS y CSS: se cachean automáticamente conforme el usuario navega,
      // para que los chunks de cada ruta estén disponibles offline después
      // de la primera visita.
      {
        urlPattern: ({ request }: any) =>
          request.destination === 'script' || request.destination === 'style',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-resources',
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