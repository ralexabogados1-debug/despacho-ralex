'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { leerSesionLocal } from '@/lib/authLocal'
import { query } from '@/lib/dbHelpers'
import ClienteAmparos from './cliente'

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 Helper: getUser con timeout — nunca lanza error (igual que dashboard/layout)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 📦 Carga local desde SQLite — misma forma que Supabase devuelve
// ─────────────────────────────────────────────────────────────────────────────
async function cargarAmparosLocales() {
  // Juzgados (todos los que tengan materia 'Amparo' por nombre, sin depender de id fijo)
  const juzgadosDistrito = await query<any>(`
    SELECT j.id, j.nombre, j.ciudad
    FROM juzgados j
    INNER JOIN materias m ON m.id = j.materia_id
    WHERE m.nombre = 'Amparo'
  `).catch(() => [] as any[])

  // Abogados activos
  const abogados = await query<any>(`
    SELECT id, nombre_completo FROM usuarios
    WHERE rol = 'Abogado' AND activo = 1
  `).catch(() => [] as any[])

  // Expedientes de amparo con sus relaciones
  const rows = await query<any>(`
    SELECT
      e.id, e.numero_expediente, e.estado, e.fecha_inicio, e.descripcion,
      c.nombre_completo AS cliente_nombre,
      j.nombre           AS juzgado_nombre,
      j.ciudad            AS juzgado_ciudad,
      ea.tipo_amparo, ea.autoridad_responsable, ea.acto_reclamado,
      ea.tercero_interesado, ea.estadio_procesal, ea.proxima_audiencia
    FROM expedientes e
    LEFT JOIN clientes            c  ON c.id  = e.cliente_id
    LEFT JOIN juzgados            j  ON j.id  = e.juzgado_id
    INNER JOIN expedientes_amparo ea ON ea.expediente_id = e.id
    ORDER BY e.created_at DESC
  `)

  const amparosNormalizados = await Promise.all(rows.map(async (r: any) => {
    const tareas = await query<any>(
      `SELECT id, fecha_vencimiento, completada FROM tareas
       WHERE expediente_id = ? AND (eliminada = 0 OR eliminada IS NULL)`,
      [r.id]
    )
    return {
      id:                 r.id,
      numero_expediente:  r.numero_expediente,
      estado:             r.estado,
      fecha_inicio:       r.fecha_inicio,
      descripcion:        r.descripcion,
      clientes:           r.cliente_nombre ? { nombre_completo: r.cliente_nombre } : null,
      juzgados:           r.juzgado_nombre ? { nombre: r.juzgado_nombre, ciudad: r.juzgado_ciudad } : null,
      tareas:             tareas.map((t: any) => ({ ...t, completada: !!t.completada })),
      expedientes_amparo: {
        tipo_amparo:            r.tipo_amparo,
        autoridad_responsable:  r.autoridad_responsable,
        acto_reclamado:         r.acto_reclamado,
        tercero_interesado:     r.tercero_interesado,
        estadio_procesal:       r.estadio_procesal,
        proxima_audiencia:      r.proxima_audiencia,
      },
    }
  }))

  return { juzgadosDistrito, abogados, amparosNormalizados }
}

export default function AmparosPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [juzgados, setJuzgados] = useState<any[]>([])
  const [abogados, setAbogados] = useState<any[]>([])
  const [amparos, setAmparos]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [esOffline, setEsOffline] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      const sesionLocal = leerSesionLocal()
      const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()

      const usarDatosLocales = async () => {
        try {
          const local = await cargarAmparosLocales()
          setJuzgados(local.juzgadosDistrito)
          setAbogados(local.abogados)
          setAmparos(local.amparosNormalizados)
        } catch (e) {
          console.error('SQLite error (amparo):', e)
        }
        setEsOffline(true)
        setLoading(false)
      }

      const user = await getUserConTimeout(supabase)

      if (!user) {
        if (!cacheValido) {
          router.push('/login')
          return
        }
        await usarDatosLocales()
        return
      }

      try {
        const { data: materiaAmparo } = await supabase
          .from('materias').select('id').eq('nombre', 'Amparo').single()

        const { data: juzgadosDistrito } = await supabase
          .from('juzgados').select('id, nombre, ciudad').eq('materia_id', materiaAmparo?.id ?? -1)

        const { data: abogadosData } = await supabase
          .from('usuarios').select('id, nombre_completo').eq('rol', 'Abogado').eq('activo', true)

        const { data: expedientesAmparo } = await supabase
          .from('expedientes')
          .select(`
            id, numero_expediente, estado, fecha_inicio, descripcion,
            clientes ( nombre_completo ),
            juzgados ( nombre, ciudad ),
            tareas ( id, fecha_vencimiento, completada ),
            expedientes_amparo (
              tipo_amparo, autoridad_responsable, acto_reclamado, tercero_interesado,
              estadio_procesal, proxima_audiencia
            )
          `)
          .eq('materia_id', materiaAmparo?.id ?? -1)
          .order('created_at', { ascending: false })

        const amparosNormalizados = (expedientesAmparo ?? []).map((exp: any) => ({
          id: exp.id,
          numero_expediente: exp.numero_expediente,
          estado: exp.estado,
          fecha_inicio: exp.fecha_inicio,
          descripcion: exp.descripcion,
          clientes: exp.clientes ? { nombre_completo: exp.clientes.nombre_completo } : null,
          juzgados: exp.juzgados ? { nombre: exp.juzgados.nombre, ciudad: exp.juzgados.ciudad } : null,
          tareas: (exp.tareas ?? []).map((t: any) => ({
            id: t.id, fecha_vencimiento: t.fecha_vencimiento, completada: t.completada,
          })),
          expedientes_amparo: Array.isArray(exp.expedientes_amparo)
            ? (exp.expedientes_amparo[0] ?? null)
            : exp.expedientes_amparo,
        }))

        setJuzgados(juzgadosDistrito ?? [])
        setAbogados(abogadosData ?? [])
        setAmparos(amparosNormalizados)
        setLoading(false)

      } catch (e) {
        console.error('Amparo error:', e)
        if (cacheValido) {
          await usarDatosLocales()
        } else {
          router.push('/login')
        }
      }
    }

    cargar()
  }, [supabase, router])

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
      />
    </div>
  )
}