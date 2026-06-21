'use client'

import { useState } from 'react'
import { crearExpedienteAmparo } from './actions'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — idénticos al dashboard (dorado para Amparos)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  surface:     '#0b1220',
  surfaceLow:  '#0f1828',
  border:      'rgba(255,255,255,0.06)',
  accent:      '#3a5fb8',
  accentAlpha: 'rgba(58,95,184,0.12)',
  gold:        '#d4af37',
  goldAlpha:   'rgba(212,175,55,0.10)',
  green:       '#4ade80',
  greenAlpha:  'rgba(74,222,128,0.08)',
  red:         '#b3434f',
  redAlpha:    'rgba(179,67,79,0.10)',
  amber:       '#fbbf24',
  amberAlpha:  'rgba(251,191,36,0.08)',
  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted:   'rgba(255,255,255,0.40)',
  textFaint:   'rgba(255,255,255,0.22)',
  textAccent:  '#8fa8e0',
}

type Juzgado = { id: number; nombre: string; ciudad: string }
type Abogado = { id: number; nombre_completo: string }

export default function ClienteAmparos({
  juzgados,
  abogados,
  amparos,
}: {
  juzgados: Juzgado[]
  abogados: Abogado[]
  amparos: any[]
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTab, setFiltroTab] = useState<'todos' | 'tramite' | 'termino' | 'resueltos'>('todos')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const obtenerProximoTermino = (tareas: any[]) => {
    if (!tareas?.length) return null
    return tareas
      .filter((t) => !t.completada && t.fecha_vencimiento)
      .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())[0]
      ?.fecha_vencimiento ?? null
  }

  const hoy = new Date().toISOString().split('T')[0]

  const amparosFiltrados = amparos.filter((amp) => {
    const dataAmp = amp.expedientes_amparo?.[0] ?? amp.expedientes_amparo ?? {}
    const term = busqueda.toLowerCase()

    const ok =
      amp.numero_expediente?.toLowerCase().includes(term) ||
      amp.clientes?.nombre_completo?.toLowerCase().includes(term) ||
      dataAmp.autoridad_responsable?.toLowerCase().includes(term) ||
      dataAmp.acto_reclamado?.toLowerCase().includes(term)

    if (!ok) return false

    const proxTerm = obtenerProximoTermino(amp.tareas)

    if (filtroTab === 'tramite') return amp.estado === 'Activo' || amp.estado === 'En trámite'
    if (filtroTab === 'resueltos') return amp.estado === 'Resuelto' || amp.estado === 'Concluido'
    if (filtroTab === 'termino') {
      return (amp.estado === 'Activo' || amp.estado === 'En trámite') && proxTerm !== null && proxTerm >= hoy
    }
    return true
  })

  const cnt = {
    todos:      amparos.length,
    tramite:    amparos.filter(a => a.estado === 'Activo' || a.estado === 'En trámite').length,
    resueltos:  amparos.filter(a => a.estado === 'Resuelto' || a.estado === 'Concluido').length,
    termino:    amparos.filter(a => (a.estado === 'Activo' || a.estado === 'En trámite') && obtenerProximoTermino(a.tareas) !== null).length,
  }

  async function manejarSubmit(formData: FormData) {
    setError(null)
    const r = await crearExpedienteAmparo(formData)
    if (r?.error) {
      setError(r.error)
    } else {
      setMensaje('Juicio de amparo registrado de manera exitosa.')
      setAbierto(false)
      setTimeout(() => setMensaje(null), 3000)
    }
  }

  return (
    <div style={css.root}>
      {/* Responsive: header apilado y botón full-width en mobile */}
      <style>{`
        @media (max-width: 520px) {
          .amp-page-header { flex-direction: column; align-items: stretch !important; }
          .amp-btn-primario { width: 100%; justify-content: center; }
        }
        @media (max-width: 480px) {
          .amp-modal { padding: 20px !important; }
        }
        @media (max-width: 720px) {
          .amp-tabla-desktop { display: none !important; }
          .amp-tabla-mobile { display: flex !important; }
        }
        @media (min-width: 721px) {
          .amp-tabla-mobile { display: none !important; }
        }
      `}</style>

      {/* ── ENCABEZADO ── */}
      <div className="amp-page-header" style={css.pageHeader}>
        <div>
          <h1 style={css.titulo}>Expedientes de Amparo</h1>
          <p style={css.subtitulo}>
            <span style={css.dot} />
            Gestión de juicios de amparo
            &nbsp;·&nbsp;
            <strong style={{ color: T.textPrimary }}>{cnt.todos}</strong> registrados
          </p>
        </div>
        <button onClick={() => setAbierto(true)} className="amp-btn-primario" style={css.btnPrimario}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo Amparo
        </button>
      </div>

      {/* Alerta éxito */}
      {mensaje && (
        <div style={css.alertaExito}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {mensaje}
        </div>
      )}

      {/* ── FILTROS ── */}
      <div style={css.filtrosRow}>
        <div style={css.searchWrap}>
          <svg style={css.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por expediente, quejoso, autoridad..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={css.searchInput}
          />
        </div>
        <div style={css.tabs}>
          {([
            ['todos',      `Todos (${cnt.todos})`],
            ['tramite',    `En trámite (${cnt.tramite})`],
            ['termino',    `Con término (${cnt.termino})`],
            ['resueltos',  `Resueltos (${cnt.resueltos})`],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFiltroTab(key)} style={css.tab(filtroTab === key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABLA (desktop) + CARDS (mobile) ── */}
      <div style={css.tabla}>
        {amparosFiltrados.length === 0 ? (
          <div style={css.vacio}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: T.textFaint }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>No se encontraron amparos con los criterios seleccionados</span>
          </div>
        ) : (
          <>
            {/* Vista tabla — pantallas anchas */}
            <div className="amp-tabla-desktop" style={{ overflowX: 'auto' }}>
              <table style={css.table}>
                <thead>
                  <tr>
                    {['No. Expediente', 'Quejoso', 'Autoridad Responsable', 'Acto Reclamado', 'Juzgado Fed.', 'Próx. Término'].map(h => (
                      <th key={h} style={css.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {amparosFiltrados.map((amp) => {
                    const dataAmp = amp.expedientes_amparo?.[0] ?? amp.expedientes_amparo ?? {}
                    const proxTerm = obtenerProximoTermino(amp.tareas)
                    const esHoy = proxTerm === hoy
                    const vencido = proxTerm && proxTerm < hoy
                    const activo = amp.estado === 'Activo' || amp.estado === 'En trámite'

                    return (
                      <tr key={amp.id} style={css.tr}>
                        <td style={css.td}>
                          <span style={{ fontWeight: 600, color: T.textPrimary, fontSize: 13 }}>
                            {amp.numero_expediente}
                          </span>
                          <div style={css.sub}>{dataAmp.tipo_amparo || 'Amparo Indirecto'}</div>
                        </td>
                        <td style={{ ...css.td, color: T.textPrimary, fontSize: 13 }}>
                          {amp.clientes?.nombre_completo ?? '—'}
                        </td>
                        <td style={{ ...css.td, color: T.textMuted, fontSize: 13 }}>
                          {dataAmp.autoridad_responsable ?? '—'}
                        </td>
                        <td style={{ ...css.td, color: T.textMuted, fontSize: 13 }}>
                          {dataAmp.acto_reclamado ?? '—'}
                        </td>
                        <td style={css.td}>
                          <span style={{ color: T.textMuted, fontSize: 13 }}>{amp.juzgados?.nombre ?? '—'}</span>
                          <div style={css.sub}>{amp.juzgados?.ciudad || 'Hidalgo'}</div>
                        </td>
                        <td style={css.td}>
                          {!activo ? (
                            <span style={{
                              ...css.pill,
                              background: T.goldAlpha,
                              color: T.gold,
                              border: `0.5px solid rgba(212,175,55,0.20)`,
                            }}>
                              Resuelto
                            </span>
                          ) : proxTerm ? (
                            <span style={{
                              fontWeight: esHoy || vencido ? 600 : 400,
                              color: vencido ? T.red : esHoy ? T.amber : T.textMuted,
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
            <div className="amp-tabla-mobile" style={css.cardsList}>
              {amparosFiltrados.map((amp) => {
                const dataAmp = amp.expedientes_amparo?.[0] ?? amp.expedientes_amparo ?? {}
                const proxTerm = obtenerProximoTermino(amp.tareas)
                const esHoy = proxTerm === hoy
                const vencido = proxTerm && proxTerm < hoy
                const activo = amp.estado === 'Activo' || amp.estado === 'En trámite'

                return (
                  <a key={amp.id} href={`/sistema/expedientes/amparo/detalle?id=${amp.id}`} style={css.rowLink}>
                    <div style={css.rowAvatar}>
                      <i className="ti ti-shield" style={{ fontSize: 18, color: T.gold }} aria-hidden="true" />
                    </div>
                    <div style={css.rowBody}>
                      <div style={css.rowTop}>
                        <span style={css.rowTitulo}>{amp.numero_expediente}</span>
                        {!activo ? (
                          <span style={{ ...css.rowFecha, color: T.gold }}>Resuelto</span>
                        ) : proxTerm ? (
                          <span style={{
                            ...css.rowFecha,
                            color: vencido ? T.red : esHoy ? T.amber : T.textFaint,
                          }}>
                            {esHoy ? 'Hoy' : proxTerm}
                          </span>
                        ) : null}
                      </div>
                      <div style={css.rowSub}>
                        <span style={{ ...css.rowDot, background: activo ? T.green : T.gold }} />
                        {dataAmp.tipo_amparo || 'Amparo Indirecto'}
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
          <div className="amp-modal" style={css.modal} onClick={(e) => e.stopPropagation()}>

            <div style={css.modalHeader}>
              <div>
                <h2 style={css.modalTitulo}>Nuevo Expediente de Amparo</h2>
                <p style={css.modalSub}>Complete el formulario para registrar un nuevo juicio de amparo</p>
              </div>
              <button onClick={() => setAbierto(false)} style={css.btnCerrar} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div style={css.alertaError}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                </svg>
                {error}
              </div>
            )}

            <form action={manejarSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <Seccion titulo="Información del Amparo" icono="📋">
                <div style={css.grid2}>
                  <Campo label="Número de Expediente *">
                    <input name="numero_expediente" required style={css.input} placeholder="EJ: 427-2025" />
                  </Campo>
                  <Campo label="Fecha de Presentación">
                    <input name="fecha_presentacion" type="date" style={css.input} />
                  </Campo>
                  <Campo label="Quejoso *">
                    <input name="quejoso_nombre" required style={css.input} placeholder="Nombre del quejoso" />
                  </Campo>
                  <Campo label="Tipo de Amparo *">
                    <select name="tipo_amparo" required style={css.input} defaultValue="Indirecto">
                      <option>Directo</option>
                      <option>Indirecto</option>
                    </select>
                  </Campo>
                  <Campo label="Próximo Término">
                    <input name="proximo_termino" type="date" style={css.input} />
                  </Campo>
                  <Campo label="Estado">
                    <select name="estado" style={css.input} defaultValue="En trámite">
                      <option>En trámite</option>
                      <option>Resuelto</option>
                    </select>
                  </Campo>
                </div>
              </Seccion>

              <Seccion titulo="Acto Reclamado" icono="⚖️">
                <Campo label="Autoridad Responsable *">
                  <input name="autoridad_responsable" required style={css.input} placeholder="EJ: Juez Primero Civil del Distrito Judicial de..." />
                </Campo>
                <Campo label="Acto Reclamado *">
                  <textarea name="acto_reclamado" required rows={2} style={{ ...css.input, resize: 'vertical' as const }} placeholder="Descripción del acto reclamado..." />
                </Campo>
                <Campo label="Tercero Interesado">
                  <input name="tercero_interesado" style={css.input} placeholder="Nombre del tercero interesado (si aplica)" />
                </Campo>
              </Seccion>

              <Seccion titulo="Información Procesal" icono="🏛️">
                <div style={css.grid2}>
                  <Campo label="Juzgado de Distrito *">
                    <select name="juzgado_id" required style={css.input} defaultValue="">
                      <option value="" disabled>Seleccionar Juzgado Federal...</option>
                      {juzgados.map((j) => (
                        <option key={j.id} value={j.id}>{j.nombre} ({j.ciudad})</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Abogado Responsable">
                    <select name="abogado_id" style={css.input} defaultValue="">
                      <option value="">Seleccionar abogado...</option>
                      {abogados.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                      ))}
                    </select>
                  </Campo>
                </div>
                <Campo label="Descripción / Observaciones">
                  <textarea name="descripcion" rows={3} style={{ ...css.input, resize: 'vertical' as const }} placeholder="Notas adicionales - respaldo cuando no hay internet para el portal del PJF..." />
                </Campo>
              </Seccion>

              <div style={css.modalFooter}>
                <button type="button" onClick={() => setAbierto(false)} style={css.btnSecundario}>
                  Cancelar
                </button>
                <button type="submit" style={css.btnPrimario}>
                  Crear Amparo
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}


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


const css = {
  root: {
    width: '100%',
    padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 40px)',
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
    background: T.gold,
    flexShrink: 0,
  },

  btnPrimario: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '10px 18px',
    background: T.gold,
    color: '#412402',
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
    background: activo ? T.goldAlpha : 'transparent',
    color: activo ? T.gold : T.textMuted,
    border: `0.5px solid ${activo ? 'rgba(212,175,55,0.35)' : T.border}`,
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
    background: T.goldAlpha,
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