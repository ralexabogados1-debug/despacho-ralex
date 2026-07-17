'use client'


export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTema } from '@/app/sistema/layout'
import {
  queryDetallePenalLocal,
  eliminarExpedienteLocal,
  limpiarExpedienteCacheTrasBorrarOnline,
  actualizarExpedientePenalLocal,
  crearTareaLocal,
  toggleTareaLocal,
} from '@/lib/dbHelpers'
import { syncConSupabase } from '@/lib/sync'

const T_DARK = {
  bg:          '#070b14',
  surface:     '#0b1220',
  surfaceHover:'#0f1828',
  border:      'rgba(255,255,255,0.06)',
  accent:      '#b3434f',
  accentLight: '#d45f6a',
  accentAlpha: 'rgba(179,67,79,0.10)',
  green:       '#4ade80',
  greenAlpha:  'rgba(74,222,128,0.08)',
  amber:       '#fbbf24',
  amberAlpha:  'rgba(251,191,36,0.08)',
  red:         '#b3434f',
  redAlpha:    'rgba(179,67,79,0.10)',
  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted:   'rgba(255,255,255,0.40)',
  textFaint:   'rgba(255,255,255,0.22)',
  textAccent:  '#8fa8e0',
}

const T_LIGHT = {
  bg:          '#f5f7fa',
  surface:     '#ffffff',
  surfaceHover:'#f9fafb',
  border:      'rgba(0,0,0,0.08)',
  accent:      '#b91c1c',
  accentLight: '#dc2626',
  accentAlpha: 'rgba(185,28,28,0.08)',
  green:       '#16a34a',
  greenAlpha:  'rgba(22,163,74,0.06)',
  amber:       '#d97706',
  amberAlpha:  'rgba(217,119,6,0.08)',
  red:         '#dc2626',
  redAlpha:    'rgba(220,38,38,0.06)',
  textPrimary: 'rgba(0,0,0,0.85)',
  textMuted:   'rgba(0,0,0,0.50)',
  textFaint:   'rgba(0,0,0,0.30)',
  textAccent:  '#1e3a8a',
}

export default function DetalleCausaPenalPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const params = use(searchParams)
  const id = params.id
  const causaId = Number(id)

  const { oscuro } = useTema()
  const T = oscuro ? T_DARK : T_LIGHT

  const router = useRouter()

  // FIX 2: el cliente de supabase se creaba en cada render, lo que provocaba
  // que el useEffect de abajo se re-disparara constantemente (su dependencia
  // "supabase" nunca era === a la anterior). Con useMemo se crea una sola vez.
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [causa, setCausa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [esOffline, setEsOffline] = useState(false)

  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const [editando, setEditando] = useState(false)
  const [camposEditados, setCamposEditados] = useState<any>({
    numero_expediente: '',
    caracter_cliente: '',
    contraparte: '',
    fecha_inicio: '',
    descripcion: '',
    numero_carpeta_investigacion: '',
    delito: '',
    estadio_procesal: '',
    rol_abogado: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const [mostrarModalTarea, setMostrarModalTarea] = useState(false)
  const [nuevaTareaDesc, setNuevaTareaDesc] = useState('')
  const [nuevaTareaFecha, setNuevaTareaFecha] = useState('')
  const [creandoTarea, setCreandoTarea] = useState(false)
  const [errorTarea, setErrorTarea] = useState<string | null>(null)
console.log('🚀 Render del componente')
  useEffect(() => {
     console.log('🚀 useEffect ejecutado')
    if (!id || Number.isNaN(causaId)) {
      setError(true)
      setLoading(false) // FIX 1: sin esto el spinner se quedaba pegado para siempre
      return
    }

    const cargarDesdeLocal = async () => {
      const local = await queryDetallePenalLocal(causaId)
      if (!local) {
        setError(true)
        return false
      }
      setCausa(local)
      setEsOffline(true)
      setError(false)
      return true
    }

    const fetchData = async () => {
  console.log('🔵 fetchData iniciado, causaId:', causaId, 'online:', navigator.onLine)

  if (!navigator.onLine) {
    await cargarDesdeLocal()
    setLoading(false)
    return
  }

        try {
    const { data: { user } } = await supabase.auth.getUser()
    console.log('🔵 usuario obtenido:', user?.id, user?.email)

    if (!user) {
      console.log('🔴 no hay usuario, redirigiendo a login')
      router.push('/login')
      return
    }

        const { data: causaRaw, error: fetchError } = await supabase
      .from('expedientes')
          .select(`
            id, numero_expediente, caracter_cliente, contraparte, estado, fecha_inicio, descripcion,
            clientes ( nombre_completo ),
            jueces ( nombre ),
            juzgados ( nombre, ciudad ),
            tareas ( id, descripcion, fecha_vencimiento, completada ),
            expedientes_penales (
              numero_carpeta_investigacion, delito, estadio_procesal, rol_abogado,
              ministerios_publicos ( nombre_agencia )
            )
          `)
          .eq('id', causaId)
      .single()

        console.log('🔵 respuesta de expedientes:', { causaRaw, fetchError })

    if (fetchError || !causaRaw) {
      console.log('🔴 cayendo a offline por fetchError o causaRaw vacío')
      const cayoOffline = await cargarDesdeLocal()
      if (!cayoOffline) setError(true)
      return
    }
        const penalRaw = Array.isArray(causaRaw.expedientes_penales)
          ? causaRaw.expedientes_penales[0]
          : causaRaw.expedientes_penales

        setCausa({
          id:                causaRaw.id,
          numero_expediente: causaRaw.numero_expediente,
          caracter_cliente:  causaRaw.caracter_cliente,
          contraparte:       causaRaw.contraparte,
          estado:            causaRaw.estado,
          fecha_inicio:      causaRaw.fecha_inicio,
          descripcion:       causaRaw.descripcion,
          cliente: (causaRaw.clientes as any)?.nombre_completo ?? null,
          juez:   (causaRaw.jueces as any)?.nombre ?? null,
          juzgado:(causaRaw.juzgados as any) ?? null,
          tareas: ((causaRaw.tareas as any[]) ?? []).map((t: any) => ({
            id: t.id, descripcion: t.descripcion, fecha_vencimiento: t.fecha_vencimiento, completada: t.completada,
          })),
          penal: penalRaw ? {
            numero_carpeta_investigacion: penalRaw.numero_carpeta_investigacion,
            delito:           penalRaw.delito,
            estadio_procesal: penalRaw.estadio_procesal,
            rol_abogado:      penalRaw.rol_abogado,
            mp: (penalRaw.ministerios_publicos as any)?.nombre_agencia ?? null,
          } : null,
        })
        setEsOffline(false)
      } catch (e) {
    console.log('🔴 CATCH capturó:', e)
    const cayoOffline = await cargarDesdeLocal()
    if (!cayoOffline) setError(true)
  } finally {
    setLoading(false)
  }
}

    fetchData()

    const alVolverConexion = () => {
      syncConSupabase().finally(fetchData)
    }
    window.addEventListener('online', alVolverConexion)
    return () => window.removeEventListener('online', alVolverConexion)
  }, [causaId, id, router, supabase])

  async function manejarEliminar() {
    setErrorEliminar(null)
    setEliminando(true)
    try {
      if (navigator.onLine) {
        const { error: delError } = await supabase
          .from('expedientes')
          .delete()
          .eq('id', causaId)

        if (delError) throw delError
        await limpiarExpedienteCacheTrasBorrarOnline(causaId).catch(() => {})
      } else {
        await eliminarExpedienteLocal(causaId)
      }

      router.push('/sistema/expedientes/penal')
    } catch (e: any) {
      setErrorEliminar(e?.message ?? 'No se pudo eliminar la causa. Intenta de nuevo.')
      setEliminando(false)
    }
  }

  const habilitarEdicion = () => {
    setCamposEditados({
      numero_expediente: causa.numero_expediente || '',
      caracter_cliente: causa.caracter_cliente || '',
      contraparte: causa.contraparte || '',
      fecha_inicio: causa.fecha_inicio || '',
      descripcion: causa.descripcion || '',
      numero_carpeta_investigacion: causa.penal?.numero_carpeta_investigacion || '',
      delito: causa.penal?.delito || '',
      estadio_procesal: causa.penal?.estadio_procesal || '',
      rol_abogado: causa.penal?.rol_abogado || '',
    })
    setErrorGuardar(null)
    setEditando(true)
  }

  async function manejarGuardar() {
    setErrorGuardar(null)
    setGuardando(true)
    try {
      if (navigator.onLine) {
        const { error: causaError } = await supabase
          .from('expedientes')
          .update({
            numero_expediente: camposEditados.numero_expediente,
            caracter_cliente: camposEditados.caracter_cliente || null,
            contraparte: camposEditados.contraparte || null,
            fecha_inicio: camposEditados.fecha_inicio || null,
            descripcion: camposEditados.descripcion || null,
          })
          .eq('id', causaId)

        if (causaError) throw causaError

        const { error: penalError } = await supabase
          .from('expedientes_penales')
          .update({
            numero_carpeta_investigacion: camposEditados.numero_carpeta_investigacion || null,
            delito: camposEditados.delito || null,
            estadio_procesal: camposEditados.estadio_procesal || null,
            rol_abogado: camposEditados.rol_abogado || null,
          })
          .eq('expediente_id', causaId)

        if (penalError) throw penalError

        await syncConSupabase().catch(() => {})
      } else {
        await actualizarExpedientePenalLocal(
          causaId,
          {
            numero_expediente: camposEditados.numero_expediente,
            caracter_cliente: camposEditados.caracter_cliente || null,
            contraparte: camposEditados.contraparte || null,
            fecha_inicio: camposEditados.fecha_inicio || null,
            descripcion: camposEditados.descripcion || null,
          },
          {
            numero_carpeta_investigacion: camposEditados.numero_carpeta_investigacion || null,
            delito: camposEditados.delito || null,
            estadio_procesal: camposEditados.estadio_procesal || null,
            rol_abogado: camposEditados.rol_abogado || null,
          }
        )
      }

      setCausa((prev: any) => ({
        ...prev,
        numero_expediente: camposEditados.numero_expediente,
        caracter_cliente: camposEditados.caracter_cliente,
        contraparte: camposEditados.contraparte,
        fecha_inicio: camposEditados.fecha_inicio,
        descripcion: camposEditados.descripcion,
        penal: {
          ...prev.penal,
          numero_carpeta_investigacion: camposEditados.numero_carpeta_investigacion,
          delito: camposEditados.delito,
          estadio_procesal: camposEditados.estadio_procesal,
          rol_abogado: camposEditados.rol_abogado,
        }
      }))

      setEditando(false)
    } catch (e: any) {
      setErrorGuardar(e?.message ?? 'No se pudieron guardar los cambios. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function manejarAgregarTarea(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevaTareaDesc.trim()) return

    setErrorTarea(null)
    setCreandoTarea(true)

    try {
      let nuevaTarea: any

      if (navigator.onLine) {
        const { data, error: insError } = await supabase
          .from('tareas')
          .insert({
            expediente_id: causaId,
            descripcion: nuevaTareaDesc.trim(),
            fecha_vencimiento: nuevaTareaFecha || null,
            completada: false,
          })
          .select()
          .single()

        if (insError) throw insError
        nuevaTarea = {
          id: data.id,
          descripcion: data.descripcion,
          fecha_vencimiento: data.fecha_vencimiento,
          completada: data.completada,
        }
      } else {
        const { tareaId } = await crearTareaLocal(causaId, nuevaTareaDesc.trim(), nuevaTareaFecha || null)
        nuevaTarea = {
          id: tareaId,
          descripcion: nuevaTareaDesc.trim(),
          fecha_vencimiento: nuevaTareaFecha || null,
          completada: false,
        }
      }

      setCausa((prev: any) => ({
        ...prev,
        tareas: [...(prev.tareas || []), nuevaTarea],
      }))

      setNuevaTareaDesc('')
      setNuevaTareaFecha('')
      setMostrarModalTarea(false)
    } catch (err: any) {
      setErrorTarea(err?.message ?? 'No se pudo crear la tarea. Intenta de nuevo.')
    } finally {
      setCreandoTarea(false)
    }
  }

  async function toggleTarea(tareaId: number, completadaActual: boolean) {
    try {
      if (navigator.onLine) {
        const { error: updError } = await supabase
          .from('tareas')
          .update({ completada: !completadaActual })
          .eq('id', tareaId)

        if (updError) throw updError
      } else {
        await toggleTareaLocal(tareaId, !completadaActual)
      }

      setCausa((prev: any) => ({
        ...prev,
        tareas: prev.tareas.map((t: any) =>
          t.id === tareaId ? { ...t, completada: !completadaActual } : t
        ),
      }))
    } catch (e: any) {
      alert('Error al actualizar la tarea: ' + (e?.message ?? 'Intenta de nuevo.'))
    }
  }

  const s = useMemo(() => getStyles(T, oscuro), [T, oscuro])

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error || !causa) {
    return (
      <div style={{ ...s.root, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ color: T.textPrimary }}>Causa no encontrada</h1>
        <Link href="/sistema/expedientes/penal" style={s.breadcrumb}>
          Volver a Causas Penales
        </Link>
      </div>
    )
  }

  const activo = causa.estado === 'Activo'
  const totalTareas = causa.tareas.length
  const completadas = causa.tareas.filter((t: any) => t.completada).length
  const progreso = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0

  return (
    <div style={s.root}>
      <style>{`
        .pen-detalle-grid { grid-template-columns: 1fr 360px; }
        @media (max-width: 900px) { .pen-detalle-grid { grid-template-columns: 1fr !important; } .pen-detalle-root { max-width: 100% !important; padding: 16px !important; } }
        @media (max-width: 640px) { .pen-hero { flex-direction: column !important; align-items: stretch !important; } .pen-hero .pen-badge { align-self: flex-start; } .pen-actions { flex-direction: column-reverse !important; align-items: stretch !important; } .pen-actions-derecha { width: 100% !important; } .pen-actions-derecha button { flex: 1 1 auto; } .pen-btn-eliminar { width: 100% !important; justify-content: center !important; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
        <Link href="/sistema/expedientes/penal" style={s.breadcrumb}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Volver a Causas Penales
        </Link>
        {esOffline && (
          <span style={s.offlineBadge}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.amber, flexShrink: 0 }} />
            Mostrando datos guardados sin conexión
          </span>
        )}
      </div>

      <div className="pen-hero" style={s.hero}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.eyebrow}>
            <span style={s.dot} />
            {editando ? 'Editando información' : (causa.penal?.delito || 'Sin delito especificado')}
          </div>

          {editando ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <label style={s.labelInput}>Número de Expediente</label>
              <input
                type="text"
                style={{ ...s.input, fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 700, maxWidth: 400 }}
                value={camposEditados.numero_expediente}
                onChange={e => setCamposEditados({ ...camposEditados, numero_expediente: e.target.value })}
                disabled={guardando}
              />
            </div>
          ) : (
            <h1 style={s.titulo}>{causa.numero_expediente}</h1>
          )}

          {!editando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <span style={{ fontSize: 13, color: T.textMuted }}>{causa.cliente || 'Sin cliente asignado'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                <span style={{ fontSize: 13, color: T.textMuted }}>{causa.fecha_inicio || '—'}</span>
              </div>
            </div>
          )}
        </div>
        <div className="pen-badge" style={{
          ...s.badge,
          background: activo ? T.greenAlpha : T.amberAlpha,
          borderColor: activo ? `${T.green}40` : `${T.amber}40`,
          color: activo ? T.green : T.amber,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: activo ? T.green : T.amber, flexShrink: 0 }} />
          {causa.estado}
        </div>
      </div>

      <div className="pen-detalle-grid" style={s.contentGrid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Seccion titulo="Información General" icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          } T={T} oscuro={oscuro}>
            {editando ? (
              <div style={s.grid2}>
                <Dato label="Cliente (Solo Lectura)" valor={causa.cliente} T={T} />

                <div>
                  <label style={s.labelInput}>Carácter del cliente</label>
                  <input
                    type="text"
                    style={s.input}
                    value={camposEditados.caracter_cliente}
                    onChange={e => setCamposEditados({ ...camposEditados, caracter_cliente: e.target.value })}
                    disabled={guardando}
                  />
                </div>

                <div>
                  <label style={s.labelInput}>Contraparte / Ofendido</label>
                  <input
                    type="text"
                    style={s.input}
                    value={camposEditados.contraparte}
                    onChange={e => setCamposEditados({ ...camposEditados, contraparte: e.target.value })}
                    disabled={guardando}
                  />
                </div>

                <div>
                  <label style={s.labelInput}>Fecha de inicio</label>
                  <input
                    type="date"
                    style={s.input}
                    value={camposEditados.fecha_inicio}
                    onChange={e => setCamposEditados({ ...camposEditados, fecha_inicio: e.target.value })}
                    disabled={guardando}
                  />
                </div>

                <div>
                  <label style={s.labelInput}>Rol del abogado</label>
                  <input
                    type="text"
                    style={s.input}
                    value={camposEditados.rol_abogado}
                    onChange={e => setCamposEditados({ ...camposEditados, rol_abogado: e.target.value })}
                    disabled={guardando}
                  />
                </div>

                <div>
                  <label style={s.labelInput}>Etapa procesal</label>
                  <input
                    type="text"
                    style={s.input}
                    value={camposEditados.estadio_procesal}
                    onChange={e => setCamposEditados({ ...camposEditados, estadio_procesal: e.target.value })}
                    disabled={guardando}
                  />
                </div>
              </div>
            ) : (
              <div style={s.grid2}>
                <Dato label="Cliente" valor={causa.cliente} T={T} />
                <Dato label="Carácter del cliente" valor={causa.caracter_cliente} T={T} />
                <Dato label="Contraparte / Ofendido" valor={causa.contraparte} T={T} />
                <Dato label="Fecha de inicio" valor={causa.fecha_inicio} T={T} />
                <Dato label="Rol del abogado" valor={causa.penal?.rol_abogado} T={T} />
                <Dato label="Etapa procesal" valor={causa.penal?.estadio_procesal} T={T} />
              </div>
            )}
          </Seccion>

          <Seccion titulo="Información Procesal" icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m14 13-8.5 8.5a2.121 2.121 0 1 1-3-3L11 10"/><path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>
            </svg>
          } T={T} oscuro={oscuro}>
            {editando ? (
              <div style={s.grid2}>
                <div>
                  <label style={s.labelInput}>N° Carpeta de Investigación</label>
                  <input
                    type="text"
                    style={s.input}
                    value={camposEditados.numero_carpeta_investigacion}
                    onChange={e => setCamposEditados({ ...camposEditados, numero_carpeta_investigacion: e.target.value })}
                    disabled={guardando}
                  />
                </div>

                <div>
                  <label style={s.labelInput}>Delito</label>
                  <input
                    type="text"
                    style={s.input}
                    value={camposEditados.delito}
                    onChange={e => setCamposEditados({ ...camposEditados, delito: e.target.value })}
                    disabled={guardando}
                  />
                </div>

                <Dato label="Juez asignado (Solo Lectura)" valor={causa.juez} T={T} />
                <Dato label="Ministerio Público (Solo Lectura)" valor={causa.penal?.mp} T={T} />
                <Dato label="Juzgado (Solo Lectura)" valor={causa.juzgado ? `${causa.juzgado.nombre} (${causa.juzgado.ciudad})` : null} T={T} />
              </div>
            ) : (
              <div style={s.grid2}>
                <Dato label="N° Carpeta de Investigación" valor={causa.penal?.numero_carpeta_investigacion} T={T} />
                <Dato label="Juez asignado" valor={causa.juez} T={T} />
                <Dato label="Ministerio Público" valor={causa.penal?.mp} T={T} />
                <Dato label="Juzgado" valor={causa.juzgado ? `${causa.juzgado.nombre} (${causa.juzgado.ciudad})` : null} T={T} />
              </div>
            )}
          </Seccion>

          {(causa.descripcion || editando) && (
            <Seccion titulo="Notas / Descripción" icono={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            } T={T} oscuro={oscuro}>
              {editando ? (
                <div>
                  <label style={s.labelInput}>Notas / Descripción</label>
                  <textarea
                    style={{ ...s.input, minHeight: 90, resize: 'vertical' as const }}
                    value={camposEditados.descripcion}
                    onChange={e => setCamposEditados({ ...camposEditados, descripcion: e.target.value })}
                    disabled={guardando}
                    placeholder="Escribe notas adicionales sobre la causa..."
                  />
                </div>
              ) : (
                <p style={{ color: T.textMuted, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                  {causa.descripcion}
                </p>
              )}
            </Seccion>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Seccion titulo="Tareas y Términos" icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="16" height="16" rx="2"/><path d="m9 12 2 2 4-4"/>
            </svg>
          } T={T} oscuro={oscuro}>
            {totalTareas === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ color: T.textFaint, fontSize: 13, margin: 0 }}>Sin tareas registradas para esta causa.</p>
                <button style={{ ...s.btnSecundario, padding: '6px 12px', fontSize: 12, width: 'fit-content' }} onClick={() => setMostrarModalTarea(true)}>
                  + Agregar primera tarea
                </button>
              </div>
            ) : (
              <>
                <div style={s.progresoBar}>
                  <div style={s.progresoFill(progreso)} />
                </div>
                <span style={s.progresoLabel}>{completadas}/{totalTareas} completadas</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {causa.tareas.map((t: any) => {
                    const vencida = !t.completada && t.fecha_vencimiento && t.fecha_vencimiento < new Date().toISOString().split('T')[0]
                    return (
                      <div key={t.id} style={s.tareaCard(t.completada, vencida)}>
                        <button
                          onClick={() => toggleTarea(t.id, t.completada)}
                          style={{
                            ...s.tareaCheck(t.completada),
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 0,
                            outline: 'none',
                          }}
                          title={t.completada ? 'Marcar como pendiente' : 'Marcar como completada'}
                        >
                          {t.completada && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5"/>
                            </svg>
                          )}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: 13.5,
                            color: t.completada ? T.textFaint : T.textPrimary,
                            textDecoration: t.completada ? 'line-through' : 'none',
                            wordBreak: 'break-word',
                          }}>
                            {t.descripcion}
                          </span>
                          {t.fecha_vencimiento && (
                            <div style={{ fontSize: 11.5, color: vencida ? T.red : T.textFaint, marginTop: 2 }}>
                              {vencida ? '⚠ Vencida: ' : 'Vence: '}{t.fecha_vencimiento}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Seccion>
        </div>
      </div>

      <div className="pen-actions" style={s.actions}>
        {editando ? (
          <>
            <button style={s.btnSecundario} onClick={() => setEditando(false)} disabled={guardando}>
              Cancelar
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
              {errorGuardar && <span style={{ color: T.red, fontSize: 12.5 }}>{errorGuardar}</span>}
              <button style={s.btnPrimario} onClick={manejarGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </>
        ) : (
          <>
            <button className="pen-btn-eliminar" style={s.btnPeligro} onClick={() => setConfirmarEliminar(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/>
              </svg>
              Eliminar
            </button>
            <div className="pen-actions-derecha" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <button style={s.btnSecundario} onClick={habilitarEdicion}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar Causa
              </button>
              <button style={s.btnPrimario} onClick={() => setMostrarModalTarea(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Agregar Tarea
              </button>
            </div>
          </>
        )}
      </div>

      {confirmarEliminar && (
        <div style={s.overlay} onClick={() => !eliminando && setConfirmarEliminar(false)}>
          <div style={s.modalConfirm} onClick={e => e.stopPropagation()}>
            <div style={s.modalConfirmIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
            </div>
            <h3 style={s.modalConfirmTitulo}>¿Eliminar esta causa?</h3>
            <p style={s.modalConfirmTexto}>
              Esta acción eliminará permanentemente la causa <strong>{causa.numero_expediente}</strong> junto con sus tareas asociadas. No se puede deshacer.
            </p>
            {!navigator.onLine && (
              <p style={{ color: T.amber, fontSize: 12.5, marginTop: 8, marginBottom: 0 }}>
                Sin conexión: se eliminará del dispositivo y se sincronizará con el servidor cuando vuelva la red.
              </p>
            )}
            {errorEliminar && (
              <p style={{ color: T.red, fontSize: 12.5, marginTop: 8, marginBottom: 0 }}>{errorEliminar}</p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button style={s.btnSecundario} onClick={() => setConfirmarEliminar(false)} disabled={eliminando}>
                Cancelar
              </button>
              <button style={s.btnPeligroSolido} onClick={manejarEliminar} disabled={eliminando}>
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalTarea && (
        <div style={s.overlay} onClick={() => !creandoTarea && setMostrarModalTarea(false)}>
          <form onSubmit={manejarAgregarTarea} style={s.modalConfirm} onClick={e => e.stopPropagation()}>
            <div style={{ ...s.modalConfirmIcon, background: T.accentAlpha }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <h3 style={s.modalConfirmTitulo}>Nueva Tarea / Término</h3>
            <p style={{ ...s.modalConfirmTexto, marginBottom: 16 }}>
              Añade una nueva tarea o término de vencimiento asociado a esta causa penal.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={s.labelInput}>Descripción de la tarea</label>
                <input
                  type="text"
                  required
                  style={s.input}
                  placeholder="Ej. Presentar escrito de apelación"
                  value={nuevaTareaDesc}
                  onChange={e => setNuevaTareaDesc(e.target.value)}
                  disabled={creandoTarea}
                  autoFocus
                />
              </div>

              <div>
                <label style={s.labelInput}>Fecha límite / Vencimiento (Opcional)</label>
                <input
                  type="date"
                  style={s.input}
                  value={nuevaTareaFecha}
                  onChange={e => setNuevaTareaFecha(e.target.value)}
                  disabled={creandoTarea}
                />
              </div>
            </div>

            {errorTarea && (
              <p style={{ color: T.red, fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>{errorTarea}</p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                type="button"
                style={s.btnSecundario}
                onClick={() => setMostrarModalTarea(false)}
                disabled={creandoTarea}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={s.btnPrimario}
                disabled={creandoTarea}
              >
                {creandoTarea ? 'Creando...' : 'Crear Tarea'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function Seccion({ titulo, icono, T, oscuro, children }: any) {
  return (
    <div style={{
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 12,
      padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{ color: T.accent, display: 'flex', alignItems: 'center' }}>{icono}</span>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, margin: 0, letterSpacing: '-0.1px' }}>{titulo}</h2>
      </div>
      <div style={{ padding: '0 4px' }}>
        {children}
      </div>
    </div>
  )
}

function Dato({ label, valor, T }: { label: string; valor?: string | null; T: typeof T_DARK }) {
  return (
    <div>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: T.textFaint,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: valor ? T.textPrimary : T.textFaint }}>
        {valor || '—'}
      </div>
    </div>
  )
}

function getStyles(T: typeof T_DARK, oscuro: boolean) {
  return {
    root: {
      width: '100%',
      maxWidth: 1100,
      margin: '0 auto',
      padding: 'clamp(20px, 4vw, 40px) clamp(20px, 5vw, 40px)',
      boxSizing: 'border-box' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 24,
    } as React.CSSProperties,
    breadcrumb: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      color: T.textAccent,
      textDecoration: 'none',
      fontWeight: 500,
      width: 'fit-content',
      transition: 'color 0.2s',
    } as React.CSSProperties,
    offlineBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11.5,
      fontWeight: 600,
      color: T.amber,
      background: oscuro ? 'rgba(251,191,36,0.08)' : 'rgba(217,119,6,0.08)',
      border: `0.5px solid ${T.amber}40`,
      borderRadius: 20,
      padding: '5px 12px',
    } as React.CSSProperties,
    hero: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
      flexWrap: 'wrap' as const,
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 14,
      padding: '24px',
    } as React.CSSProperties,
    eyebrow: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 11.5,
      fontWeight: 600,
      color: T.accent,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      marginBottom: 8,
    } as React.CSSProperties,
    dot: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: T.accent,
      flexShrink: 0,
    },
    titulo: {
      fontSize: 'clamp(24px, 5vw, 32px)',
      fontWeight: 700,
      color: T.textPrimary,
      margin: 0,
      letterSpacing: '-0.5px',
      lineHeight: 1.1,
    } as React.CSSProperties,
    badge: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12.5,
      fontWeight: 600,
      padding: '8px 16px',
      borderRadius: 40,
      border: '0.5px solid',
      flexShrink: 0,
    } as React.CSSProperties,
    contentGrid: {
      display: 'grid',
      gap: 20,
      alignItems: 'start',
    } as React.CSSProperties,
    grid2: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 18,
    } as React.CSSProperties,
    progresoBar: {
      position: 'relative' as const,
      height: 8,
      background: oscuro ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 4,
    } as React.CSSProperties,
    progresoFill: (pct: number) => ({
      position: 'absolute' as const,
      left: 0,
      top: 0,
      height: '100%',
      width: `${pct}%`,
      background: `linear-gradient(90deg, ${T.accent}, ${T.accentLight})`,
      borderRadius: 4,
      transition: 'width 0.4s ease',
    }),
    progresoLabel: {
      fontSize: 11.5,
      color: T.textFaint,
      fontWeight: 500,
    } as React.CSSProperties,
    tareaCard: (completada: boolean, vencida: boolean) => ({
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      padding: '12px 14px',
      background: completada ? (oscuro ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : vencida ? (oscuro ? 'rgba(179,67,79,0.06)' : 'rgba(220,38,38,0.06)') : T.surfaceHover,
      border: `0.5px solid ${vencida ? (oscuro ? 'rgba(179,67,79,0.25)' : 'rgba(220,38,38,0.25)') : T.border}`,
      borderRadius: 10,
      transition: 'background 0.2s',
    }),
    tareaCheck: (completada: boolean) => ({
      width: 22,
      height: 22,
      borderRadius: '50%',
      border: `1.5px solid ${completada ? T.green : T.border}`,
      background: completada ? T.greenAlpha : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color: T.green,
      marginTop: 1,
    }),
    actions: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap' as const,
      marginTop: 8,
    } as React.CSSProperties,
    btnPrimario: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '10px 20px',
      background: T.accent,
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontSize: 13.5,
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
      transition: 'background 0.2s, transform 0.1s',
    } as React.CSSProperties,
    btnSecundario: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '10px 20px',
      background: 'transparent',
      color: T.textMuted,
      border: `0.5px solid ${T.border}`,
      borderRadius: 8,
      fontSize: 13.5,
      fontWeight: 500,
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
      transition: 'background 0.2s',
    } as React.CSSProperties,
    btnPeligro: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '10px 20px',
      background: T.redAlpha,
      color: T.red,
      border: `0.5px solid ${T.red}40`,
      borderRadius: 8,
      fontSize: 13.5,
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
      transition: 'background 0.2s',
    } as React.CSSProperties,
    btnPeligroSolido: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '10px 20px',
      background: T.red,
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontSize: 13.5,
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      background: oscuro ? 'rgba(6,10,18,0.8)' : 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px',
      zIndex: 300,
    } as React.CSSProperties,
    modalConfirm: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: '24px',
      width: '100%',
      maxWidth: 380,
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
    } as React.CSSProperties,
    modalConfirmIcon: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: T.redAlpha,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    } as React.CSSProperties,
    modalConfirmTitulo: {
      fontSize: 16,
      fontWeight: 700,
      color: T.textPrimary,
      margin: '0 0 8px',
    } as React.CSSProperties,
    modalConfirmTexto: {
      fontSize: 13.5,
      color: T.textMuted,
      lineHeight: 1.6,
      margin: 0,
    } as React.CSSProperties,
    input: {
      width: '100%',
      padding: '10px 14px',
      background: T.surfaceHover,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      color: T.textPrimary,
      fontSize: 13.5,
      outline: 'none',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box' as const,
      fontFamily: 'inherit',
    } as React.CSSProperties,
    labelInput: {
      display: 'block',
      fontSize: 11,
      fontWeight: 600,
      color: T.textFaint,
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      marginBottom: 6,
    } as React.CSSProperties,
  }
}