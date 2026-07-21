import type { NextConfig } from "next";

const buildId = Date.now().toString();

const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : '';

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',

  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,

    additionalManifestEntries: [
      { url: '/sistema/dashboard',          revision: buildId },
      { url: '/sistema/expedientes/civil',  revision: buildId },
      { url: '/sistema/expedientes/penal',  revision: buildId },
      { url: '/sistema/expedientes/amparo', revision: buildId },
      { url: '/sistema/tareas',             revision: buildId },
      { url: '/sistema/agenda',             revision: buildId },
      { url: '/sistema/perfil',             revision: buildId },
      { url: '/sistema/usuarios',           revision: buildId },
      { url: '/login',                      revision: buildId },
      { url: '/offline',                    revision: buildId },
    ],

    runtimeCaching: [
      // ─── PING de conectividad — nunca cachear ───────────────────────
      {
        urlPattern: ({ url }: any) => url.pathname === '/api/ping',
        handler: 'NetworkOnly',
      },

      // ─── 0. SUPABASE ────────────────────────────────────────────────
      // ✅ SUPABASE_ORIGIN se resuelve en build time, no usa process.env
      // dentro del SW (lo cual causaba "process is not defined").
      {
        urlPattern: ({ url }: any) =>
          SUPABASE_ORIGIN !== '' && url.origin === SUPABASE_ORIGIN,
        handler: 'NetworkOnly',
        options: { cacheName: 'supabase-bypass' },
      },

      // ─── 0.5 RSC ────────────────────────────────────────────────────
      {
        urlPattern: ({ url }: any) => url.searchParams.has('_rsc'),
        handler: 'NetworkOnly',
      },

      // ─── 1. RAÍZ ────────────────────────────────────────────────────
      {
        urlPattern: ({ url }: any) => url.pathname === '/',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'start-url',
          networkTimeoutSeconds: 3,
        },
      },

      // ─── 2. WASM ────────────────────────────────────────────────────
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

      // ─── 3. NAVEGACIONES ────────────────────────────────────────────
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

      // ─── 4. JS Y CSS ────────────────────────────────────────────────
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

      // ─── 5. IMÁGENES Y FUENTES ──────────────────────────────────────
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