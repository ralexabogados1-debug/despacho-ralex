'use client'


export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo} from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTema } from '@/app/sistema/layout' 
import {
  queryDetalleCivilLocal,
  eliminarExpedienteLocal,
  limpiarExpedienteCacheTrasBorrarOnline,
  actualizarExpedienteCivilLocal,
  crearTareaLocal,
  toggleTareaLocal,
} from '@/lib/dbHelpers'
import { syncConSupabase } from '@/lib/sync'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T_DARK = {
  bg:           '#030712',
  surface:      '#0b0f19',
  surfaceHover: '#111827',
  border:       'rgba(255,255,255,0.06)',
  accent:       '#3b82f6', 
  accentLight:  '#60a5fa',
  accentAlpha:  'rgba(59,130,246,0.10)',
  green:        '#4ade80',
  greenAlpha:   'rgba(74,222,128,0.08)',
  amber:        '#fbbf24',
  amberAlpha:   'rgba(251,191,36,0.08)',
  red:          '#b3434f',
  redAlpha:     'rgba(179,67,79,0.10)',
  textPrimary:  'rgba(255,255,255,0.85)',
  textMuted:    'rgba(255,255,255,0.40)',
  textFaint:    'rgba(255,255,255,0.22)',
  textAccent:   '#93c5fd', 
}

const T_LIGHT = {
  bg:           '#f3f4f6',
  surface:      '#ffffff',
  surfaceHover: '#eff6ff',
  border:       'rgba(0,0,0,0.08)',
  accent:       '#2563eb', 
  accentLight:  '#3b82f6',
  accentAlpha:  'rgba(37,99,235,0.08)',
  green:        '#16a34a',
  greenAlpha:   'rgba(22,163,74,0.06)',
  amber:        '#d97706',
  amberAlpha:   'rgba(217,119,6,0.08)',
  red:          '#dc2626',
  redAlpha:     'rgba(220,38,38,0.06)',
  textPrimary:  'rgba(0,0,0,0.85)',
  textMuted:    'rgba(0,0,0,0.50)',
  textFaint:    'rgba(0,0,0,0.30)',
  textAccent:   '#1e40af',
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

import { useSearchParams } from 'next/navigation'

export default function DetalleExpedienteCivilPage() {
  const searchParams = useSearchParams()
  const rawId = searchParams.get('id')
  const expedienteId = Number(rawId)

  const { oscuro } = useTema()
  const T = oscuro ? T_DARK : T_LIGHT
  const router = useRouter()

  const [exp, setExp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [esOffline, setEsOffline] = useState(false)

  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const [editando, setEditando] = useState(false)
  const [camposEditados, setCamposEditados] = useState<any>({
    numero_expediente: '',
    fecha_inicio: '',
    descripcion: '',
    tipo_juicio: '',
    caracter_cliente: '',
    contraparte: '',
    ciudad: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const [mostrarModalTarea, setMostrarModalTarea] = useState(false)
  const [nuevaTareaDesc, setNuevaTareaDesc] = useState('')
  const [nuevaTareaFecha, setNuevaTareaFecha] = useState('')
  const [creandoTarea, setCreandoTarea] = useState(false)
  const [errorTarea, setErrorTarea] = useState<string | null>(null)

  useEffect(() => {
    if (!rawId || Number.isNaN(expedienteId)) {
      setError(true)
      setLoading(false)
      return
    }

    const cargarDesdeLocal = async () => {
      const local = await queryDetalleCivilLocal(expedienteId)
      if (!local) {
        setError(true)
        return false
      }
      setExp(local)
      setEsOffline(true)
      setError(false)
      return true
    }

    const fetchData = async () => {
      if (!navigator.onLine) {
        await cargarDesdeLocal()
        setLoading(false)
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: expRaw, error: fetchError } = await supabase
          .from('expedientes') 
          .select(`
            id, numero_expediente, tipo_juicio, caracter_cliente, contraparte, ciudad, estado, fecha_inicio, descripcion,
            clientes ( nombre_completo ),
            juzgados ( nombre, ciudad ),
            tareas ( id, descripcion, fecha_vencimiento, completada )
          `)
          .eq('id', expedienteId)
          .single()

        if (fetchError || !expRaw) {
          const cayoOffline = await cargarDesdeLocal()
          if (!cayoOffline) setError(true)
          return
        }

        setExp({
          id:                expRaw.id,
          numero_expediente: expRaw.numero_expediente,
          tipo_juicio:       expRaw.tipo_juicio,
          caracter_cliente:  expRaw.caracter_cliente,
          contraparte:       expRaw.contraparte,
          ciudad:            expRaw.ciudad,
          estado:            expRaw.estado,
          fecha_inicio:      expRaw.fecha_inicio,
          descripcion:       expRaw.descripcion,
          cliente: (expRaw.clientes as any)?.nombre_completo ?? null,
          juzgado: (expRaw.juzgados as any) ?? null,
          tareas: ((expRaw.tareas as any[]) ?? []).map((t: any) => ({
            id: t.id, descripcion: t.descripcion, fecha_vencimiento: t.fecha_vencimiento, completada: t.completada,
          })),
        })
        setEsOffline(false)
      } catch (e) {
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
  }, [expedienteId, rawId, router])

  async function manejarEliminar() {
    setErrorEliminar(null)
    setEliminando(true)
    try {
      if (navigator.onLine) {
        const { error: delError } = await supabase
          .from('expedientes')
          .delete()
          .eq('id', expedienteId)

        if (delError) throw delError

        await limpiarExpedienteCacheTrasBorrarOnline(expedienteId).catch(() => {})
      } else {
        await eliminarExpedienteLocal(expedienteId)
      }

      router.push('/sistema/expedientes/civil')
    } catch (e: any) {
      setErrorEliminar(e?.message ?? 'No se pudo eliminar el expediente civil.')
      setEliminando(false)
    }
  }

  const habilitarEdicion = () => {
    setCamposEditados({
      numero_expediente: exp.numero_expediente || '',
      fecha_inicio: exp.fecha_inicio || '',
      descripcion: exp.descripcion || '',
      tipo_juicio: exp.tipo_juicio || '',
      caracter_cliente: exp.caracter_cliente || '',
      contraparte: exp.contraparte || '',
      ciudad: exp.ciudad || '',
    })
    setErrorGuardar(null)
    setEditando(true)
  }

  async function manejarGuardar() {
    setErrorGuardar(null)
    setGuardando(true)
    try {
      if (navigator.onLine) {
        const { error: expError } = await supabase
          .from('expedientes')
          .update({
            numero_expediente: camposEditados.numero_expediente,
            fecha_inicio: camposEditados.fecha_inicio || null,
            descripcion: camposEditados.descripcion || null,
            tipo_juicio: camposEditados.tipo_juicio || null,
            caracter_cliente: camposEditados.caracter_cliente || null,
            contraparte: camposEditados.contraparte || null,
            ciudad: camposEditados.ciudad || null,
          })
          .eq('id', expedienteId)

        if (expError) throw expError
        await syncConSupabase().catch(() => {})
      } else {
        await actualizarExpedienteCivilLocal(expedienteId, {
          numero_expediente: camposEditados.numero_expediente,
          fecha_inicio: camposEditados.fecha_inicio || null,
          descripcion: camposEditados.descripcion || null,
          tipo_juicio: camposEditados.tipo_juicio || null,
          caracter_cliente: camposEditados.caracter_cliente || null,
          contraparte: camposEditados.contraparte || null,
          ciudad: camposEditados.ciudad || null,
        })
      }

      setExp((prev: any) => ({
        ...prev,
        numero_expediente: camposEditados.numero_expediente,
        fecha_inicio: camposEditados.fecha_inicio,
        descripcion: camposEditados.descripcion,
        tipo_juicio: camposEditados.tipo_juicio,
        caracter_cliente: camposEditados.caracter_cliente,
        contraparte: camposEditados.contraparte,
        ciudad: camposEditados.ciudad,
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
            expediente_id: expedienteId,
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
        const { tareaId } = await crearTareaLocal(expedienteId, nuevaTareaDesc.trim(), nuevaTareaFecha || null)
        nuevaTarea = {
          id: tareaId,
          descripcion: nuevaTareaDesc.trim(),
          fecha_vencimiento: nuevaTareaFecha || null,
          completada: false,
        }
      }

      setExp((prev: any) => ({
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

      setExp((prev: any) => ({
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

  if (error || !exp) {
    return (
      <div style={{ ...s.root, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ color: T.textPrimary }}>Expediente Civil no encontrado</h1>
        <p style={{ color: T.textMuted, fontSize: 14, marginBottom: 16 }}>ID recibido: "{rawId || 'ninguno'}"</p>
        <Link href="/sistema/expedientes/civil" style={s.breadcrumb}>
          Volver a Expedientes Civiles
        </Link>
      </div>
    )
  }

  const activo = exp.estado === 'Activo'
  const totalTareas = exp.tareas.length
  const completadas = exp.tareas.filter((t: any) => t.completada).length
  const progreso = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0

  return (
    <div style={s.root}>
      <style>{`
        .civ-detalle-grid { grid-template-columns: 1fr 360px; }
        @media (max-width: 900px) {
          .civ-detalle-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .civ-hero { flex-direction: column !important; align-items: stretch !important; }
          .civ-hero .civ-badge { align-self: flex-start; }
          .civ-actions { flex-direction: column-reverse !important; align-items: stretch !important; }
          .civ-actions-derecha { width: 100% !important; }
          .civ-actions-derecha button { flex: 1 1 auto; }
          .civ-btn-eliminar { width: 100% !important; justify-content: center !important; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
        <Link href="/sistema/expedientes/civil" style={s.breadcrumb}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Volver a Expedientes Civiles
        </Link>
        {esOffline && (
          <span style={s.offlineBadge}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.amber, flexShrink: 0 }} />
            Modo local (sin conexión)
          </span>
        )}
      </div>

      <div className="civ-hero" style={s.hero}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.eyebrow}>
            <span style={s.dot} />
            {editando ? 'Editando información' : (exp.tipo_juicio || 'Juicio Civil')}
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
            <h1 style={s.titulo}>{exp.numero_expediente}</h1>
          )}

          {!editando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <span style={{ fontSize: 13, color: T.textMuted }}>{exp.cliente || 'Sin cliente'}</span>
              </div>
            </div>
          )}
        </div>
        <div className="civ-badge" style={{
          ...s.badge,
          background: activo ? T.greenAlpha : T.amberAlpha,
          borderColor: activo ? `${T.green}40` : `${T.amber}40`,
          color: activo ? T.green : T.amber,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: activo ? T.green : T.amber, flexShrink: 0 }} />
          {exp.estado}
        </div>
      </div>

      <div className="civ-detalle-grid" style={s.contentGrid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Seccion titulo="Información General" icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          } T={T}>
            {editando ? (
              <div style={s.grid2}>
                <Dato label="Cliente (Solo Lectura)" valor={exp.cliente} T={T} />

                <div>
                  <label style={s.labelInput}>Carácter</label>
                  <input
                    type="text"
                    style={s.input}
                    value={camposEditados.caracter_cliente}
                    onChange={e => setCamposEditados({ ...camposEditados, caracter_cliente: e.target.value })}
                    disabled={guardando}
                  />
                </div>

                <div>
                  <label style={s.labelInput}>Contraparte</label>
                  <input
                    type="text"
                    style={s.input}
                    value={camposEditados.contraparte}
                    onChange={e => setCamposEditados({ ...camposEditados, contraparte: e.target.value })}
                    disabled={guardando}
                  />
                </div>

                <div>
                  <label style={s.labelInput}>Fecha de Inicio</label>
                  <input
                    type="date"
                    style={s.input}
                    value={camposEditados.fecha_inicio}
                    onChange={e => setCamposEditados({ ...camposEditados, fecha_inicio: e.target.value })}
                    disabled={guardando}
                  />
                </div>

                <div>
                  <label style={s.labelInput}>Ciudad</label>
                  <input
                    type="text"
                    style={s.input}
                    value={camposEditados.ciudad}
                    onChange={e => setCamposEditados({ ...camposEditados, ciudad: e.target.value })}
                    disabled={guardando}
                  />
                </div>

                <div>
                  <label style={s.labelInput}>Vía Procesal</label>
                  <input
                    type="text"
                    style={s.input}
                    value={camposEditados.tipo_juicio}
                    onChange={e => setCamposEditados({ ...camposEditados, tipo_juicio: e.target.value })}
                    disabled={guardando}
                  />
                </div>
              </div>
            ) : (
              <div style={s.grid2}>
                <Dato label="Cliente" valor={exp.cliente} T={T} />
                <Dato label="Carácter" valor={exp.caracter_cliente} T={T} />
                <Dato label="Contraparte" valor={exp.contraparte} T={T} />
                <Dato label="Fecha de Inicio" valor={exp.fecha_inicio} T={T} />
                <Dato label="Ciudad" valor={exp.ciudad} T={T} />
                <Dato label="Vía Procesal" valor={exp.tipo_juicio} T={T} />
              </div>
            )}
          </Seccion>

          <Seccion titulo="Ubicación Judicial" icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M3 6l9-3 9 3M6 12l-3 6h6l-3-6zm12 0l-3 6h6l-3-6z"/>
            </svg>
          } T={T}>
            <div style={s.grid2}>
              <Dato label="Juzgado" valor={exp.juzgado ? `${exp.juzgado.nombre} (${exp.juzgado.ciudad})` : null} T={T} />
            </div>
          </Seccion>

          {(exp.descripcion || editando) && (
            <Seccion titulo="Descripción / Resumen" icono={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            } T={T}>
              {editando ? (
                <div>
                  <label style={s.labelInput}>Descripción / Resumen</label>
                  <textarea
                    style={{ ...s.input, minHeight: 90, resize: 'vertical' as const }}
                    value={camposEditados.descripcion}
                    onChange={e => setCamposEditados({ ...camposEditados, descripcion: e.target.value })}
                    disabled={guardando}
                    placeholder="Escribe notas adicionales sobre el expediente..."
                  />
                </div>
              ) : (
                <p style={{ color: T.textMuted, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                  {exp.descripcion}
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
          } T={T}>
            {totalTareas === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ color: T.textFaint, fontSize: 13, margin: 0 }}>Sin tareas pendientes.</p>
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
                  {exp.tareas.map((t: any) => {
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

      <div className="civ-actions" style={s.actions}>
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
            <button className="civ-btn-eliminar" style={s.btnPeligro} onClick={() => setConfirmarEliminar(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/>
              </svg>
              Eliminar
            </button>

            <div className="civ-actions-derecha" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <button style={s.btnSecundario} onClick={habilitarEdicion}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar Expediente
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
            <h3 style={s.modalConfirmTitulo}>¿Eliminar este expediente?</h3>
            <p style={s.modalConfirmTexto}>
              Esta acción eliminará permanentemente el expediente <strong>{exp.numero_expediente}</strong> junto con sus tareas asociadas. No se puede deshacer.
            </p>
            {!navigator.onLine && (
              <p style={{ color: T.amber, fontSize: 12.5, marginTop: 8, marginBottom: 0 }}>
                Sin conexión: se eliminará del dispositivo y se sincronizará con el servidor cuando vuelva la red.
              </p>
            )}
            {errorEliminar && <p style={{ color: T.red, fontSize: 12.5, marginTop: 8, marginBottom: 0 }}>{errorEliminar}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button style={s.btnSecundario} onClick={() => setConfirmarEliminar(false)} disabled={eliminando}>Cancelar</button>
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
              Añade una nueva tarea o término de vencimiento asociado a este expediente civil.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={s.labelInput}>Descripción de la tarea</label>
                <input
                  type="text"
                  required
                  style={s.input}
                  placeholder="Ej. Presentar escrito de contestación"
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

            {errorTarea && <p style={{ color: T.red, fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>{errorTarea}</p>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button type="button" style={s.btnSecundario} onClick={() => setMostrarModalTarea(false)} disabled={creandoTarea}>
                Cancelar
              </button>
              <button type="submit" style={s.btnPrimario} disabled={creandoTarea}>
                {creandoTarea ? 'Creando...' : 'Crear Tarea'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── SUBCOMPONENTES ──────────────────────────────────────────────────────────
function Seccion({ titulo, icono, T, children }: { titulo: string; icono: React.ReactNode; T: typeof T_DARK; children: React.ReactNode }) {
  return (
    <div style={{
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 12,
      padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{ color: T.accent, display: 'flex', alignItems: 'center' }}>{icono}</span>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, margin: 0 }}>{titulo}</h2>
      </div>
      <div>{children}</div>
    </div>
  )
}

function Dato({ label, valor, T }: { label: string; valor?: string | null; T: typeof T_DARK }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.textFaint, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: valor ? T.textPrimary : T.textFaint }}>{valor || '—'}</div>
    </div>
  )
}

// ─── ESTILOS ───────────────────────────────────────────────────────────────
function getStyles(T: typeof T_DARK, oscuro: boolean) {
  return {
    root: {
      width: '100%',
      maxWidth: 1100,
      margin: '0 auto',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 24,
    },
    breadcrumb: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      color: T.textAccent,
      textDecoration: 'none',
      fontWeight: 500,
    },
    offlineBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11.5,
      color: T.amber,
      background: oscuro ? 'rgba(251,191,36,0.08)' : 'rgba(217,119,6,0.08)',
      border: `0.5px solid ${T.amber}40`,
      borderRadius: 20,
      padding: '5px 12px',
    },
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
    },
    eyebrow: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 11.5,
      color: T.accent,
      textTransform: 'uppercase' as const,
      marginBottom: 8,
    },
    dot: { width: 6, height: 6, borderRadius: '50%', background: T.accent },
    titulo: { fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 700, color: T.textPrimary, margin: 0 },
    badge: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '8px 16px', borderRadius: 40, border: '0.5px solid', flexShrink: 0 },
    contentGrid: { display: 'grid', gap: 20 },
    grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18 },
    progresoBar: { position: 'relative' as const, height: 8, background: oscuro ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
    progresoFill: (pct: number) => ({ position: 'absolute' as const, left: 0, top: 0, height: '100%', width: `${pct}%`, background: T.accent, borderRadius: 4, transition: 'width 0.4s ease' }),
    progresoLabel: { fontSize: 11.5, color: T.textFaint },
    tareaCard: (completada: boolean, vencida: boolean) => ({
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10,
      background: completada ? (oscuro ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : vencida ? T.redAlpha : T.surfaceHover,
      border: `0.5px solid ${T.border}`,
    }),
    tareaCheck: (completada: boolean) => ({ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${completada ? T.green : T.border}`, background: completada ? T.greenAlpha : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: T.green, marginTop: 1 }),
    actions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const, marginTop: 8 },
    btnPrimario: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 20px', background: T.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const },
    btnSecundario: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 20px', background: 'transparent', color: T.textMuted, border: `0.5px solid ${T.border}`, borderRadius: 8, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap' as const },
    btnPeligro: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 20px', background: T.redAlpha, color: T.red, border: `0.5px solid ${T.red}40`, borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const },
    btnPeligroSolido: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 20px', background: T.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const },
    overlay: { position: 'fixed' as const, inset: 0, background: oscuro ? 'rgba(6,10,18,0.8)' : 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', zIndex: 300 },
    modalConfirm: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: '24px', width: '100%', maxWidth: 380, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' },
    modalConfirmIcon: { width: 44, height: 44, borderRadius: '50%', background: T.redAlpha, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    modalConfirmTitulo: { fontSize: 16, fontWeight: 700, color: T.textPrimary, margin: '0 0 8px' },
    modalConfirmTexto: { fontSize: 13.5, color: T.textMuted, lineHeight: 1.6, margin: 0 },
    input: { width: '100%', padding: '10px 14px', background: T.surfaceHover, border: `1px solid ${T.border}`, borderRadius: 8, color: T.textPrimary, fontSize: 13.5, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
    labelInput: { display: 'block', fontSize: 11, fontWeight: 600, color: T.textFaint, letterSpacing: '0.04em', textTransform: 'uppercase' as const, marginBottom: 6 },
  }
}