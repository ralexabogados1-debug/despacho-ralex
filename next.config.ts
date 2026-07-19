import type { NextConfig } from "next";

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',

  // 🔧 DESACTIVADO: estas dos opciones hacen que el Service Worker
  // intercepte también las peticiones internas de RSC que usa Next.js
  // App Router para las navegaciones client-side (clic en un <Link> sin
  // recargar la página). Si el SW no las maneja bien, la navegación se
  // queda "pegada" en la página actual — la URL puede cambiar pero el
  // contenido nunca se actualiza. Las páginas siguen precacheadas por
  // additionalManifestEntries y por la regla NetworkFirst de más abajo,
  // así que el offline-first no se pierde, solo se evita esta interferencia.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,

  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',

  // SW toma control inmediatamente sin esperar a que se cierren tabs
  workboxOptions: {
  skipWaiting: true,
  clientsClaim: true,

  // 🆕 Precachear todas las rutas al instalar el SW
  additionalManifestEntries: [
    { url: '/sistema/dashboard',                  revision: '1' },
    { url: '/sistema/expedientes/civil',          revision: '1' },
    { url: '/sistema/expedientes/penal',          revision: '1' },
    { url: '/sistema/expedientes/amparo',         revision: '1' },
    { url: '/sistema/tareas',                     revision: '1' },
    { url: '/sistema/agenda',                     revision: '1' },
    { url: '/sistema/perfil',                     revision: '1' },
    { url: '/sistema/usuarios',                   revision: '1' },
    { url: '/login',                              revision: '1' },
    { url: '/offline',                            revision: '1' },
  ],



    runtimeCaching: [
      // ─── 0. SUPABASE (API + REST) ───────────────────────────────────
      // NetworkOnly explícito: el Service Worker NUNCA debe interceptar,
      // cachear, ni reintentar peticiones hacia Supabase (auth, REST,
      // y el ping de hayConexionReal en lib/checkConnection.ts). Estas
      // peticiones deben ir directas a la red y fallar/resolver rápido
      // según el timeout definido en el código, sin que Workbox interfiera.
      {
        urlPattern: ({ url }: any) => url.origin === process.env.NEXT_PUBLIC_SUPABASE_URL,
        handler: 'NetworkOnly',
        options: {
          cacheName: 'supabase-bypass',
        },
      },

      // ─── 0.5 RSC / DATOS DE NAVEGACIÓN CLIENT-SIDE DE NEXT.JS ───────
      // Bypass explícito para las peticiones internas que Next.js App
      // Router dispara al navegar entre páginas sin recargar (llevan el
      // query param _rsc o el header RSC). Nunca deben pasar por Workbox.
      {
        urlPattern: ({ url }: any) => url.searchParams.has('_rsc'),
        handler: 'NetworkOnly',
      },

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