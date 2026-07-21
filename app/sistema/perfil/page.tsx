'use client'

import { hayConexionReal } from '@/lib/checkconnection'
import { useArranque } from '@/hooks/useArranque'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { leerSesionLocal } from '@/lib/authLocal'
import { query, queryPerfilLocal, obtenerUsuarioLocalPorEmail } from '@/lib/dbHelpers'
import PerfilUsuarioCliente from './cliente'

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

export default function MiPerfilPage() {
  const arranqueListo = useArranque()
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,   // ✅ evita peticiones 401 innecesarias
        persistSession: true,
      }
    }
  )

  const [usuario, setUsuario]             = useState<any>(null)
  const [expedientes, setExpedientes]     = useState<any[]>([])
  const [conteoTareas, setConteoTareas]   = useState(0)
  const [conteoEventos, setConteoEventos] = useState(0)
  const [actividad, setActividad]         = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [esOffline, setEsOffline]         = useState(false)

  // ─── Función centralizada para cargar datos ────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoading(true)
    const sesionLocal = leerSesionLocal()
    const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()

    const usarDatosLocales = async (email: string) => {
      try {
        const perfilLocal = await obtenerUsuarioLocalPorEmail(email)
        if (!perfilLocal) { router.push('/login'); return }

        const [usuarioRow] = await query<any>('SELECT * FROM usuarios WHERE id = ?', [perfilLocal.id])
        const local = await queryPerfilLocal(perfilLocal.id)

        setUsuario(usuarioRow ?? null)
        setExpedientes(local.expedientes)
        setConteoTareas(local.conteoTareas)
        setConteoEventos(local.conteoEventos)
        setActividad([])
      } catch (e) {
        console.error('SQLite error (mi-perfil):', e)
      }
      setEsOffline(true)
      setLoading(false)
    }

    const conectado = await hayConexionReal()
    const user = conectado ? await getUserConTimeout(supabase) : null

    if (!user) {
      if (!cacheValido || !sesionLocal?.email) { router.push('/login'); return }
      await usarDatosLocales(sesionLocal.email)
      return
    }

    try {
      const { data: miPerfil, error: errPerfil } = await supabase
        .from('usuarios').select('*').eq('auth_id', user.id).single()
      if (errPerfil) console.error('🔴 Error cargando perfil:', errPerfil)
      if (!miPerfil) { router.push('/login'); return }

      const miId = miPerfil.id

      const { data: expedientesData, error: errExp } = await supabase
        .from('expediente_abogados')
        .select(`
          expedientes (
            id, numero_expediente, estado, contraparte,
            clientes ( nombre_completo ),
            materias ( nombre )
          )
        `)
        .eq('usuario_id', miId)
      if (errExp) console.error('🔴 Error cargando expedientes:', errExp)

      const expedientesNormalizados = (expedientesData ?? [])
        .map((row: any) => row.expedientes)
        .filter(Boolean)
        .map((exp: any) => ({
          id: exp.id,
          numero_expediente: exp.numero_expediente,
          estado_tramite: exp.estado,
          quejoso: exp.clientes?.nombre_completo ?? null,
          tipo_amparo: exp.materias?.nombre ?? null,
        }))

      const { count: conteoTareasData, error: errTareas } = await supabase
        .from('tareas').select('id', { count: 'exact', head: true })
        .eq('asignado_a_usuario_id', miId)
        .neq('estado_kanban', 'Completada')
      if (errTareas) console.error('🔴 Error cargando tareas:', errTareas)

      const { count: conteoEventosData, error: errEventos } = await supabase
        .from('eventos').select('id', { count: 'exact', head: true })
        .eq('usuario_id', miId)
      if (errEventos) console.error('🔴 Error cargando eventos:', errEventos)

      setUsuario(miPerfil)
      setExpedientes(expedientesNormalizados)
      setConteoTareas(conteoTareasData ?? 0)
      setConteoEventos(conteoEventosData ?? 0)
      setActividad([])
      setEsOffline(false)
      setLoading(false)
    } catch (e) {
      console.error('Mi Perfil error:', e)
      if (cacheValido && sesionLocal?.email) await usarDatosLocales(sesionLocal.email)
      else router.push('/login')
    }
  }, [supabase, router])

  useEffect(() => {
    if (!arranqueListo) return
    cargarDatos()
  }, [arranqueListo, cargarDatos])

  if (loading || !usuario) {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #4a7fd4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      {esOffline && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(74,127,212,0.08)', border: '0.5px solid rgba(74,127,212,0.25)',
          borderRadius: 10, padding: '10px 16px', margin: '16px clamp(16px,4vw,40px) 0',
        }}>
          <span style={{ fontSize: 15 }}>📡</span>
          <span style={{ fontSize: 13, color: '#4a7fd4' }}>
            Modo sin conexión — mostrando datos guardados localmente.
          </span>
        </div>
      )}
      <PerfilUsuarioCliente
        usuario={usuario}
        expedientes={expedientes}
        conteoTareas={conteoTareas}
        conteoEventos={conteoEventos}
        onPerfilActualizado={cargarDatos}   // ✅ El hijo podrá refrescar los datos
      />
    </div>
  )
}