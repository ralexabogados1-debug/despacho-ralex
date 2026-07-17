'use client'

import { useArranque } from '@/hooks/useArranque'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { leerSesionLocal } from '@/lib/authLocal'
import {
  queryTareasLocal,
  queryExpedientesCatalogoLocal,
  queryAbogadosLocal,
  obtenerUsuarioLocalPorEmail,
} from '@/lib/dbHelpers'
import TableroTareasCliente from './cliente'

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 Helper: getUser con timeout — nunca lanza error (mismo patrón que
// Civil/Amparo/Penal)
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
async function cargarTareasLocales() {
  const [tareasLocales, expedientesLocales, abogadosLocales] = await Promise.all([
    queryTareasLocal().catch(() => [] as any[]),
    queryExpedientesCatalogoLocal().catch(() => [] as any[]),
    queryAbogadosLocal().catch(() => [] as any[]),
  ])
  return { tareasLocales, expedientesLocales, abogadosLocales }
}

export default function TareasPage() {
    const arranqueListo = useArranque()
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [tareas, setTareas] = useState<any[]>([])
  const [expedientes, setExpedientes] = useState<any[]>([])
  const [abogados, setAbogados] = useState<any[]>([])
  const [usuarioActualId, setUsuarioActualId] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [esOffline, setEsOffline] = useState(false)

  useEffect(() => {
    if (!arranqueListo) return
    const cargar = async () => {
      const sesionLocal = leerSesionLocal()
      const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()

      const usarDatosLocales = async () => {
        try {
          const local = await cargarTareasLocales()
          setTareas(local.tareasLocales)
          setExpedientes(local.expedientesLocales)
          setAbogados(local.abogadosLocales)

          // Resolver el id numérico (Postgres) del usuario actual por email,
          // igual que hace crearExpedienteCivilLocal vía obtenerUsuarioLocalPorEmail.
          if (sesionLocal?.email) {
            const usuarioLocal = await obtenerUsuarioLocalPorEmail(sesionLocal.email)
            setUsuarioActualId(usuarioLocal?.id ?? 0)
          }
        } catch (e) {
          console.error('SQLite error (tareas):', e)
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
        const { data: usuarioActual, error: errUsuario } = await supabase
          .from('usuarios')
          .select('id, nombre_completo')
          .eq('auth_id', user.id)
          .single()
        if (errUsuario) console.error('🔴 Error cargando usuario actual:', errUsuario)

        const { data: expedientesRaw, error: errExpedientes } = await supabase
          .from('expedientes')
          .select('id, numero_expediente, materias ( nombre )')
        if (errExpedientes) console.error('🔴 Error cargando expedientes (catálogo):', errExpedientes)

        const { data: abogadosData, error: errAbogados } = await supabase
          .from('usuarios')
          .select('id, nombre_completo')
          .eq('rol', 'Abogado')
          .eq('activo', true)
        if (errAbogados) console.error('🔴 Error cargando abogados:', errAbogados)

        const { data: tareasRaw, error: errTareas } = await supabase
          .from('tareas')
          .select(`
            id, descripcion, fecha_vencimiento, completada, estado_kanban, asignado_a_usuario_id,
            usuarios ( nombre_completo ),
            expedientes (
              numero_expediente,
              materias ( nombre )
            )
          `)
          .order('fecha_vencimiento', { ascending: true })
        if (errTareas) console.error('🔴 Error cargando tareas:', errTareas)

        // Normalizar para evitar referencias circulares en el RSC payload
        // (mismo motivo que ya tenías en el page.tsx original)
        const tareasNormalizadas = (tareasRaw ?? []).map((t: any) => ({
          id:                    t.id,
          descripcion:           t.descripcion,
          fecha_vencimiento:     t.fecha_vencimiento,
          completada:            t.completada,
          estado_kanban:         t.estado_kanban,
          asignado_a_usuario_id: t.asignado_a_usuario_id,
          usuarios:    t.usuarios    ? { nombre_completo: t.usuarios.nombre_completo } : null,
          expedientes: t.expedientes ? {
            numero_expediente: t.expedientes.numero_expediente,
            materias: t.expedientes.materias ? { nombre: t.expedientes.materias.nombre } : null,
          } : null,
        }))

        const expedientesNormalizados = (expedientesRaw ?? []).map((e: any) => ({
          id:                e.id,
          numero_expediente: e.numero_expediente,
          materias: e.materias ? { nombre: e.materias.nombre } : null,
        }))

        setTareas(tareasNormalizadas)
        setExpedientes(expedientesNormalizados)
        setAbogados(abogadosData ?? [])
        setUsuarioActualId(usuarioActual?.id ?? 0)
        setLoading(false)

      } catch (e) {
        console.error('Tareas error:', e)
        if (cacheValido) {
          await usarDatosLocales()
        } else {
          router.push('/login')
        }
      }
    }

    cargar()
  }, [supabase, router, arranqueListo])

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #3a5fb8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: 'clamp(20px, 5vw, 40px) clamp(20px, 5vw, 40px)', maxWidth: 1400 }}>
      {esOffline && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(58,95,184,0.08)', border: '0.5px solid rgba(58,95,184,0.25)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 15 }}>📡</span>
          <span style={{ fontSize: 13, color: '#3a5fb8' }}>
            Modo sin conexión — mostrando datos guardados localmente. Los cambios se sincronizarán al recuperar internet.
          </span>
        </div>
      )}
      <TableroTareasCliente
        tareasInit={tareas}
        expedientes={expedientes}
        abogados={abogados}
        usuarioActualId={usuarioActualId}
      />
    </div>
  )
}