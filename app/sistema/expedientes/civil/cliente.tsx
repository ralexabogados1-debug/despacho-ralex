'use client'

import { useState } from 'react'
import { crearExpedienteCivilFamiliar } from './actions'

// ─── Tokens (azul corporativo) ──────────────────────────────────────
const ACCENT        = '#4a7fd4'
const ACCENT_ALPHA  = 'rgba(74,127,212,0.10)'
const ACCENT_BORDER = 'rgba(74,127,212,0.40)'

const T = {
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
}

type Juzgado = { id: number; nombre: string; ciudad: string; materia_id: number }
type Abogado = { id: number; nombre_completo: string }
// DESPUÉS
type Materia = { id: number; nombre: string }

export default function ClienteCivilFamiliar({
  materias,
  juzgados,
  abogados,
  expedientes,
}: {
  materias: Materia[]
  juzgados: Juzgado[]
  abogados: Abogado[]
  expedientes: any[]
}) {
  const [abierto,    setAbierto]    = useState(false)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroTab,  setFiltroTab]  = useState<'todos' | 'activos' | 'termino' | 'concluidos'>('todos')
  const [mensaje,    setMensaje]    = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const hoy = new Date().toISOString().split('T')[0]

  const proxTermo = (tareas: any[]) =>
    tareas
      ?.filter(t => !t.completada && t.fecha_vencimiento)
      .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
      [0]?.fecha_vencimiento ?? null

  const esActivo = (estado: string) => estado === 'Activo'

  const filtrados = expedientes.filter(exp => {
    const term = busqueda.toLowerCase()
    const ok =
      exp.numero_expediente?.toLowerCase().includes(term) ||
      exp.clientes?.nombre_completo?.toLowerCase().includes(term) ||
      exp.tipo_juicio?.toLowerCase().includes(term)
    if (!ok) return false
    const pt = proxTermo(exp.tareas)
    if (filtroTab === 'activos')    return esActivo(exp.estado)
    if (filtroTab === 'concluidos') return exp.estado === 'Concluido'
    if (filtroTab === 'termino')    return esActivo(exp.estado) && pt !== null && pt >= hoy
    return true
  })

  const cnt = {
    todos:      expedientes.length,
    activos:    expedientes.filter(e => esActivo(e.estado)).length,
    concluidos: expedientes.filter(e => e.estado === 'Concluido').length,
    termino:    expedientes.filter(e => esActivo(e.estado) && proxTermo(e.tareas) !== null).length,
  }

  async function manejarSubmit(formData: FormData) {
    setError(null)
    const r = await crearExpedienteCivilFamiliar(formData)
    if (r?.error) { setError(r.error) }
    else {
      setMensaje('Expediente registrado con éxito.')
      setAbierto(false)
      setTimeout(() => setMensaje(null), 3000)
    }
  }

  return (
    <div style={s.root}>
      <style>{`
        .civ-header   { flex-direction: row; }
        .civ-btn-new  { width: auto; }
        .civ-filtros  { flex-direction: row; }
        .civ-form-row { flex-wrap: wrap; }
        .civ-col-form { flex: 1 1 220px; }
        .civ-busqueda-wrapper { flex: 1 1 200px; width: auto; }
        .civ-desktop   { width: 100%; overflow-x: auto; }   /* ← Corregido */

        @media (max-width: 700px) {
          .civ-header   { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .civ-btn-new  { width: 100% !important; justify-content: center !important; }
          .civ-filtros  { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .civ-busqueda-wrapper { width: 100% !important; flex: none !important; }
          .civ-tabs     { width: 100% !important; justify-content: flex-start !important; }
          .civ-tabs button { flex: 1 1 auto; text-align: center; justify-content: center; }
          .civ-col-form { flex: 1 1 100% !important; }
          
          .civ-desktop { display: none !important; }
          .civ-mobile  { display: flex !important; }
        }

        @media (min-width: 701px) {
          .civ-mobile  { display: none !important; }
        }
      `}</style>

      {/* ── ENCABEZADO ── */}
      <div className="civ-header" style={s.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={s.titulo}>Expedientes Civil / Familiar</h1>
          <p style={s.subtitulo}>
            <span style={{ ...s.dot, background: ACCENT }} />
            Gestión procesal
            &nbsp;·&nbsp;
            <strong style={{ color: T.textPrimary }}>{cnt.todos}</strong> registrados
          </p>
        </div>
        <button onClick={() => setAbierto(true)} className="civ-btn-new" style={{ ...s.btnPrimario, background: ACCENT }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo Expediente
        </button>
      </div>

      {mensaje && <Alerta tipo="ok">{mensaje}</Alerta>}

      {/* ── FILTROS ── */}
      <div className="civ-filtros" style={s.filtrosRow}>
        <div className="civ-busqueda-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <svg style={s.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por número, cliente o juicio..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={s.searchInput}
          />
        </div>

        <div className="civ-tabs" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, flexShrink: 0 }}>
          {([
            ['todos',      `Todos (${cnt.todos})`],
            ['activos',    `Activos (${cnt.activos})`],
            ['termino',    `Con término (${cnt.termino})`],
            ['concluidos', `Concluidos (${cnt.concluidos})`],
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
              <path d="M3 7a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L11 7h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
            </svg>
            Sin expedientes con los criterios seleccionados
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="civ-desktop">
              <table style={s.table}>
                <thead>
                  <tr>
                    {['No. Expediente','Cliente','Contraparte','Juicio','Juzgado','Estado','Próx. Término'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(exp => {
                    const pt  = proxTermo(exp.tareas)
                    const esH = pt === hoy
                    const venc = pt && pt < hoy
                    const act  = esActivo(exp.estado)
                    return (
                      <tr key={exp.id} className="civ-row" style={{ cursor: 'pointer' }}>
                        <td style={s.td}>
                          <a href={`/sistema/expedientes/civil/detalle?id=${exp.id}`} style={{ fontWeight: 600, color: T.textPrimary, fontSize: 13, textDecoration: 'none' }}>
                            {exp.numero_expediente}
                          </a>
                          <div style={s.sub}>{exp.ciudad || 'Huejutla'}</div>
                        </td>
                        <td style={{ ...s.td, color: T.textPrimary, fontSize: 13 }}>{exp.clientes?.nombre_completo ?? '—'}</td>
                        <td style={{ ...s.td, color: T.textMuted,   fontSize: 13 }}>{exp.contraparte || '—'}</td>
                        <td style={{ ...s.td, color: T.textMuted,   fontSize: 13 }}>{exp.tipo_juicio || '—'}</td>
                        <td style={s.td}>
                          <span style={{ color: T.textMuted, fontSize: 13 }}>{exp.juzgados?.nombre ?? '—'}</span>
                          <div style={s.sub}>{exp.juzgados?.ciudad ?? ''}</div>
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.pill, background: act ? T.greenAlpha : T.goldAlpha, color: act ? T.green : T.gold, border: `1px solid ${act ? 'rgba(74,222,128,0.25)' : 'rgba(212,175,55,0.25)'}` }}>
                            {exp.estado}
                          </span>
                        </td>
                        <td style={s.td}>
                          {!act ? (
                            <span style={{ ...s.pill, background: T.goldAlpha, color: T.gold, border: '1px solid rgba(212,175,55,0.25)' }}>Concluido</span>
                          ) : pt ? (
                            <span style={{ fontWeight: esH || venc ? 600 : 400, color: venc ? T.red : esH ? T.amber : T.textMuted, fontSize: 13 }}>
                              {venc ? '⚠ ' : esH ? '● ' : ''}{pt}
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

            {/* Mobile */}
            <div className="civ-mobile" style={{ display: 'none', flexDirection: 'column' as const }}>
              {filtrados.map(exp => {
                const pt   = proxTermo(exp.tareas)
                const esH  = pt === hoy
                const venc = pt && pt < hoy
                const act  = esActivo(exp.estado)
                return (
                  <a key={exp.id} href={`/sistema/expedientes/civil/detalle?id=${exp.id}`} className="civ-row-link" style={s.rowLink}>
                    <div style={{ ...s.avatar, background: ACCENT_ALPHA, color: ACCENT }}>
                      <span style={{ fontSize: 16, fontWeight: 'bold' }}>CF</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={s.rowTitulo}>{exp.numero_expediente || '—'}</span>
                        {!act ? (
                          <span style={{ fontSize: 11, color: T.gold, flexShrink: 0 }}>Concluido</span>
                        ) : pt ? (
                          <span style={{ fontSize: 11, color: venc ? T.red : esH ? T.amber : T.textFaint, flexShrink: 0 }}>{esH ? 'Hoy' : pt}</span>
                        ) : <span style={{ fontSize: 11, color: T.textFaint }}>—</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.textMuted }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: act ? T.green : T.gold, flexShrink: 0 }} />
                        {exp.tipo_juicio || 'Civil / Familiar'}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: T.textFaint, flexShrink: 0 }}>
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </a>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL ── */}
      {abierto && (
        <div style={s.overlay} onClick={() => setAbierto(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, margin: 0, letterSpacing: '-0.4px' }}>Nuevo Expediente Civil / Familiar</h2>
                <p   style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>Complete los campos procesales necesarios</p>
              </div>
              <button onClick={() => setAbierto(false)} style={s.btnCerrar} aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && <Alerta tipo="error">{error}</Alerta>}

            <form action={manejarSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Seccion titulo="Datos generales" icono="📋">
                <div className="civ-form-row" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Número de Expediente *">
                      <input name="numero_expediente" required style={s.input} placeholder="Ej: 201-2025" />
                    </Campo>
                  </div>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Fecha de inicio *">
                      <input name="fecha_inicio" type="date" required style={s.input} />
                    </Campo>
                  </div>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Estado">
                      <select name="estado" style={s.input} defaultValue="Activo">
                        <option>Activo</option>
                        <option>Concluido</option>
                      </select>
                    </Campo>
                  </div>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Ciudad *">
                      <select name="ciudad" required style={s.input} defaultValue="Huejutla">
                        <option>Huejutla</option>
                        <option>Pachuca</option>
                        <option>Otra</option>
                      </select>
                    </Campo>
                  </div>
                </div>
              </Seccion>

              <Seccion titulo="Partes" icono="👥">
                <div className="civ-form-row" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Cliente *">
                      <input name="cliente_nombre" required style={s.input} placeholder="Nombre completo" />
                    </Campo>
                  </div>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Carácter *">
                      <select name="rol_cliente" required style={s.input} defaultValue="Demandante">
                        <option>Demandante</option>
                        <option>Demandado</option>
                        <option>Tercero interesado</option>
                      </select>
                    </Campo>
                  </div>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Contraparte">
                      <input name="contraparte" style={s.input} placeholder="Nombre de la parte contraria" />
                    </Campo>
                  </div>
                </div>
              </Seccion>

              <Seccion titulo="Información procesal" icono="⚖️">
                <div className="civ-form-row" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Materia / Tipo de juicio *">
                      <select name="materia_juicio_tipo" required style={s.input} defaultValue="">
                        <option value="" disabled>Seleccionar...</option>
                        <option value="Familiar|Divorcio voluntario">Familiar — Divorcio voluntario</option>
                        <option value="Familiar|Pensión alimenticia">Familiar — Pensión alimenticia</option>
                        <option value="Familiar|Guarda y custodia">Familiar — Guarda y custodia</option>
                        <option value="Civil|Sucesión testamentaria">Civil — Sucesión testamentaria</option>
                        <option value="Civil|Juicio Ordinario Civil">Civil — Juicio Ordinario Civil</option>
                      </select>
                    </Campo>
                  </div>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Juzgado *">
                      <select name="juzgado_id" required style={s.input} defaultValue="">
                        <option value="" disabled>Seleccionar juzgado...</option>
                        {juzgados.map((j) => (
                          <option key={j.id} value={j.id}>{j.nombre} ({j.ciudad})</option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Próximo término (plazo)">
                      <select name="plazo_otorgado" style={s.input} defaultValue="">
                        <option value="">Ninguno</option>
                        <option>3 días hábiles</option>
                        <option>5 días hábiles</option>
                        <option>9 días hábiles</option>
                        <option>15 días hábiles</option>
                      </select>
                    </Campo>
                  </div>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Fecha límite del término">
                      <input name="fecha_limite_termino" type="date" style={s.input} />
                    </Campo>
                  </div>
                  <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Abogado responsable">
                      <select name="abogado_id" style={s.input} defaultValue="">
                        <option value="">Sin asignar</option>
                        {abogados.map((a) => (
                          <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                </div>
                <Campo label="Descripción / Observaciones">
                  <textarea name="descripcion" rows={3} style={s.textarea}
                    placeholder="Anotaciones o estado inicial del juicio..." />
                </Campo>
              </Seccion>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                <button type="button" onClick={() => setAbierto(false)} style={s.btnSec}>Cancelar</button>
                <button type="submit" style={{ ...s.btnPrimario, background: ACCENT }}>Guardar expediente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────
function Alerta({ tipo, children }: { tipo: 'ok' | 'error'; children: React.ReactNode }) {
  const ok = tipo === 'ok'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      color:      ok ? '#4ade80' : '#b3434f',
      background: ok ? 'rgba(74,222,128,0.08)' : 'rgba(179,67,79,0.10)',
      border:     `1px solid ${ok ? 'rgba(74,222,128,0.15)' : 'rgba(179,67,79,0.20)'}`,
      padding: '8px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 500, marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function Seccion({ titulo, icono, children }: { titulo: string; icono: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 8, padding: '12px 14px', background: '#0b1220' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.40)', marginBottom: 10 }}>
        <span>{icono}</span>{titulo}
      </div>
      {children}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)' }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Estilos (estructura Amparos, acento azul) ────────────────────────
const s = {
  root: {
    width: '100%',
    padding: '16px 12px',
    boxSizing: 'border-box' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 12,
    marginBottom: 16,
  },
  titulo: {
    fontSize: '20px',
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
    flexShrink: 0,
  },
  btnPrimario: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 16px',
    color: '#fff',
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
    background: '#0f1828',
    color: T.textMuted,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  } as React.CSSProperties,
  filtrosRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 14,
  },
  searchIcon: {
    position: 'absolute' as const,
    left: 10,
    color: T.textMuted,
    pointerEvents: 'none' as const,
  },
  searchInput: {
    width: '100%',
    padding: '8px 10px 8px 30px',
    background: '#0f1828',
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    color: T.textPrimary,
    fontSize: 13,
    outline: 'none',
  } as React.CSSProperties,
  tab: (activo: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    background: activo ? ACCENT_ALPHA : 'transparent',
    color:      activo ? ACCENT : T.textMuted,
    border:     `1px solid ${activo ? ACCENT_BORDER : T.border}`,
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
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    minWidth: 700,
  },
  th: {
    padding: '8px 14px',
    fontSize: 10.5,
    fontWeight: 600,
    color: T.textMuted,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    textAlign: 'left' as const,
    background: '#0f1828',
    borderBottom: `1px solid ${T.border}`,
  },
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
    background: 'rgba(6,10,18,0.8)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    zIndex: 200,
  },
  modal: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: '16px',
    width: '100%',
    maxWidth: 500,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    background: '#0f1828',
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    color: T.textPrimary,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '8px 10px',
    background: '#0f1828',
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    color: T.textPrimary,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
  } as React.CSSProperties,
}