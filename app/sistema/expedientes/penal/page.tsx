'use client'

import { hayConexionReal } from '@/lib/checkconnection'
import { useArranque } from '@/hooks/useArranque'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { leerSesionLocal } from '@/lib/authLocal'
import { query, queryCatalogosLocal } from '@/lib/dbHelpers'
import { syncConSupabase } from '@/lib/sync'
import ClienteCausasPenales from './cliente'

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
    return null
  }
}

async function cargarPenalesLocales() {
  const sesionLocal = leerSesionLocal()
  const emailUsuario = sesionLocal?.email ?? ''

  console.log('🔴 [PENAL] Email de sesión local:', emailUsuario)

  const [usuarioActual] = await query<any>(
    `SELECT id FROM usuarios WHERE email = ?`, [emailUsuario]
  ).catch(() => [] as any[])
  const usuarioId = usuarioActual?.id ?? -1

  console.log('🔴 [PENAL] usuarioId resuelto:', usuarioId)

  // muestra todos los usuarios en SQLite para comparar
  const todosUsuarios = await query<any>(`SELECT id, email FROM usuarios`)
  console.log('🔴 [PENAL] Usuarios en SQLite:', todosUsuarios)
  const rows = await query<any>(`
    SELECT
      e.id, e.numero_expediente, e.estado, e.caracter_cliente,
      e.cliente_id, e.juez_id,
      c.nombre_completo AS cliente_nombre,
      j.nombre          AS juez_nombre
    FROM expedientes e
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN jueces   j ON j.id = e.juez_id
    WHERE e.id IN (SELECT expediente_id FROM expedientes_penales)
      AND (
        e.creado_por = ?
        OR EXISTS (
          SELECT 1 FROM expediente_abogados ab
          WHERE ab.expediente_id = e.id AND ab.usuario_id = ?
        )
      )
    ORDER BY e.id DESC
  `, [usuarioId, usuarioId])

  const causas = await Promise.all(rows.map(async (exp: any) => {
    const penales = await query<any>(`
      SELECT ep.*, mp.nombre_agencia
      FROM expedientes_penales ep
      LEFT JOIN ministerios_publicos mp ON mp.id = ep.ministerio_publico_id
      WHERE ep.expediente_id = ?
    `, [exp.id])

    const tareas = await query<any>(`
      SELECT * FROM tareas
      WHERE expediente_id = ? AND (eliminada = 0 OR eliminada IS NULL)
    `, [exp.id])

    return {
      id:               exp.id,
      numero_expediente: exp.numero_expediente,
      estado:           exp.estado,
      caracter_cliente: exp.caracter_cliente,
      clientes:         { nombre_completo: exp.cliente_nombre ?? null },
      jueces:           { nombre: exp.juez_nombre ?? null },
      expedientes_penales: penales.map((p: any) => ({
        ...p,
        ministerios_publicos: { nombre_agencia: p.nombre_agencia ?? null }
      })),
      tareas: tareas.map((t: any) => ({ ...t, completada: !!t.completada })),
    }
  }))

  return causas
}

export default function PenalPage() {
  const arranqueListo = useArranque()
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
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!arranqueListo) return
    const cargar = async () => {
      const sesionLocal = leerSesionLocal()
      const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()

      const conectado = await hayConexionReal()
      const user = conectado ? await getUserConTimeout(supabase) : null

      if (!user && !cacheValido) {
        router.push('/login')
        return
      }

      if (conectado) {
        try {
          await syncConSupabase()
        } catch (e) {
          console.warn('Fallo en sincronización:', e)
        }
      }

      try {
        const [catalogos, causas, abogadosLocales] = await Promise.all([
          queryCatalogosLocal(),
          cargarPenalesLocales(),
          query<{ id: number; nombre_completo: string }>(
            `SELECT id, nombre_completo FROM usuarios WHERE rol = 'Abogado' AND activo = 1`
          ),
        ])

        setData({
          jueces:      catalogos.jueces      ?? [],
          ministerios: catalogos.ministerios ?? [],
          abogados:    abogadosLocales       ?? [],
          causas:      causas                ?? [],
        })
        setError(null)
      } catch (err) {
        console.error('Error cargando datos locales:', err)
        setError('No se pudieron cargar los datos. Intentá recargar la página.')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [supabase, router, arranqueListo])

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', gap: 12, color: '#8fa8e0',
      }}>
        <div style={{
          width: 24, height: 24, border: '2px solid #b3434f',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
          Cargando causas penales…
        </span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', gap: 8,
        padding: 20, textAlign: 'center',
      }}>
        <p style={{ color: '#dc2626', fontSize: 16, margin: 0 }}>
          {error || 'Error inesperado'}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: '6px 16px', background: '#b3434f',
            color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

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