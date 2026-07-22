'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useExpedientes } from '@/hooks/useExpedientes'
import { useTema } from '@/app/sistema/layout' // Ajusta la ruta si es necesario
import {
  crearExpedienteAmparoLocal,
  obtenerUsuarioLocalPorEmail,
  eliminarExpedienteLocal,
  limpiarExpedienteCacheTrasBorrarOnline,
  queryColaboradoresLocal,
  agregarColaboradorLocal,
  eliminarColaboradorLocal,
} from '@/lib/dbHelpers'
import { leerSesionLocal } from '@/lib/authLocal'
import { createClient } from '@/lib/supabase/client'
import BannerOffline from '@/components/BannerOffline'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS OSCUROS (Amparo - dorado)
// ─────────────────────────────────────────────────────────────────────────────
const T_DARK = {
  surface:     '#0b1220',
  surfaceLow:  '#0f1828',
  border:      'rgba(255,255,255,0.05)',
  gold:        '#d4af37',
  goldAlpha:   'rgba(212,175,55,0.10)',
  green:       '#4ade80',
  greenAlpha:  'rgba(74,222,128,0.08)',
  red:         '#b3434f',
  redAlpha:    'rgba(179,67,79,0.10)',
  amber:       '#fbbf24',
  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted:   'rgba(255,255,255,0.40)',
  textFaint:   'rgba(255,255,255,0.22)',
  textAccent:  '#d4af37',
  bg:          '#070b14',
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS CLAROS (Amparo - dorado adaptado)
// ─────────────────────────────────────────────────────────────────────────────
const T_LIGHT = {
  surface:     '#ffffff',
  surfaceLow:  '#f9fafb',
  border:      'rgba(0,0,0,0.08)',
  gold:        '#b8860b',
  goldAlpha:   'rgba(184,134,11,0.08)',
  green:       '#16a34a',
  greenAlpha:  'rgba(22,163,74,0.06)',
  red:         '#dc2626',
  redAlpha:    'rgba(220,38,38,0.06)',
  amber:       '#d97706',
  textPrimary: 'rgba(0,0,0,0.85)',
  textMuted:   'rgba(0,0,0,0.50)',
  textFaint:   'rgba(0,0,0,0.30)',
  textAccent:  '#b8860b',
  bg:          '#f5f7fa',
}

type Juzgado = { id: number; nombre: string; ciudad: string }
type Abogado  = { id: number; nombre_completo: string }

export default function ClienteAmparos({
  juzgados,
  abogados,
  amparos,
  onCreado,
}: {
  juzgados: Juzgado[]
  abogados: Abogado[]
  amparos:  any[]
  onCreado?: () => Promise<void> | void
}) {
  const { oscuro } = useTema()
  const T = oscuro ? T_DARK : T_LIGHT

  // 🔄 Mismo patrón de fallback offline que Civil/Penal: si hay conexión se usa
  // el dato del servidor (prop), si no, el cache local.
  const {
    expedientes: amparosLocales,
    isOnline,
    syncing,
    sincronizar,
    recargar,
  } = useExpedientes('expedientes_amparo')

  const amparosActivos = (isOnline ? amparos : amparosLocales) ?? []

  const [abierto,    setAbierto]    = useState(false)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroTab,  setFiltroTab]  = useState<'todos' | 'tramite' | 'termino' | 'resueltos'>('todos')
  const [mensaje,    setMensaje]    = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [guardando,  setGuardando]  = useState(false)

  const [abogadoActual, setAbogadoActual] = useState<{ id: number; nombre_completo: string } | null>(null)

  const [colaboradoresForm, setColaboradoresForm] = useState<number[]>([])

  const [detalleAbierto,   setDetalleAbierto]   = useState<any | null>(null)
  const [eliminarObjetivo, setEliminarObjetivo] = useState<any | null>(null)
  const [eliminando,       setEliminando]       = useState(false)

  const [colaboradoresDetalle, setColaboradoresDetalle] = useState<any[]>([])
  const [nuevoColaboradorId,   setNuevoColaboradorId]   = useState<string>('')
  const [guardandoColaborador, setGuardandoColaborador] = useState(false)

  useEffect(() => {
    (async () => {
      const sesion = leerSesionLocal()
      if (!sesion) return
      const usuarioLocal = await obtenerUsuarioLocalPorEmail(sesion.email)
      if (usuarioLocal) {
        setAbogadoActual({ id: usuarioLocal.id, nombre_completo: usuarioLocal.nombre_completo })
      }
    })()
  }, [])

  useEffect(() => {
    if (!detalleAbierto) {
      setColaboradoresDetalle([])
      setNuevoColaboradorId('')
      return
    }
    (async () => {
      const lista = await queryColaboradoresLocal(detalleAbierto.id)
      setColaboradoresDetalle(lista)
    })()
  }, [detalleAbierto])

  const hoy = new Date().toISOString().split('T')[0]

  const proxTermo = (tareas: any[]) =>
    tareas
      ?.filter(t => !t.completada && t.fecha_vencimiento)
      .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
      [0]?.fecha_vencimiento ?? null

  const activo = (estado: string) => estado === 'Activo' || estado === 'En trámite'

  const filtrados = amparosActivos.filter(amp => {
    const da   = amp.expedientes_amparo?.[0] ?? amp.expedientes_amparo ?? {}
    const term = busqueda.toLowerCase()
    const ok   =
      amp.numero_expediente?.toLowerCase().includes(term) ||
      amp.clientes?.nombre_completo?.toLowerCase().includes(term) ||
      da.autoridad_responsable?.toLowerCase().includes(term) ||
      da.acto_reclamado?.toLowerCase().includes(term)
    if (!ok) return false
    const pt = proxTermo(amp.tareas)
    if (filtroTab === 'tramite')   return activo(amp.estado)
    if (filtroTab === 'resueltos') return amp.estado === 'Resuelto' || amp.estado === 'Concluido'
    if (filtroTab === 'termino')   return activo(amp.estado) && pt !== null && pt >= hoy
    return true
  })

  const cnt = {
    todos:     amparosActivos.length,
    tramite:   amparosActivos.filter(a => activo(a.estado)).length,
    resueltos: amparosActivos.filter(a => a.estado === 'Resuelto' || a.estado === 'Concluido').length,
    termino:   amparosActivos.filter(a => activo(a.estado) && proxTermo(a.tareas) !== null).length,
  }

  function alternarColaboradorForm(id: number) {
    setColaboradoresForm(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function manejarSubmit(formData: FormData) {
    setError(null)
    setGuardando(true)
    try {
      const sesion = leerSesionLocal()
      const usuarioLocal = sesion ? await obtenerUsuarioLocalPorEmail(sesion.email) : null

      if (!usuarioLocal) {
        setError('No se pudo identificar al usuario en sesión. Vuelve a iniciar sesión.')
        setGuardando(false)
        return
      }

      const { expedienteId } = await crearExpedienteAmparoLocal(
        {
          cliente_nombre: formData.get('quejoso_nombre') as string,
          numero_expediente: formData.get('numero_expediente') as string,
          fecha_presentacion: (formData.get('fecha_presentacion') as string) || null,
          estado: 'Activo',
          juzgado_id: Number(formData.get('juzgado_id')) || null,
          tipo_amparo: formData.get('tipo_amparo') as string,
          autoridad_responsable: (formData.get('autoridad_responsable') as string) || null,
          acto_reclamado: (formData.get('acto_reclamado') as string) || null,
          tercero_interesado: (formData.get('tercero_interesado') as string) || null,
          estadio_procesal: (formData.get('estadio_procesal') as string) || null,
          proxima_audiencia: (formData.get('proxima_audiencia') as string) || null,
          abogado_id: usuarioLocal.id,
          descripcion: null,
        },
        usuarioLocal.id
      )

      for (const colabId of colaboradoresForm) {
        if (colabId === usuarioLocal.id) continue
        await agregarColaboradorLocal(expedienteId, colabId, false)
      }

      // 🔄 Mismo patrón de sync que Civil/Penal
      if (isOnline) await sincronizar()
      else await recargar()

      await onCreado?.()

      setMensaje('Juicio de amparo registrado de manera exitosa.')
      setAbierto(false)
      setColaboradoresForm([])
      setTimeout(() => setMensaje(null), 3000)
    } catch (e) {
      console.error(e)
      setError('Error al guardar el amparo: ' + String(e))
    } finally {
      setGuardando(false)
    }
  }

  async function manejarAgregarColaboradorDetalle() {
    if (!detalleAbierto || !nuevoColaboradorId) return
    setGuardandoColaborador(true)
    setError(null)
    try {
      await agregarColaboradorLocal(detalleAbierto.id, Number(nuevoColaboradorId), false)

      const lista = await queryColaboradoresLocal(detalleAbierto.id)
      setColaboradoresDetalle(lista)
      setNuevoColaboradorId('')

      if (isOnline) await sincronizar()
      else await recargar()

      await onCreado?.()
    } catch (e) {
      console.error(e)
      setError('Error al agregar colaborador: ' + String(e))
    } finally {
      setGuardandoColaborador(false)
    }
  }

  async function manejarQuitarColaboradorDetalle(usuarioId: number) {
    if (!detalleAbierto) return
    setGuardandoColaborador(true)
    setError(null)
    try {
      await eliminarColaboradorLocal(detalleAbierto.id, usuarioId)

      const lista = await queryColaboradoresLocal(detalleAbierto.id)
      setColaboradoresDetalle(lista)

      if (isOnline) await sincronizar()
      else await recargar()

      await onCreado?.()
    } catch (e) {
      console.error(e)
      setError('Error al quitar colaborador: ' + String(e))
    } finally {
      setGuardandoColaborador(false)
    }
  }

  async function manejarEliminar(exp: any) {
  setEliminando(true)
  setError(null)
  try {
    if (isOnline) {
      // ✅ Si el ID es negativo, el expediente nunca llegó a Supabase
      // (se creó offline y no sincronizó). Solo hay que borrarlo local.
      if (exp.id < 0) {
        await eliminarExpedienteLocal(exp.id)
        await recargar()
      } else {
        const supabase = createClient()
        const { error: errSupabase } = await supabase
          .from('expedientes')
          .delete()
          .eq('id', exp.id)

        if (errSupabase) throw errSupabase

        await limpiarExpedienteCacheTrasBorrarOnline(exp.id)
        await sincronizar()
      }
    } else {
      await eliminarExpedienteLocal(exp.id)
      await recargar()
    }

    setEliminarObjetivo(null)
    setDetalleAbierto(null)
    setMensaje('Expediente eliminado correctamente.')
    setTimeout(() => setMensaje(null), 3000)
  } catch (e) {
    console.error(e)
    setError('Error al eliminar el expediente: ' + String(e))
  } finally {
    setEliminando(false)
  }
}

  const s = getStyles(T, oscuro)

  const abogadosDisponiblesDetalle = abogados.filter(
    a => !colaboradoresDetalle.some(c => c.usuario_id === a.id)
  )

  return (
    <div style={s.root}>
      <style>{`
        .amp-header   { flex-direction: row; }
        .amp-btn-new  { width: auto; }
        .amp-filtros  { flex-direction: row; }
        .amp-row-form { flex-wrap: wrap; }
        .amp-col-form { flex: 1 1 220px; }
        .amp-busqueda-wrapper { flex: 1 1 200px; width: auto; }

        @media (max-width: 700px) {
          .amp-header   { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .amp-btn-new  { width: 100% !important; justify-content: center !important; }
          .amp-filtros  { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .amp-busqueda-wrapper { width: 100% !important; flex: none !important; }
          .amp-tabs     { width: 100% !important; justify-content: flex-start !important; }
          .amp-tabs button { flex: 1 1 auto; text-align: center; justify-content: center; }
          .amp-col-form { flex: 1 1 100% !important; }
          
          .amp-desktop { display: none !important; }
          .amp-mobile  { display: flex !important; }
        }

        @media (min-width: 701px) {
          .amp-mobile  { display: none !important; }
        }

        .amp-tr:hover { background: ${oscuro ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}; }
        .amp-row-link:hover { background: ${oscuro ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}; }
      `}</style>

      <BannerOffline esOffline={!isOnline} />

      {/* ── ENCABEZADO ── */}
      <div className="amp-header" style={s.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={s.titulo}>Expedientes de Amparo</h1>
          <p style={s.subtitulo}>
            <span style={s.dot} />
            Gestión de juicios de amparo
            &nbsp;·&nbsp;
            <strong style={{ color: T.textPrimary }}>{cnt.todos}</strong> registrados
            &nbsp;·&nbsp;
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: isOnline ? T.green : T.amber
            }}>
              <span style={{
                width: 5, height: 5,
                borderRadius: '50%',
                background: isOnline ? T.green : T.amber,
                display: 'inline-block'
              }}/>
              {syncing ? 'Sincronizando...' : isOnline ? 'En línea' : 'Sin conexión'}
            </span>
          </p>
        </div>
        <button onClick={() => setAbierto(true)} className="amp-btn-new" style={s.btnPrimario}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo Amparo
        </button>
      </div>

      {/* Alerta éxito */}
      {mensaje && <Alerta tipo="ok" oscuro={oscuro}>{mensaje}</Alerta>}

      {/* ── FILTROS ── */}
      <div className="amp-filtros" style={s.filtrosRow}>
        <div className="amp-busqueda-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <svg style={s.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por expediente, quejoso..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={s.searchInput}
          />
        </div>

        <div className="amp-tabs" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, flexShrink: 0 }}>
          {([
            ['todos',     `Todos (${cnt.todos})`],
            ['tramite',   `En trámite (${cnt.tramite})`],
            ['termino',   `Con término (${cnt.termino})`],
            ['resueltos', `Resueltos (${cnt.resueltos})`],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFiltroTab(key)} style={s.tab(filtroTab === key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENIDO ── */}
      <div style={s.tabla}>
        {filtrados.length === 0 ? (
          <div style={s.vacio}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: T.textFaint }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            No se encontraron amparos
          </div>
        ) : (
          <>
            <div className="amp-desktop" style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['No. Expediente','Quejoso','Autoridad Responsable','Acto Reclamado','Juzgado Fed.','Estadio Procesal','Próx. Término','Acciones'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(amp => {
                    const da  = amp.expedientes_amparo?.[0] ?? amp.expedientes_amparo ?? {}
                    const pt  = proxTermo(amp.tareas)
                    const esH = pt === hoy
                    const venc = pt && pt < hoy
                    const act  = activo(amp.estado)
                    return (
                      <tr key={amp.id} className="amp-tr">
                        <td style={s.td}>
                          <Link href={`/sistema/expedientes/amparo/detalle?id=${amp.id}`} style={{ fontWeight: 600, color: T.textPrimary, fontSize: 13, textDecoration: 'none' }}>
                            {amp.numero_expediente}
                          </Link>
                          <div style={s.sub}>{da.tipo_amparo || 'Amparo Indirecto'}</div>
                        </td>
                        <td style={{ ...s.td, color: T.textPrimary, fontSize: 13 }}>{amp.clientes?.nombre_completo ?? '—'}</td>
                        <td style={{ ...s.td, color: T.textMuted,   fontSize: 13 }}>{da.autoridad_responsable ?? '—'}</td>
                        <td style={{ ...s.td, color: T.textMuted,   fontSize: 13 }}>{da.acto_reclamado ?? '—'}</td>
                        <td style={s.td}>
                          <span style={{ color: T.textMuted, fontSize: 13 }}>{amp.juzgados?.nombre ?? '—'}</span>
                          <div style={s.sub}>{amp.juzgados?.ciudad || 'Hidalgo'}</div>
                        </td>
                        <td style={{ ...s.td, color: T.textMuted, fontSize: 13 }}>{da.estadio_procesal ?? '—'}</td>
                        <td style={s.td}>
                          {!act ? (
                            <span style={{ ...s.pill, background: T.goldAlpha, color: T.gold, border: `1px solid ${T.gold}44` }}>Resuelto</span>
                          ) : pt ? (
                            <span style={{ fontWeight: esH || venc ? 600 : 400, color: venc ? T.red : esH ? T.amber : T.textMuted, fontSize: 13 }}>
                              {venc ? '⚠ ' : esH ? '● ' : ''}{pt}
                            </span>
                          ) : (
                            <span style={{ color: T.textFaint, fontSize: 13 }}>—</span>
                          )}
                        </td>
                        <td style={s.td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setDetalleAbierto(amp)}
                              style={s.btnIcono(T)}
                              title="Ver más"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setEliminarObjetivo(amp)}
                              style={{ ...s.btnIcono(T), color: T.red, borderColor: `${T.red}44` }}
                              title="Eliminar"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="amp-mobile" style={{ display: 'none', flexDirection: 'column' as const }}>
              {filtrados.map(amp => {
                const da   = amp.expedientes_amparo?.[0] ?? amp.expedientes_amparo ?? {}
                const pt   = proxTermo(amp.tareas)
                const esH   = pt === hoy
                const venc = pt && pt < hoy
                const act  = activo(amp.estado)
                return (
                  <Link key={amp.id} href={`/sistema/expedientes/amparo/detalle?id=${amp.id}`} className="amp-row-link" style={s.rowLink}>
                    <div style={s.avatar}>
                      <span style={{ fontSize: 16, color: T.gold, fontWeight: 'bold' }}>AI</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={s.rowTitulo}>{amp.numero_expediente || '—'}</span>
                        {!act ? (
                          <span style={{ fontSize: 11, color: T.gold, flexShrink: 0 }}>Resuelto</span>
                        ) : pt ? (
                          <span style={{ fontSize: 11, color: venc ? T.red : esH ? T.amber : T.textFaint, flexShrink: 0 }}>{esH ? 'Hoy' : pt}</span>
                        ) : <span style={{ fontSize: 11, color: T.textFaint }}>—</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.textMuted }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: act ? T.green : T.gold, flexShrink: 0 }} />
                        {da.tipo_amparo || 'Indirecto'}
                        {da.estadio_procesal && <span style={{ color: T.textFaint }}>· {da.estadio_procesal}</span>}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: T.textFaint, flexShrink: 0 }}>
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL — Nuevo Amparo ── */}
      {abierto && (
        <div style={s.overlay} onClick={() => setAbierto(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Nuevo Expediente de Amparo</h2>
                <p style={s.modalSub}>Complete el formulario para registrar un nuevo juicio</p>
              </div>
              <button onClick={() => setAbierto(false)} style={s.btnCerrar} aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {(error || !isOnline) && (
              <div style={{ padding: '0 24px' }}>
                {error && <Alerta tipo="error" oscuro={oscuro}>{error}</Alerta>}
                {!isOnline && (
                  <Alerta tipo="ok" oscuro={oscuro}>
                    📡 Sin conexión — el amparo se guardará localmente y se sincronizará cuando recuperes internet.
                  </Alerta>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); manejarSubmit(new FormData(e.currentTarget)) }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
            >
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
                <Seccion titulo="Información del Amparo" icono="📋" T={T} oscuro={oscuro}>
                  <div className="amp-row-form" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                    <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Número de Expediente *" T={T}>
                        <input name="numero_expediente" required style={s.input} placeholder="EJ: 427-2025" />
                      </Campo>
                    </div>
                    <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Fecha de Presentación" T={T}>
                        <input name="fecha_presentacion" type="date" style={s.input} />
                      </Campo>
                    </div>
                    <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Quejoso *" T={T}>
                        <input name="quejoso_nombre" required style={s.input} placeholder="Nombre" />
                      </Campo>
                    </div>
                    <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Tipo de Amparo *" T={T}>
                        <select name="tipo_amparo" required style={s.input} defaultValue="Indirecto">
                          <option>Directo</option>
                          <option>Indirecto</option>
                        </select>
                      </Campo>
                    </div>
                    <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Autoridad Responsable" T={T}>
                        <input name="autoridad_responsable" style={s.input} placeholder="Ej: Jueces de Control Hidalgo" />
                      </Campo>
                    </div>
                    <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Acto Reclamado" T={T}>
                        <input name="acto_reclamado" style={s.input} placeholder="Descripción breve" />
                      </Campo>
                    </div>
                    <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Tercero Interesado" T={T}>
                        <input name="tercero_interesado" style={s.input} placeholder="Si aplica" />
                      </Campo>
                    </div>
                    <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Estadio Procesal" T={T}>
                        <input name="estadio_procesal" style={s.input} placeholder="Ej: Suspensión Provisional" />
                      </Campo>
                    </div>
                    <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Próxima Audiencia" T={T}>
                        <input name="proxima_audiencia" type="date" style={s.input} />
                      </Campo>
                    </div>
                    <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Abogado responsable" T={T}>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={abogadoActual?.nombre_completo ?? 'Cargando sesión...'}
                          style={{ ...s.input, opacity: 0.75, cursor: 'not-allowed' }}
                        />
                      </Campo>
                    </div>
                  </div>
                </Seccion>

                <Seccion titulo="Colaboradores" icono="👥" T={T} oscuro={oscuro}>
                  <p style={{ fontSize: 11.5, color: T.textMuted, margin: '0 0 10px' }}>
                    {abogadoActual?.nombre_completo ?? 'Tú'} queda como responsable automáticamente.
                    Marca a quién más debe tener acceso a este expediente.
                  </p>
                  {abogados.filter(a => a.id !== abogadoActual?.id).length === 0 ? (
                    <p style={{ fontSize: 12, color: T.textFaint }}>No hay otros abogados registrados.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                      {abogados.filter(a => a.id !== abogadoActual?.id).map(ab => (
                        <label
                          key={ab.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.textPrimary, cursor: 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            checked={colaboradoresForm.includes(ab.id)}
                            onChange={() => alternarColaboradorForm(ab.id)}
                          />
                          {ab.nombre_completo}
                        </label>
                      ))}
                    </div>
                  )}
                </Seccion>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: `1px solid ${T.border}` }}>
                <button type="button" onClick={() => setAbierto(false)} style={s.btnSec}>Cancelar</button>
                <button type="submit" disabled={guardando} style={s.btnPrimario}>
                  {guardando ? 'Guardando...' : 'Crear Amparo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL — Ver más (detalle completo) ── */}
      {detalleAbierto && (
        <div style={s.overlay} onClick={() => setDetalleAbierto(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>{detalleAbierto.numero_expediente}</h2>
                <p style={s.modalSub}>Detalle completo del expediente</p>
              </div>
              <button onClick={() => setDetalleAbierto(null)} style={s.btnCerrar} aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {error && <Alerta tipo="error" oscuro={oscuro}>{error}</Alerta>}

              {(() => {
                const da = detalleAbierto.expedientes_amparo?.[0] ?? detalleAbierto.expedientes_amparo ?? {}
                return (
                  <>
                    <Seccion titulo="Datos generales" icono="📋" T={T} oscuro={oscuro}>
                      <DetalleFila label="Quejoso" valor={detalleAbierto.clientes?.nombre_completo} T={T} />
                      <DetalleFila label="Estado" valor={detalleAbierto.estado} T={T} />
                      <DetalleFila label="Tipo de Amparo" valor={da.tipo_amparo} T={T} />
                      <DetalleFila label="Fecha de Presentación" valor={detalleAbierto.fecha_inicio} T={T} />
                    </Seccion>
                    <Seccion titulo="Autoridad y acto reclamado" icono="⚖️" T={T} oscuro={oscuro}>
                      <DetalleFila label="Autoridad Responsable" valor={da.autoridad_responsable} T={T} />
                      <DetalleFila label="Acto Reclamado" valor={da.acto_reclamado} T={T} />
                      <DetalleFila label="Tercero Interesado" valor={da.tercero_interesado} T={T} />
                    </Seccion>
                    <Seccion titulo="Juzgado y trámite" icono="🏛️" T={T} oscuro={oscuro}>
                      <DetalleFila label="Juzgado Federal" valor={detalleAbierto.juzgados?.nombre} T={T} />
                      <DetalleFila label="Ciudad" valor={detalleAbierto.juzgados?.ciudad} T={T} />
                      <DetalleFila label="Estadio Procesal" valor={da.estadio_procesal} T={T} />
                      <DetalleFila label="Próxima Audiencia" valor={da.proxima_audiencia} T={T} />
                    </Seccion>

                    {/* Colaboradores */}
                    <Seccion titulo="Colaboradores" icono="👥" T={T} oscuro={oscuro}>
                      {colaboradoresDetalle.length === 0 ? (
                        <p style={{ fontSize: 12, color: T.textFaint, margin: 0 }}>Sin colaboradores registrados.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 12 }}>
                          {colaboradoresDetalle.map(c => (
                            <div
                              key={c.usuario_id}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '6px 10px', borderRadius: 6,
                                background: T.surface, border: `1px solid ${T.border}`,
                              }}
                            >
                              <span style={{ fontSize: 13, color: T.textPrimary }}>
                                {c.nombre_completo}
                                {c.es_responsable && (
                                  <span style={{ marginLeft: 6, fontSize: 10.5, color: T.gold }}>· Responsable</span>
                                )}
                              </span>
                              <button
                                onClick={() => manejarQuitarColaboradorDetalle(c.usuario_id)}
                                disabled={guardandoColaborador}
                                style={{ ...s.btnIcono(T), color: T.red, borderColor: `${T.red}44`, width: 22, height: 22 }}
                                title="Quitar colaborador"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {abogadosDisponiblesDetalle.length > 0 && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select
                            value={nuevoColaboradorId}
                            onChange={e => setNuevoColaboradorId(e.target.value)}
                            style={{ ...s.input, flex: 1 }}
                          >
                            <option value="">Agregar colaborador...</option>
                            {abogadosDisponiblesDetalle.map(a => (
                              <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                            ))}
                          </select>
                          <button
                            onClick={manejarAgregarColaboradorDetalle}
                            disabled={!nuevoColaboradorId || guardandoColaborador}
                            style={{ ...s.btnSec, whiteSpace: 'nowrap' as const }}
                          >
                            {guardandoColaborador ? 'Agregando...' : 'Agregar'}
                          </button>
                        </div>
                      )}
                    </Seccion>
                  </>
                )
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '16px 24px', borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={() => setEliminarObjetivo(detalleAbierto)}
                style={{ ...s.btnSec, color: T.red, borderColor: `${T.red}55` }}
              >
                Eliminar expediente
              </button>
              <button onClick={() => setDetalleAbierto(null)} style={s.btnPrimario}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL — Confirmar eliminación ── */}
      {eliminarObjetivo && (
        <div style={{ ...s.overlay, zIndex: 300 }} onClick={() => !eliminando && setEliminarObjetivo(null)}>
          <div style={{ ...s.modal, maxWidth: 420, maxHeight: 'none' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h2 style={s.modalTitle}>¿Eliminar expediente?</h2>
              <p style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>
                Vas a eliminar el expediente{' '}
                <strong style={{ color: T.textPrimary }}>{eliminarObjetivo.numero_expediente}</strong>.
                Esta acción no se puede deshacer.
              </p>
              {!isOnline && eliminarObjetivo?.id > 0 && (
  <div style={{ marginTop: 12 }}>
    <Alerta tipo="error" oscuro={oscuro}>
      Necesitas conexión a internet para eliminar este expediente.
    </Alerta>
  </div>
)}
              {error && (
                <div style={{ marginTop: 12 }}>
                  <Alerta tipo="error" oscuro={oscuro}>{error}</Alerta>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 24px 24px' }}>
              <button onClick={() => setEliminarObjetivo(null)} disabled={eliminando} style={s.btnSec}>
                Cancelar
              </button>
              <button
  onClick={() => manejarEliminar(eliminarObjetivo)}
  disabled={(!isOnline && eliminarObjetivo?.id > 0) || eliminando}
  style={{
    ...s.btnPrimario,
    background: T.red,
    opacity: ((!isOnline && eliminarObjetivo?.id > 0) || eliminando) ? 0.5 : 1,
  }}
>
  {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function Alerta({ tipo, oscuro, children }: { tipo: 'ok' | 'error'; oscuro: boolean; children: React.ReactNode }) {
  const ok = tipo === 'ok'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      color:      ok ? '#16a34a' : '#dc2626',
      background: ok ? (oscuro ? 'rgba(74,222,128,0.08)' : 'rgba(22,163,74,0.06)') : (oscuro ? 'rgba(179,67,79,0.10)' : 'rgba(220,38,38,0.06)'),
      border:     `1px solid ${ok ? (oscuro ? 'rgba(74,222,128,0.15)' : 'rgba(22,163,74,0.15)') : (oscuro ? 'rgba(179,67,79,0.20)' : 'rgba(220,38,38,0.15)')}`,
      padding: '8px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 500, marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function Seccion({ titulo, icono, T, oscuro, children }: { titulo: string; icono: string; T: typeof T_DARK; oscuro: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: '16px',
      background: T.surfaceLow,
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11.5, fontWeight: 600,
        color: T.textMuted,
        marginBottom: 14,
      }}>
        <span>{icono}</span>{titulo}
      </div>
      {children}
    </div>
  )
}

function Campo({ label, T, children }: { label: string; T: typeof T_DARK; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>{label}</label>
      {children}
    </div>
  )
}

function DetalleFila({ label, valor, T }: { label: string; valor: any; T: typeof T_DARK }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, textAlign: 'right' }}>{valor || '—'}</span>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────
// Función generadora de estilos dinámica
// ─────────────────────────────────────────────────────────────────────────────
const getStyles = (T: typeof T_DARK, oscuro: boolean) => ({
  root: {
    width: '100%',
    padding: '16px 12px',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 12,
    marginBottom: 16,
  } as React.CSSProperties,
  titulo: {
    fontSize: 'clamp(18px, 5vw, 24px)',
    fontWeight: 700,
    color: T.textPrimary,
    margin: 0,
    letterSpacing: '-0.3px',
  } as React.CSSProperties,
  subtitulo: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: T.textMuted,
    margin: 0,
  } as React.CSSProperties,
  dot: {
    display: 'inline-block' as const,
    width: 6, height: 6,
    borderRadius: '50%',
    background: T.gold,
    flexShrink: 0,
  } as React.CSSProperties,
  btnPrimario: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 16px',
    background: T.gold,
    color: oscuro ? '#0f1828' : '#ffffff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  btnSec: {
    padding: '8px 16px',
    background: 'transparent',
    color: T.textMuted,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
  } as React.CSSProperties,
  btnCerrar: {
    width: 28, height: 28,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    background: T.surfaceLow,
    color: T.textMuted,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  } as React.CSSProperties,
  btnIcono: (T: typeof T_DARK) => ({
    width: 26, height: 26,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    background: T.surfaceLow,
    color: T.textMuted,
    cursor: 'pointer',
    flexShrink: 0,
  }) as React.CSSProperties,
  filtrosRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 14,
  } as React.CSSProperties,
  searchIcon: {
    position: 'absolute' as const,
    left: 10,
    color: T.textMuted,
    pointerEvents: 'none' as const,
  } as React.CSSProperties,
  searchInput: {
    width: '100%',
    padding: '8px 10px 8px 30px',
    background: T.surfaceLow,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    color: T.textPrimary,
    fontSize: 13,
    outline: 'none',
  } as React.CSSProperties,
  tab: (activo: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    background: activo ? T.goldAlpha : 'transparent',
    color:      activo ? T.gold : T.textMuted,
    border:     `1px solid ${activo ? `${T.gold}66` : T.border}`,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: activo ? 600 : 400,
    whiteSpace: 'nowrap' as const,
  }),
  tabla: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  } as React.CSSProperties,
  vacio: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 6,
    padding: '32px 16px',
    color: T.textFaint,
    fontSize: 13,
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    minWidth: 780,
  } as React.CSSProperties,
  th: {
    padding: '8px 14px',
    fontSize: 10.5,
    fontWeight: 600,
    color: T.textMuted,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    textAlign: 'left' as const,
    background: T.surfaceLow,
    borderBottom: `1px solid ${T.border}`,
  } as React.CSSProperties,
  td: {
    padding: '10px 14px',
    borderBottom: `1px solid ${T.border}`,
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,
  sub: { fontSize: 11, color: T.textFaint, marginTop: 2 } as React.CSSProperties,
  pill: { fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20 } as React.CSSProperties,
  rowLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderBottom: `1px solid ${T.border}`,
    textDecoration: 'none',
    color: 'inherit',
  } as React.CSSProperties,
  avatar: {
    width: 32, height: 32,
    borderRadius: '50%',
    background: T.goldAlpha,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  rowTitulo: {
    fontSize: 13.5,
    fontWeight: 600,
    color: T.textPrimary,
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
    zIndex: 200,
  } as React.CSSProperties,
  modal: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
  } as React.CSSProperties,
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: '24px 24px 0',
    flexShrink: 0,
  } as React.CSSProperties,
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: T.textPrimary,
    margin: 0,
  } as React.CSSProperties,
  modalSub: {
    fontSize: 12,
    color: T.textMuted,
    margin: 0,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '10px 12px',
    background: T.surfaceLow,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    color: T.textPrimary,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
})