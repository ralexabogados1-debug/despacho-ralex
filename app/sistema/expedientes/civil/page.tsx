'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { leerSesionLocal } from '@/lib/authLocal'
import { queryExpedientesCivilesLocal, queryCatalogosLocal } from '@/lib/dbHelpers'
import ClienteCivilFamiliar from './cliente'

// IDs de materias Civil/Familiar (mismo mapeo usado en crearExpedienteCivilLocal, dbHelpers.ts)
const MATERIA_IDS_CIVIL_FAMILIAR = [1, 2]

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 Helper: getUser con timeout — nunca lanza error (igual que dashboard/amparo)
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
async function cargarCivilesLocales() {
  const [expedientesLocales, catalogos] = await Promise.all([
    queryExpedientesCivilesLocal().catch(() => [] as any[]),
    queryCatalogosLocal().catch(() => ({ juzgados: [] as any[], materias: [] as any[] })),
  ])

  const juzgados = (catalogos.juzgados ?? []).filter((j: any) =>
    MATERIA_IDS_CIVIL_FAMILIAR.includes(j.materia_id)
  )
  const materias = (catalogos.materias ?? []).filter((m: any) =>
    MATERIA_IDS_CIVIL_FAMILIAR.includes(m.id)
  )

  return { expedientesLocales, juzgados, materias }
}

export default function CivilPage() {
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

  useEffect(() => {
    const cargar = async () => {
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

      // 🔧 Si el navegador ya sabe que no hay conexión, ni intentamos el
      // fetch a Supabase — evita el error de red innecesario y el ruido en
      // consola (Failed to fetch / ERR_INTERNET_DISCONNECTED) cuando está
      // completamente offline.
      const user = navigator.onLine
        ? await getUserConTimeout(supabase)
        : null

      if (!user) {
        if (!cacheValido) {
          router.push('/login')
          return
        }
        await usarDatosLocales()
        return
      }

      try {
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
          id: exp.id,
          numero_expediente: exp.numero_expediente,
          estado: exp.estado,
          caracter_cliente: exp.caracter_cliente,
          contraparte: exp.contraparte,
          tipo_juicio: exp.tipo_juicio,
          ciudad: exp.ciudad,
          fecha_inicio: exp.fecha_inicio,
          descripcion: exp.descripcion,
          materia_id: exp.materia_id,
          clientes: exp.clientes ? { nombre_completo: exp.clientes.nombre_completo } : null,
          juzgados: exp.juzgados ? { nombre: exp.juzgados.nombre, ciudad: exp.juzgados.ciudad } : null,
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
        setLoading(false)

      } catch (e) {
        console.error('Civil error:', e)
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
      />
    </div>
  )
}