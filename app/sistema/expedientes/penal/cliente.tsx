'use client'

import { useState } from 'react'
import { crearCausaPenal } from './actions'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — idénticos al dashboard (rojo vino para Penal)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  surface:     '#0b1220',
  border:      'rgba(255,255,255,0.06)',
  accent:      '#3a5fb8',
  accentAlpha: 'rgba(58,95,184,0.12)',
  red:         '#b3434f',
  redAlpha:    'rgba(179,67,79,0.10)',
  green:       '#4ade80',
  greenAlpha:  'rgba(74,222,128,0.08)',
  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted:   'rgba(255,255,255,0.40)',
  textFaint:   'rgba(255,255,255,0.22)',
  textAccent:  '#8fa8e0',
}

type Juez    = { id: number; nombre: string }
type MP      = { id: number; nombre_agencia: string }
type Abogado = { id: number; nombre_completo: string }

export default function ClienteCausasPenales({
  jueces, ministerios, abogados, causas,
}: {
  jueces:      Juez[]
  ministerios: MP[]
  abogados:    Abogado[]
  causas:      any[]
}) {
  const [abierto, setAbierto]     = useState(false)
  const [busqueda, setBusqueda]   = useState('')
  const [filtroTab, setFiltroTab] = useState<'todos' | 'activos' | 'termino' | 'concluidos'>('todos')
  const [mensaje, setMensaje]     = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const obtenerProximoTermino = (tareas: any[]) => {
    if (!tareas?.length) return null
    return tareas
      .filter((t) => !t.completada && t.fecha_vencimiento)
      .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())[0]
      ?.fecha_vencimiento ?? null
  }

  const hoy = new Date().toISOString().split('T')[0]

  const causasFiltradas = causas.filter((c) => {
    const penal = c.expedientes_penales?.[0] ?? {}
    const term  = busqueda.toLowerCase()
    const ok =
      c.numero_expediente?.toLowerCase().includes(term) ||
      c.clientes?.nombre_completo?.toLowerCase().includes(term) ||
      penal.delito?.toLowerCase().includes(term) ||
      penal.numero_carpeta_investigacion?.toLowerCase().includes(term)
    if (!ok) return false
    const prox = obtenerProximoTermino(c.tareas)
    if (filtroTab === 'activos')    return c.estado === 'Activo'
    if (filtroTab === 'concluidos') return c.estado === 'Concluido'
    if (filtroTab === 'termino')    return c.estado === 'Activo' && prox !== null && prox >= hoy
    return true
  })

  const cnt = {
    todos:      causas.length,
    activos:    causas.filter(c => c.estado === 'Activo').length,
    concluidos: causas.filter(c => c.estado === 'Concluido').length,
    termino:    causas.filter(c => c.estado === 'Activo' && obtenerProximoTermino(c.tareas) !== null).length,
  }

  async function manejarSubmit(formData: FormData) {
    setError(null)
    const r = await crearCausaPenal(formData)
    if (r?.error) {
      setError(r.error)
    } else {
      setMensaje('Causa penal creada correctamente.')
      setAbierto(false)
      setTimeout(() => setMensaje(null), 3000)
    }
  }

  return (
    <div style={css.root}>
      {/* Responsive: header apilado en mobile, tabla/cards alternados */}
      <style>{`
        @media (max-width: 520px) {
          .pen-page-header { flex-direction: column; align-items: stretch !important; gap: 14px !important; }
          .pen-btn-primario { width: 100%; justify-content: center; padding: 12px 18px !important; }
        }
        @media (max-width: 480px) {
          .pen-modal { padding: 20px !important; }
        }
        @media (max-width: 720px) {
          .pen-tabla-desktop { display: none !important; }
          .pen-tabla-mobile { display: flex !important; }
        }
        @media (min-width: 721px) {
          .pen-tabla-mobile { display: none !important; }
        }
      `}</style>

      {/* ── ENCABEZADO ── */}
      <div className="pen-page-header" style={css.pageHeader}>
        <div>
          <h1 style={css.titulo}>Causas Penales</h1>
          <p style={css.subtitulo}>
            <span style={css.dot} />
            Gestión de causas en materia penal
            &nbsp;·&nbsp;
            <strong style={{ color: T.textPrimary }}>{cnt.todos}</strong> registradas
          </p>
        </div>
        <button onClick={() => setAbierto(true)} className="pen-btn-primario" style={css.btnPrimario}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nueva causa
        </button>
      </div>

      {/* Alerta éxito */}
      {mensaje && (
        <div style={css.alertaExito}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          {mensaje}
        </div>
      )}

      {/* ── FILTROS ── */}
      <div style={css.filtrosRow}>
        <div style={css.searchWrap}>
          <svg style={css.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por causa, carpeta, cliente o delito..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={css.searchInput}
          />
        </div>
        <div style={css.tabs}>
          {([
            ['todos',      `Todos (${cnt.todos})`],
            ['activos',    `Activos (${cnt.activos})`],
            ['termino',    `Con término (${cnt.termino})`],
            ['concluidos', `Concluidos (${cnt.concluidos})`],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFiltroTab(key)} style={css.tab(filtroTab === key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABLA (desktop) + CARDS (mobile) ── */}
      <div style={css.tabla}>
        {causasFiltradas.length === 0 ? (
          <div style={css.vacio}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: T.textFaint }}>
              <path d="m14 13-8.5 8.5a2.121 2.121 0 1 1-3-3L11 10"/><path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>
            </svg>
            <span>No se encontraron causas penales con los criterios seleccionados</span>
          </div>
        ) : (
          <>
            {/* Vista tabla — pantallas anchas */}
            <div className="pen-tabla-desktop" style={{ overflowX: 'auto' }}>
              <table style={css.table}>
                <thead>
                  <tr>
                    {['No. Causa', 'Cliente / Rol', 'Delito', 'Etapa', 'Juez / MP', 'Estado', 'Próx. Término'].map(h => (
                      <th key={h} style={css.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {causasFiltradas.map((c) => {
                    const penal    = c.expedientes_penales?.[0] ?? {}
                    const proxTerm = obtenerProximoTermino(c.tareas)
                    const esHoy    = proxTerm === hoy
                    const vencido  = proxTerm && proxTerm < hoy
                    const activo   = c.estado === 'Activo'

                    return (
                      <tr key={c.id} style={css.tr}>
                        <td style={css.td}>
                          <span style={{ fontWeight: 600, color: T.textPrimary, fontSize: 13 }}>
                            {c.numero_expediente}
                          </span>
                          <div style={css.sub}>Carp: {penal.numero_carpeta_investigacion ?? '—'}</div>
                        </td>
                        <td style={css.td}>
                          <span style={{ color: T.textPrimary, fontSize: 13 }}>
                            {c.clientes?.nombre_completo ?? '—'}
                          </span>
                          <div style={css.sub}>{c.caracter_cliente} · {penal.rol_abogado}</div>
                        </td>
                        <td style={{ ...css.td, color: T.textMuted, fontSize: 13 }}>{penal.delito ?? '—'}</td>
                        <td style={{ ...css.td, color: T.textMuted, fontSize: 13 }}>{penal.estadio_procesal ?? '—'}</td>
                        <td style={css.td}>
                          <span style={{ color: T.textMuted, fontSize: 13 }}>{c.jueces?.nombre ?? '—'}</span>
                          <div style={css.sub}>{penal.ministerios_publicos?.nombre_agencia ?? 'Sin MP'}</div>
                        </td>
                        <td style={css.td}>
                          <span style={{
                            ...css.pill,
                            background: activo ? T.greenAlpha : 'rgba(251,191,36,0.08)',
                            color:      activo ? T.green      : '#fbbf24',
                            border:     `0.5px solid ${activo ? 'rgba(74,222,128,0.18)' : 'rgba(251,191,36,0.20)'}`,
                          }}>
                            {c.estado}
                          </span>
                        </td>
                        <td style={css.td}>
                          {proxTerm ? (
                            <span style={{
                              fontWeight: esHoy || vencido ? 600 : 400,
                              color: vencido ? T.red : esHoy ? '#fbbf24' : T.textMuted,
                              fontSize: 13,
                            }}>
                              {vencido ? '⚠ ' : esHoy ? '● ' : ''}{proxTerm}
                            </span>
                          ) : (
                            <span style={{ color: T.textFaint, fontSize: 13 }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista estilo lista de chats — mobile */}
            <div className="pen-tabla-mobile" style={css.cardsList}>
              {causasFiltradas.map((c) => {
                const penal    = c.expedientes_penales?.[0] ?? {}
                const proxTerm = obtenerProximoTermino(c.tareas)
                const esHoy    = proxTerm === hoy
                const vencido  = proxTerm && proxTerm < hoy
                const activo   = c.estado === 'Activo'

                return (
                  <a key={c.id} href={`/sistema/expedientes/penal/detalle?id=${c.id}`} style={css.rowLink}>
                    <div style={css.rowAvatar}>
                      <i className="ti ti-gavel" style={{ fontSize: 18, color: T.red }} aria-hidden="true" />
                    </div>
                    <div style={css.rowBody}>
                      <div style={css.rowTop}>
                        <span style={css.rowTitulo}>{c.numero_expediente}</span>
                        {proxTerm && (
                          <span style={{
                            ...css.rowFecha,
                            color: vencido ? T.red : esHoy ? '#fbbf24' : T.textFaint,
                          }}>
                            {esHoy ? 'Hoy' : proxTerm}
                          </span>
                        )}
                      </div>
                      <div style={css.rowSub}>
                        <span style={{ ...css.rowDot, background: activo ? T.green : '#fbbf24' }} />
                        {penal.delito || 'Sin delito especificado'}
                      </div>
                    </div>
                    <i className="ti ti-chevron-right" style={{ fontSize: 18, color: T.textFaint, flexShrink: 0 }} aria-hidden="true" />
                  </a>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL ── */}
      {abierto && (
        <div style={css.overlay} onClick={() => setAbierto(false)}>
          <div className="pen-modal" style={css.modal} onClick={(e) => e.stopPropagation()}>

            <div style={css.modalHeader}>
              <div>
                <h2 style={css.modalTitulo}>Nueva Causa Penal</h2>
                <p style={css.modalSub}>Complete los campos requeridos para el registro del caso</p>
              </div>
              <button onClick={() => setAbierto(false)} style={css.btnCerrar} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {error && (
              <div style={css.alertaError}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                {error}
              </div>
            )}

            <form action={manejarSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <Seccion titulo="Información de la Causa" icono="📋">
                <div style={css.grid2}>
                  <Campo label="Número de Causa *">
                    <input name="numero_causa" required style={css.input} placeholder="Ej: 118-2025" />
                  </Campo>
                  <Campo label="Número de Carpeta de Investigación">
                    <input name="numero_carpeta" style={css.input} placeholder="Ej: 05-20-26" />
                  </Campo>
                  <Campo label="Delito *">
                    <input name="delito" required style={css.input} placeholder="Ej: Robo con violencia" />
                  </Campo>
                  <Campo label="Etapa Procesal *">
                    <select name="etapa_procesal" required style={css.input} defaultValue="">
                      <option value="" disabled>Seleccionar…</option>
                      <option>Inicial</option>
                      <option>Intermedia</option>
                      <option>Juicio</option>
                    </select>
                  </Campo>
                  <Campo label="Fecha de Inicio *">
                    <input name="fecha_inicio" type="date" required style={css.input} />
                  </Campo>
                  <Campo label="Estado">
                    <select name="estado" style={css.input} defaultValue="Activo">
                      <option>Activo</option>
                      <option>Concluido</option>
                    </select>
                  </Campo>
                </div>
              </Seccion>

              <Seccion titulo="Partes Involucradas" icono="👥">
                <div style={css.grid2}>
                  <Campo label="Cliente *">
                    <input name="cliente_nombre" required style={css.input} placeholder="Nombre del cliente" />
                  </Campo>
                  <Campo label="Rol del Cliente *">
                    <select name="rol_cliente" required style={css.input} defaultValue="Imputado">
                      <option>Imputado</option>
                      <option>Víctima</option>
                    </select>
                  </Campo>
                  <Campo label="Rol del Abogado *">
                    <select name="rol_abogado" required style={css.input} defaultValue="Defensor">
                      <option>Defensor</option>
                      <option>Asesor jurídico</option>
                    </select>
                  </Campo>
                  <Campo label="Contraparte">
                    <input name="contraparte" style={css.input} placeholder="Nombre de la contraparte u ofendido" />
                  </Campo>
                </div>
              </Seccion>

              <Seccion titulo="Información Procesal" icono="⚖️">
                <div style={css.grid2}>
                  <Campo label="Juez Asignado *">
                    <select name="juez_id" required style={css.input} defaultValue="">
                      <option value="" disabled>Seleccionar juez</option>
                      {jueces.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Ministerio Público a cargo">
                    <select name="mp_id" style={css.input} defaultValue="">
                      <option value="">Seleccionar MP</option>
                      {ministerios.map((m) => <option key={m.id} value={m.id}>{m.nombre_agencia}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Fecha Próxima Audiencia (Término)">
                    <input name="fecha_limite_termino" type="date" style={css.input} />
                  </Campo>
                  <Campo label="Tipo de Audiencia">
                    <select name="plazo_otorgado" style={css.input} defaultValue="">
                      <option value="">Seleccionar…</option>
                      <option>Inicial</option>
                      <option>Vinculación</option>
                      <option>Cautelar</option>
                    </select>
                  </Campo>
                  <Campo label="Abogado Responsable">
                    <select name="abogado_id" style={css.input} defaultValue="">
                      <option value="">Sin asignar</option>
                      {abogados.map((a) => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                    </select>
                  </Campo>
                </div>
                <Campo label="Descripción / Notas">
                  <textarea name="descripcion" rows={3} style={{ ...css.input, resize: 'vertical' as const }} placeholder="Descripción general del caso…" />
                </Campo>
              </Seccion>

              <div style={css.modalFooter}>
                <button type="button" onClick={() => setAbierto(false)} style={css.btnSecundario}>
                  Cancelar
                </button>
                <button type="submit" style={css.btnPrimario}>
                  Crear causa
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧩 SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────────────
function Seccion({ titulo, icono, children }: { titulo: string; icono: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: `0.5px solid ${T.border}`,
      borderRadius: 10,
      padding: '18px 20px',
      background: T.surface,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span>{icono}</span>{titulo}
      </div>
      {children}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, letterSpacing: '0.01em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
const css = {
  root: {
    width: '100%',
    padding: 'clamp(20px, 5vw, 40px) clamp(20px, 5vw, 40px)',
    boxSizing: 'border-box' as const,
  },

  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
    flexWrap: 'wrap' as const,
  },

  titulo: {
    fontSize: 'clamp(20px, 3vw, 26px)',
    fontWeight: 700,
    color: T.textPrimary,
    margin: 0,
    letterSpacing: '-0.5px',
  } as React.CSSProperties,

  subtitulo: {
    fontSize: 13,
    color: T.textMuted,
    margin: '5px 0 0',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,

  dot: {
    display: 'inline-block' as const,
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: T.red,
    flexShrink: 0,
  },

  btnPrimario: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '10px 18px',
    background: T.red,
    color: 'white',
    border: 'none',
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  } as React.CSSProperties,

  btnSecundario: {
    padding: '10px 18px',
    background: 'transparent',
    color: T.textMuted,
    border: `0.5px solid ${T.border}`,
    borderRadius: 9,
    fontSize: 13,
    cursor: 'pointer',
  } as React.CSSProperties,

  alertaExito: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: T.green,
    background: T.greenAlpha,
    border: `0.5px solid rgba(74,222,128,0.18)`,
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 16,
  } as React.CSSProperties,

  alertaError: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: T.red,
    background: T.redAlpha,
    border: `0.5px solid rgba(179,67,79,0.22)`,
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 4,
  } as React.CSSProperties,

  filtrosRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap' as const,
  },

  searchWrap: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: 200,
  },

  searchIcon: {
    position: 'absolute' as const,
    left: 11,
    color: T.textFaint,
    pointerEvents: 'none' as const,
  },

  searchInput: {
    width: '100%',
    padding: '9px 12px 9px 33px',
    background: '#0f1828',
    border: `0.5px solid ${T.border}`,
    borderRadius: 8,
    color: T.textPrimary,
    fontSize: 13,
    outline: 'none',
  } as React.CSSProperties,

  tabs: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
  },

  tab: (activo: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    background: activo ? T.redAlpha : 'transparent',
    color:      activo ? T.red      : T.textMuted,
    border:     `0.5px solid ${activo ? 'rgba(179,67,79,0.35)' : T.border}`,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: activo ? 600 : 400,
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  }),

  tabla: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 12,
    overflow: 'hidden',
  } as React.CSSProperties,

  vacio: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 10,
    padding: '48px 24px',
    color: T.textFaint,
    fontSize: 13,
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    minWidth: 700,
  },

  // ── Vista de cards (mobile) ──
  cardsList: {
    display: 'none',
    flexDirection: 'column' as const,
    gap: 1,
  } as React.CSSProperties,

  // ── Fila estilo lista de chats (mobile) ──
  rowLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderBottom: `0.5px solid ${T.border}`,
    textDecoration: 'none',
    color: 'inherit',
    transition: 'background 0.12s',
  } as React.CSSProperties,

  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: T.redAlpha,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  rowBody: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
  } as React.CSSProperties,

  rowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  rowTitulo: {
    fontSize: 14.5,
    fontWeight: 600,
    color: T.textPrimary,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  rowFecha: {
    fontSize: 11.5,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  rowSub: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: T.textMuted,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  rowDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  } as React.CSSProperties,

  th: {
    padding: '10px 16px',
    fontSize: 11,
    fontWeight: 600,
    color: T.textFaint,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    textAlign: 'left' as const,
    background: '#0f1828',
    borderBottom: `0.5px solid ${T.border}`,
    whiteSpace: 'nowrap' as const,
  },

  tr: {
    transition: 'background 0.12s',
    cursor: 'pointer',
  } as React.CSSProperties,

  td: {
    padding: '13px 16px',
    borderBottom: `0.5px solid ${T.border}`,
    verticalAlign: 'top' as const,
  } as React.CSSProperties,

  sub: {
    fontSize: 11.5,
    color: T.textFaint,
    marginTop: 3,
  } as React.CSSProperties,

  pill: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 20,
  } as React.CSSProperties,

  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(6,10,18,0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '24px 16px',
    overflowY: 'auto' as const,
    zIndex: 200,
  },

  modal: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 14,
    padding: '28px 28px',
    width: '100%',
    maxWidth: 820,
    marginTop: 20,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  } as React.CSSProperties,

  modalTitulo: {
    fontSize: 20,
    fontWeight: 700,
    color: T.textPrimary,
    margin: '4px 0 0',
    letterSpacing: '-0.4px',
  } as React.CSSProperties,

  modalSub: {
    fontSize: 12.5,
    color: T.textMuted,
    margin: '4px 0 0',
  } as React.CSSProperties,

  btnCerrar: {
    width: 32,
    height: 32,
    border: `0.5px solid ${T.border}`,
    borderRadius: 8,
    background: '#0f1828',
    color: T.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  } as React.CSSProperties,

  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 4,
    borderTop: `0.5px solid ${T.border}`,
  } as React.CSSProperties,

  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
    marginBottom: 8,
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px 12px',
    background: '#0f1828',
    border: `0.5px solid ${T.border}`,
    borderRadius: 8,
    color: T.textPrimary,
    fontSize: 13,
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,
}