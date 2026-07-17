'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { leerSesionLocal } from '@/lib/authLocal'
import { query, queryExpedientesPenalesLocal, queryCatalogosLocal } from '@/lib/dbHelpers'
import { syncConSupabase } from '@/lib/sync'
import ClienteCausasPenales from './cliente'

// ────────────────────────────────────────────────────────────────
// 🔑 getUser con timeout (igual que en el Dashboard)
// ────────────────────────────────────────────────────────────────
async function getUserConTimeout(
  supabase: ReturnType<typeof createBrowserClient>,
  ms = 4000
) {
  try {
    const resultado = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ])
    if (!resultado || !('data' in resultado)) return null
    return resultado.data.user ?? null
  } catch {
    // Captura errores de red reales (offline, DNS, CORS, etc.)
    // El "Failed to fetch" que ves en consola es solo el log
    // automático del navegador para el fetch fallido; no es un
    // error sin manejar de la app.
    return null
  }
}

// ────────────────────────────────────────────────────────────────
// 🧩 Página Penal cliente‑first (funciona offline)
// ────────────────────────────────────────────────────────────────
export default function PenalPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [data, setData] = useState<{
    jueces: { id: number; nombre: string }[]
    ministerios: { id: number; nombre_agencia: string }[]
    abogados: { id: number; nombre_completo: string }[]
    causas: any[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      const sesionLocal = leerSesionLocal()
      const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()

      // 1. Si el navegador ya sabe que no hay conexión, ni intentamos el fetch.
      //    Esto evita el error de red innecesario y el ruido en consola cuando
      //    está completamente offline (ERR_INTERNET_DISCONNECTED).
      const user = navigator.onLine
        ? await getUserConTimeout(supabase)
        : null

      if (!user && !cacheValido) {
        // Solo forzamos login si NO hay usuario remoto Y NO hay sesión
        // local válida. Si hay sesión local (aunque el token remoto haya
        // expirado o no haya red), dejamos continuar para no bloquear
        // el uso offline.
        router.push('/login')
        return
      }

      // 2. ⚡ Sincronizar cola local si hay red
      if (navigator.onLine) {
        try {
          await syncConSupabase()
        } catch (e) {
          console.warn('Fallo en sincronización:', e)
        }
      }

      // 3. Cargar datos desde SQLite local (SIEMPRE)
      try {
        const [catalogos, causas] = await Promise.all([
          queryCatalogosLocal(),
          queryExpedientesPenalesLocal(),
        ])

        // Obtener abogados (usuarios con rol 'Abogado')
        const abogadosLocales = await query<{ id: number; nombre_completo: string }>(
          `SELECT id, nombre_completo FROM usuarios WHERE rol = 'Abogado' AND activo = 1`
        )

        setData({
          jueces: catalogos.jueces ?? [],
          ministerios: catalogos.ministerios ?? [],
          abogados: abogadosLocales ?? [],
          causas: causas ?? [],
        })
        setError(null)
      } catch (err) {
        console.error('Error cargando datos locales:', err)
        setError('No se pudieron cargar los datos. Intentá recargar la página.')
        // Dejamos data como null para que se muestre el error
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [supabase, router])

  // ── Spinner de carga (sin fondo negro forzado) ──
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 12,
        color: '#8fa8e0',
      }}>
        <div style={{
          width: 24,
          height: 24,
          border: '2px solid #b3434f',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
          Cargando causas penales…
        </span>
      </div>
    )
  }

  // ── Error al cargar ──
  if (error || !data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 8,
        padding: 20,
        textAlign: 'center',
      }}>
        <p style={{ color: '#dc2626', fontSize: 16, margin: 0 }}>{error || 'Error inesperado'}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            padding: '6px 16px',
            background: '#b3434f',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  // ── Render normal del componente (usa el tema del layout) ──
  return (
    <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(20px, 5vw, 40px)', width: '100%' }}>
      <ClienteCausasPenales
        jueces={data.jueces}
        ministerios={data.ministerios}
        abogados={data.abogados}
        causas={data.causas}
      />
    </div>
  )
}