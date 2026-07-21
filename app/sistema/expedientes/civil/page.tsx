'use client'

import { hayConexionReal } from '@/lib/checkconnection'
import { useArranque } from '@/hooks/useArranque'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { leerSesionLocal } from '@/lib/authLocal'
import { queryCatalogosLocal, query } from '@/lib/dbHelpers'
import { syncConSupabase } from '@/lib/sync'
import ClienteCivilFamiliar from './cliente'

const MATERIA_IDS_CIVIL_FAMILIAR = [1, 2]

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

// Carga de datos desde la base local (sin conexión)
async function cargarCivilesLocales() {
  const sesionLocal = leerSesionLocal()
  const emailUsuario = sesionLocal?.email ?? ''

  const [usuarioActual] = await query<any>(
    `SELECT id FROM usuarios WHERE email = ?`, [emailUsuario]
  ).catch(() => [] as any[])
  const usuarioId = usuarioActual?.id ?? -1

  const catalogos = await queryCatalogosLocal().catch(() => ({
    juzgados: [] as any[],
    materias: [] as any[],
  }))

  const juzgados = (catalogos.juzgados ?? []).filter((j: any) =>
    MATERIA_IDS_CIVIL_FAMILIAR.includes(j.materia_id)
  )
  const materias = (catalogos.materias ?? []).filter((m: any) =>
    MATERIA_IDS_CIVIL_FAMILIAR.includes(m.id)
  )

  const rows = await query<any>(`
    SELECT
      e.id, e.numero_expediente, e.estado, e.caracter_cliente, e.contraparte,
      e.tipo_juicio, e.ciudad, e.fecha_inicio, e.descripcion, e.materia_id,
      c.nombre_completo AS cliente_nombre,
      j.nombre          AS juzgado_nombre,
      j.ciudad          AS juzgado_ciudad,
      ec.estadio_procesal
    FROM expedientes e
    LEFT JOIN clientes          c  ON c.id = e.cliente_id
    LEFT JOIN juzgados          j  ON j.id = e.juzgado_id
    INNER JOIN expedientes_civiles ec ON ec.expediente_id = e.id
    WHERE e.materia_id IN (1, 2)
      AND (
        e.creado_por = ?
        OR EXISTS (
          SELECT 1 FROM expediente_abogados ab
          WHERE ab.expediente_id = e.id AND ab.usuario_id = ?
        )
      )
    ORDER BY e.created_at DESC
  `, [usuarioId, usuarioId])

  const expedientesLocales = await Promise.all(rows.map(async (r: any) => {
    const tareas = await query<any>(
      `SELECT id, fecha_vencimiento, completada FROM tareas
       WHERE expediente_id = ? AND (eliminada = 0 OR eliminada IS NULL)`,
      [r.id]
    )
    return {
      id:                r.id,
      numero_expediente: r.numero_expediente,
      estado:            r.estado,
      caracter_cliente:  r.caracter_cliente,
      contraparte:       r.contraparte,
      tipo_juicio:       r.tipo_juicio,
      ciudad:            r.ciudad,
      fecha_inicio:      r.fecha_inicio,
      descripcion:       r.descripcion,
      materia_id:        r.materia_id,
      clientes:  r.cliente_nombre ? { nombre_completo: r.cliente_nombre } : null,
      juzgados:  r.juzgado_nombre ? { nombre: r.juzgado_nombre, ciudad: r.juzgado_ciudad } : null,
      tareas:    tareas.map((t: any) => ({ ...t, completada: !!t.completada })),
      expedientes_civiles: r.estadio_procesal !== undefined
        ? { estadio_procesal: r.estadio_procesal }
        : null,
    }
  }))

  return { expedientesLocales, juzgados, materias }
}

export default function CivilPage() {
  const arranqueListo = useArranque()
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [materias,    setMaterias]    = useState<any[]>([])
  const [juzgados,    setJuzgados]    = useState<any[]>([])
  const [abogados,    setAbogados]    = useState<any[]>([])
  const [expedientes, setExpedientes] = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [esOffline,   setEsOffline]   = useState(false)

  // ─── Función de carga reutilizable (llamada al montar y por onCreado) ───
  const cargarDatos = useCallback(async () => {
    const sesionLocal = leerSesionLocal()
    const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()

    const usarDatosLocales = async () => {
      try {
        const local = await cargarCivilesLocales()
        setMaterias(local.materias)
        setJuzgados(local.juzgados)
        setExpedientes(local.expedientesLocales)
      } catch (e) {
        console.error('SQLite error (civil):', e)
      }
      setEsOffline(true)
      setLoading(false)
    }

    const conectado = await hayConexionReal()
    const user = conectado ? await getUserConTimeout(supabase) : null

    if (!user) {
      if (!cacheValido) {
        router.push('/login')
        return
      }
      await usarDatosLocales()
      return
    }

    // Si hay usuario online, sincronizar y cargar desde Supabase
    try {
      // Sincronizar datos locales con el servidor antes de mostrar
      await syncConSupabase().catch(e => console.warn('syncConSupabase falló:', e))

      const { data: materiasData } = await supabase
        .from('materias').select('id, nombre').in('id', MATERIA_IDS_CIVIL_FAMILIAR)

      const { data: juzgadosData } = await supabase
        .from('juzgados').select('id, nombre, ciudad, materia_id').in('materia_id', MATERIA_IDS_CIVIL_FAMILIAR)

      const { data: abogadosData } = await supabase
        .from('usuarios').select('id, nombre_completo').eq('rol', 'Abogado').eq('activo', true)

      const { data: expedientesCiviles, error: errorExpedientes } = await supabase
        .from('expedientes')
        .select(`
          id, numero_expediente, estado, caracter_cliente, contraparte,
          tipo_juicio, ciudad, fecha_inicio, descripcion, materia_id,
          clientes ( nombre_completo ),
          juzgados ( nombre, ciudad ),
          tareas ( id, fecha_vencimiento, completada ),
          expedientes_civiles ( estadio_procesal )
        `)
        .in('materia_id', MATERIA_IDS_CIVIL_FAMILIAR)
        .order('created_at', { ascending: false })

      if (errorExpedientes) {
        console.error('🔴 Error al consultar expedientes (civil):', errorExpedientes)
      }

      const expedientesNormalizados = (expedientesCiviles ?? []).map((exp: any) => ({
        id:                exp.id,
        numero_expediente: exp.numero_expediente,
        estado:            exp.estado,
        caracter_cliente:  exp.caracter_cliente,
        contraparte:       exp.contraparte,
        tipo_juicio:       exp.tipo_juicio,
        ciudad:            exp.ciudad,
        fecha_inicio:      exp.fecha_inicio,
        descripcion:       exp.descripcion,
        materia_id:        exp.materia_id,
        clientes:  exp.clientes ? { nombre_completo: exp.clientes.nombre_completo } : null,
        juzgados:  exp.juzgados ? { nombre: exp.juzgados.nombre, ciudad: exp.juzgados.ciudad } : null,
        tareas: (exp.tareas ?? []).map((t: any) => ({
          id: t.id, fecha_vencimiento: t.fecha_vencimiento, completada: t.completada,
        })),
        expedientes_civiles: Array.isArray(exp.expedientes_civiles)
          ? (exp.expedientes_civiles[0] ?? null)
          : (exp.expedientes_civiles ?? null),
      }))

      setMaterias(materiasData ?? [])
      setJuzgados(juzgadosData ?? [])
      setAbogados(abogadosData ?? [])
      setExpedientes(expedientesNormalizados)
      setEsOffline(false)
      setLoading(false)

    } catch (e) {
      console.error('Civil error:', e)
      if (cacheValido) {
        await usarDatosLocales()
      } else {
        router.push('/login')
      }
    }
  }, [supabase, router])

  // Efecto inicial: cargar datos al montar
  useEffect(() => {
    if (!arranqueListo) return
    cargarDatos()
  }, [arranqueListo, cargarDatos])

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #4a7fd4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(20px, 5vw, 40px)', width: '100%' }}>
      {esOffline && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(74,127,212,0.08)', border: '0.5px solid rgba(74,127,212,0.25)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 15 }}>📡</span>
          <span style={{ fontSize: 13, color: '#4a7fd4' }}>
            Modo sin conexión — mostrando datos guardados localmente. Los cambios se sincronizarán al recuperar internet.
          </span>
        </div>
      )}
      <ClienteCivilFamiliar
        materias={materias}
        juzgados={juzgados}
        abogados={abogados}
        expedientes={expedientes}
        onCreado={cargarDatos}   
      />
    </div>
  )
}