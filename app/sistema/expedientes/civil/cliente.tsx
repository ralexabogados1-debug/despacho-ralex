'use client'

import { useState } from 'react'
import { crearExpedienteCivilFamiliar } from './actions'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — idénticos al dashboard
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:          '#070a11',
  surface:     '#0b1220',
  border:      'rgba(255,255,255,0.06)',
  accent:      '#3a5fb8',
  accentAlpha: 'rgba(58,95,184,0.12)',
  gold:        '#d4af37',
  goldAlpha:   'rgba(212,175,55,0.10)',
  green:       '#4ade80',
  greenAlpha:  'rgba(74,222,128,0.08)',
  red:         '#b3434f',
  redAlpha:    'rgba(179,67,79,0.10)',
  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted:   'rgba(255,255,255,0.40)',
  textFaint:   'rgba(255,255,255,0.22)',
  textAccent:  '#8fa8e0',
}

type Materia  = { id: number; nombre: string }
type Juzgado  = { id: number; nombre: string; ciudad: string; materia_id: number }
type Abogado  = { id: number; nombre_completo: string }

export default function ClienteCivilFamiliar({
  materias, juzgados, abogados, expedientes,
}: {
  materias:    Materia[]
  juzgados:    Juzgado[]
  abogados:    Abogado[]
  expedientes: any[]
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

  const expedientesFiltrados = expedientes.filter((exp) => {
    const term = busqueda.toLowerCase()
    const ok =
      exp.numero_expediente?.toLowerCase().includes(term) ||
      exp.clientes?.nombre_completo?.toLowerCase().includes(term) ||
      exp.tipo_juicio?.toLowerCase().includes(term)
    if (!ok) return false
    const prox = obtenerProximoTermino(exp.tareas)
    if (filtroTab === 'activos')    return exp.estado === 'Activo'
    if (filtroTab === 'concluidos') return exp.estado === 'Concluido'
    if (filtroTab === 'termino')    return exp.estado === 'Activo' && prox !== null && prox >= hoy
    return true
  })

  const cnt = {
    todos:      expedientes.length,
    activos:    expedientes.filter(e => e.estado === 'Activo').length,
    concluidos: expedientes.filter(e => e.estado === 'Concluido').length,
    termino:    expedientes.filter(e => e.estado === 'Activo' && obtenerProximoTermino(e.tareas) !== null).length,
  }

  async function manejarSubmit(formData: FormData) {
    setError(null)
    const r = await crearExpedienteCivilFamiliar(formData)
    if (r?.error) {
      setError(r.error)
    } else {
      setMensaje('Expediente registrado con éxito.')
      setAbierto(false)
      setTimeout(() => setMensaje(null), 3500)
    }
  }

  return (
    <>
      {/* Responsive: header apilado en mobile, tabla/cards alternados */}
      <style>{`
        @media (max-width: 520px) {
          .civ-page-header { flex-direction: column; align-items: stretch !important; gap: 14px !important; }
          .civ-btn-primario { width: 100%; justify-content: center; padding: 12px 18px !important; }
        }
        @media (max-width: 480px) {
          .civ-modal { padding: 20px !important; }
        }
        @media (max-width: 720px) {
          .civ-tabla-desktop { display: none !important; }
          .civ-tabla-mobile { display: flex !important; }
        }
        @media (min-width: 721px) {
          .civ-tabla-mobile { display: none !important; }
        }
      `}</style>

      {/* ── ENCABEZADO ── */}
      <div className="civ-page-header" style={css.pageHeader}>
        <div>
          <h1 style={css.titulo}>Expedientes Civil / Familiar</h1>
          <p style={css.subtitulo}>
            <span style={css.dot} />
            Gestión de expedientes en materia civil y familiar
            &nbsp;·&nbsp;
            <strong style={{ color: T.textPrimary }}>{cnt.todos}</strong> registrados
          </p>
        </div>
        <button onClick={() => setAbierto(true)} className="civ-btn-primario" style={css.btnPrimario}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nuevo expediente
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
            placeholder="Buscar por expediente, cliente, tipo de juicio..."
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
        {expedientesFiltrados.length === 0 ? (
          <div style={css.vacio}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: T.textFaint }}>
              <path d="M3 7a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L11 7h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
            </svg>
            <span>No se encontraron expedientes con los filtros seleccionados</span>
          </div>
        ) : (
          <>
            {/* Vista tabla — pantallas anchas */}
            <div className="civ-tabla-desktop" style={{ overflowX: 'auto' }}>
              <table style={css.table}>
                <thead>
                  <tr>
                    {['No. Expediente', 'Cliente', 'Contraparte', 'Materia / Juicio', 'Juzgado', 'Estado', 'Próx. Término'].map(h => (
                      <th key={h} style={css.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expedientesFiltrados.map((exp) => {
                    const proxTerm = obtenerProximoTermino(exp.tareas)
                    const esHoy    = proxTerm === hoy
                    const vencido  = proxTerm && proxTerm < hoy
                    const activo   = exp.estado === 'Activo'

                    return (
                      <tr key={exp.id} style={css.tr}>
                        <td style={css.td}>
                          <span style={{ fontWeight: 600, color: T.textPrimary, fontSize: 13 }}>
                            {exp.numero_expediente}
                          </span>
                          <div style={css.sub}>{exp.ciudad || 'Huejutla'}</div>
                        </td>
                        <td style={css.td}>
                          <span style={{ color: T.textPrimary, fontSize: 13 }}>
                            {exp.clientes?.nombre_completo ?? '—'}
                          </span>
                          <div style={css.sub}>{exp.caracter_cliente || 'Demandante'}</div>
                        </td>
                        <td style={{ ...css.td, color: T.textMuted, fontSize: 13 }}>{exp.contraparte || '—'}</td>
                        <td style={{ ...css.td, color: T.textMuted, fontSize: 13 }}>{exp.tipo_juicio || '—'}</td>
                        <td style={css.td}>
                          <span style={{ color: T.textMuted, fontSize: 13 }}>{exp.juzgados?.nombre ?? '—'}</span>
                          <div style={css.sub}>{exp.juzgados?.ciudad ?? ''}</div>
                        </td>
                        <td style={css.td}>
                          <span style={{
                            ...css.pill,
                            background: activo ? T.greenAlpha : 'rgba(251,191,36,0.08)',
                            color:      activo ? T.green      : '#fbbf24',
                            border:     `0.5px solid ${activo ? 'rgba(74,222,128,0.18)' : 'rgba(251,191,36,0.20)'}`,
                          }}>
                            {exp.estado}
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
            <div className="civ-tabla-mobile" style={css.cardsList}>
              {expedientesFiltrados.map((exp) => {
                const proxTerm = obtenerProximoTermino(exp.tareas)
                const esHoy    = proxTerm === hoy
                const vencido  = proxTerm && proxTerm < hoy
                const activo   = exp.estado === 'Activo'

                return (
                  <a key={exp.id} href={`/sistema/expedientes/civil/detalle?id=${exp.id}`} style={css.rowLink}>
                    <div style={css.rowAvatar}>
                      <i className="ti ti-scale" style={{ fontSize: 18, color: T.accent }} aria-hidden="true" />
                    </div>
                    <div style={css.rowBody}>
                      <div style={css.rowTop}>
                        <span style={css.rowTitulo}>{exp.numero_expediente}</span>
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
                        {exp.tipo_juicio || 'Civil / Familiar'}
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
          <div className="civ-modal" style={css.modal} onClick={(e) => e.stopPropagation()}>

            {/* Header modal */}
            <div style={css.modalHeader}>
              <div>
                <h2 style={css.modalTitulo}>Nuevo expediente civil / familiar</h2>
                <p style={css.modalSub}>Campos marcados con * son obligatorios</p>
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

              {/* Sección 1 */}
              <Seccion titulo="Información del expediente" icono="📋">
                <div style={css.grid2}>
                  <Campo label="Número de expediente *">
                    <input name="numero_expediente" required style={css.input} placeholder="Ej: 201-2025" />
                  </Campo>
                  <Campo label="Fecha de inicio *">
                    <input name="fecha_inicio" type="date" required style={css.input} />
                  </Campo>
                  <Campo label="Cliente *">
                    <input name="cliente_nombre" required style={css.input} placeholder="Nombre completo del cliente" />
                  </Campo>
                  <Campo label="Carácter del cliente *">
                    <select name="rol_cliente" required style={css.input} defaultValue="Demandante">
                      <option>Demandante</option>
                      <option>Demandado</option>
                      <option>Tercero interesado</option>
                    </select>
                  </Campo>
                  <Campo label="Contraparte">
                    <input name="contraparte" style={css.input} placeholder="Nombre de la contraparte" />
                  </Campo>
                  <Campo label="Estado">
                    <select name="estado" style={css.input} defaultValue="Activo">
                      <option>Activo</option>
                      <option>Concluido</option>
                    </select>
                  </Campo>
                </div>
              </Seccion>

              {/* Sección 2 */}
              <Seccion titulo="Información procesal" icono="⚖️">
                <div style={css.grid2}>
                  <Campo label="Materia / Tipo de juicio *">
                    <select name="materia_juicio_tipo" required style={css.input} defaultValue="">
                      <option value="" disabled>Seleccionar tipo de juicio...</option>
                      <option value="Familiar|Divorcio voluntario">Familiar — Divorcio voluntario</option>
                      <option value="Familiar|Pensión alimenticia">Familiar — Pensión alimenticia</option>
                      <option value="Familiar|Guarda y custodia">Familiar — Guarda y custodia</option>
                      <option value="Civil|Sucesión testamentaria">Civil — Sucesión testamentaria</option>
                      <option value="Civil|Juicio Ordinario Civil">Civil — Juicio Ordinario Civil</option>
                    </select>
                  </Campo>
                  <Campo label="Juzgado *">
                    <select name="juzgado_id" required style={css.input} defaultValue="">
                      <option value="" disabled>Seleccionar juzgado...</option>
                      {juzgados.map((j) => (
                        <option key={j.id} value={j.id}>{j.nombre} ({j.ciudad})</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Ciudad *">
                    <select name="ciudad" required style={css.input} defaultValue="Huejutla">
                      <option>Huejutla</option>
                      <option>Pachuca</option>
                      <option>Otra</option>
                    </select>
                  </Campo>
                  <Campo label="Abogado responsable">
                    <select name="abogado_id" style={css.input} defaultValue="">
                      <option value="">Sin asignar</option>
                      {abogados.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Próximo término">
                    <select name="plazo_otorgado" style={css.input} defaultValue="">
                      <option value="">Ninguno</option>
                      <option>3 días hábiles</option>
                      <option>5 días hábiles</option>
                      <option>9 días hábiles</option>
                      <option>15 días hábiles</option>
                    </select>
                  </Campo>
                  <Campo label="Fecha límite del término">
                    <input name="fecha_limite_termino" type="date" style={css.input} />
                  </Campo>
                </div>
                <Campo label="Descripción / Observaciones">
                  <textarea name="descripcion" rows={3} style={{ ...css.input, resize: 'vertical' as const }} placeholder="Descripción general del caso o anotaciones de inicio..." />
                </Campo>
              </Seccion>

              {/* Acciones */}
              <div style={css.modalFooter}>
                <button type="button" onClick={() => setAbierto(false)} style={css.btnSecundario}>
                  Cancelar
                </button>
                <button type="submit" style={css.btnPrimario}>
                  Crear expediente
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
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
    background: T.accent,
    flexShrink: 0,
  },

  btnPrimario: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '10px 18px',
    background: T.accent,
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
  },

  searchIcon: {
    position: 'absolute' as const,
    left: 11,
    color: T.textFaint,
    pointerEvents: 'none' as const,
  },

  searchInput: {
    padding: '9px 12px 9px 33px',
    background: '#0f1828',
    border: `0.5px solid ${T.border}`,
    borderRadius: 8,
    color: T.textPrimary,
    fontSize: 13,
    width: 280,
    outline: 'none',
  } as React.CSSProperties,

  tabs: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
  },

  tab: (activo: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    background: activo ? T.accentAlpha : 'transparent',
    color:      activo ? T.textAccent  : T.textMuted,
    border:     `0.5px solid ${activo ? 'rgba(58,95,184,0.35)' : T.border}`,
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
    background: T.accentAlpha,
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