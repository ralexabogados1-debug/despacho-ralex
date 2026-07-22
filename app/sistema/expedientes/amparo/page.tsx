'use client'

import { hayConexionReal } from '@/lib/checkconnection'
import { useArranque } from '@/hooks/useArranque'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { leerSesionLocal } from '@/lib/authLocal'
import { query } from '@/lib/dbHelpers'
import { syncConSupabase } from '@/lib/sync'
import ClienteAmparos from './cliente'

async function getUserConTimeout(supabase: ReturnType<typeof createBrowserClient>, ms = 4000) {
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

async function cargarAmparosLocales() {
  const sesionLocal = leerSesionLocal()
  const emailUsuario = sesionLocal?.email ?? ''

  const [usuarioActual] = await query<any>(
    `SELECT id FROM usuarios WHERE email = ?`, [emailUsuario]
  ).catch(() => [] as any[])
  const usuarioId = usuarioActual?.id ?? -1

  const juzgadosDistrito = await query<any>(`
    SELECT j.id, j.nombre, j.ciudad
    FROM juzgados j
    INNER JOIN materias m ON m.id = j.materia_id
    WHERE m.nombre = 'Amparo'
  `).catch(() => [] as any[])

  const abogados = await query<any>(`
    SELECT id, nombre_completo FROM usuarios
    WHERE rol = 'Abogado' AND activo = 1
  `).catch(() => [] as any[])

  const rows = await query<any>(`
    SELECT
      e.id, e.numero_expediente, e.estado, e.fecha_inicio, e.descripcion,
      c.nombre_completo AS cliente_nombre,
      j.nombre           AS juzgado_nombre,
      j.ciudad           AS juzgado_ciudad,
      ea.tipo_amparo, ea.autoridad_responsable, ea.acto_reclamado,
      ea.tercero_interesado, ea.estadio_procesal, ea.proxima_audiencia
    FROM expedientes e
    LEFT JOIN clientes            c  ON c.id = e.cliente_id
    LEFT JOIN juzgados            j  ON j.id = e.juzgado_id
    INNER JOIN expedientes_amparo ea ON ea.expediente_id = e.id
    WHERE (
      e.creado_por = ?
      OR EXISTS (
        SELECT 1 FROM expediente_abogados ab
        WHERE ab.expediente_id = e.id AND ab.usuario_id = ?
      )
    )
    ORDER BY e.created_at DESC
  `, [usuarioId, usuarioId])

  const amparosNormalizados = await Promise.all(rows.map(async (r: any) => {
    const tareas = await query<any>(
      `SELECT id, fecha_vencimiento, completada FROM tareas
       WHERE expediente_id = ? AND (eliminada = 0 OR eliminada IS NULL)`,
      [r.id]
    )
    return {
      id:                r.id,
      numero_expediente: r.numero_expediente,
      estado:            r.estado,
      fecha_inicio:      r.fecha_inicio,
      descripcion:       r.descripcion,
      clientes:          r.cliente_nombre ? { nombre_completo: r.cliente_nombre } : null,
      juzgados:          r.juzgado_nombre ? { nombre: r.juzgado_nombre, ciudad: r.juzgado_ciudad } : null,
      tareas:            tareas.map((t: any) => ({ ...t, completada: !!t.completada })),
      expedientes_amparo: {
        tipo_amparo:           r.tipo_amparo,
        autoridad_responsable: r.autoridad_responsable,
        acto_reclamado:        r.acto_reclamado,
        tercero_interesado:    r.tercero_interesado,
        estadio_procesal:      r.estadio_procesal,
        proxima_audiencia:     r.proxima_audiencia,
      },
    }
  }))

  return { juzgadosDistrito, abogados, amparosNormalizados }
}

export default function AmparosPage() {
  const arranqueListo = useArranque()
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [juzgados, setJuzgados] = useState<any[]>([])
  const [abogados, setAbogados] = useState<any[]>([])
  const [amparos,  setAmparos]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [esOffline, setEsOffline] = useState(false)

  const cargar = async () => {
    const sesionLocal = leerSesionLocal()
    const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()

    const usarDatosLocales = async (offline = true) => {
      try {
        const local = await cargarAmparosLocales()
        setJuzgados(local.juzgadosDistrito)
        setAbogados(local.abogados)
        setAmparos(local.amparosNormalizados)
      } catch (e) {
        console.error('SQLite error (amparo):', e)
      }
      setEsOffline(offline)
      setLoading(false)
    }

    const conectado = await hayConexionReal()
    const user = conectado ? await getUserConTimeout(supabase) : null

    if (!user) {
      if (!cacheValido) {
        router.push('/login')
        return
      }
      await usarDatosLocales(true)
      return
    }

    // ✅ Con conexión: sincroniza primero, luego lee de SQLite local
    try {
      await syncConSupabase()
    } catch (e) {
      console.warn('Fallo en sync (amparo):', e)
    }

    await usarDatosLocales(false)
  }

  useEffect(() => {
    if (!arranqueListo) return
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router, arranqueListo])

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #d4af37', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(20px, 5vw, 40px)', width: '100%' }}>
      {esOffline && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(212,175,55,0.08)', border: '0.5px solid rgba(212,175,55,0.25)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 15 }}>📡</span>
          <span style={{ fontSize: 13, color: '#d4af37' }}>
            Modo sin conexión — mostrando datos guardados localmente. Los cambios se sincronizarán al recuperar internet.
          </span>
        </div>
      )}
      <ClienteAmparos
        juzgados={juzgados}
        abogados={abogados}
        amparos={amparos}
        onCreado={cargar}
      />
    </div>
  )
}