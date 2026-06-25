'use client'

import { useState } from 'react'
import { crearExpedienteAmparo } from './actions'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  surface:     '#0b1220',
  surfaceLow:  '#0f1828',
  border:      'rgba(255,255,255,0.05)', // Ajustado para 1px elegante
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

type Juzgado = { id: number; nombre: string; ciudad: string }
type Abogado  = { id: number; nombre_completo: string }

export default function ClienteAmparos({
  juzgados,
  abogados,
  amparos,
}: {
  juzgados: Juzgado[]
  abogados: Abogado[]
  amparos:  any[]
}) {
  const [abierto,    setAbierto]    = useState(false)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroTab,  setFiltroTab]  = useState<'todos' | 'tramite' | 'termino' | 'resueltos'>('todos')
  const [mensaje,    setMensaje]    = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const hoy = new Date().toISOString().split('T')[0]

  const proxTermo = (tareas: any[]) =>
    tareas
      ?.filter(t => !t.completada && t.fecha_vencimiento)
      .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
      [0]?.fecha_vencimiento ?? null

  const activo = (estado: string) => estado === 'Activo' || estado === 'En trámite'

  const filtrados = amparos.filter(amp => {
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
    todos:     amparos.length,
    tramite:   amparos.filter(a => activo(a.estado)).length,
    resueltos: amparos.filter(a => a.estado === 'Resuelto' || a.estado === 'Concluido').length,
    termino:   amparos.filter(a => activo(a.estado) && proxTermo(a.tareas) !== null).length,
  }

  async function manejarSubmit(formData: FormData) {
    setError(null)
    const r = await crearExpedienteAmparo(formData)
    if (r?.error) { setError(r.error) }
    else {
      setMensaje('Juicio de amparo registrado de manera exitosa.')
      setAbierto(false)
      setTimeout(() => setMensaje(null), 3000)
    }
  }

  return (
    <div style={s.root}>
      <style>{`
        /* ── Responsividad unificada y compacta ── */
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

        .amp-tr:hover { background: rgba(255,255,255,0.02); }
        .amp-row-link:hover { background: rgba(255,255,255,0.03); }
      `}</style>

      {/* ── ENCABEZADO ── */}
      <div className="amp-header" style={s.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={s.titulo}>Expedientes de Amparo</h1>
          <p style={s.subtitulo}>
            <span style={s.dot} />
            Gestión de juicios de amparo
            &nbsp;·&nbsp;
            <strong style={{ color: T.textPrimary }}>{cnt.todos}</strong> registrados
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
      {mensaje && <Alerta tipo="ok">{mensaje}</Alerta>}

      {/* ── FILTROS ── */}
      <div className="amp-filtros" style={s.filtrosRow}>
        {/* Buscador */}
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

        {/* Tabs */}
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
            {/* ── TABLA — desktop ── */}
            <div className="amp-desktop" style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['No. Expediente','Quejoso','Autoridad Responsable','Acto Reclamado','Juzgado Fed.','Próx. Término'].map(h => (
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
                      <tr key={amp.id} className="amp-tr" style={{ cursor: 'pointer' }}>
                        <td style={s.td}>
                          <span style={{ fontWeight: 600, color: T.textPrimary, fontSize: 13 }}>{amp.numero_expediente}</span>
                          <div style={s.sub}>{da.tipo_amparo || 'Amparo Indirecto'}</div>
                        </td>
                        <td style={{ ...s.td, color: T.textPrimary, fontSize: 13 }}>{amp.clientes?.nombre_completo ?? '—'}</td>
                        <td style={{ ...s.td, color: T.textMuted,   fontSize: 13 }}>{da.autoridad_responsable ?? '—'}</td>
                        <td style={{ ...s.td, color: T.textMuted,   fontSize: 13 }}>{da.acto_reclamado ?? '—'}</td>
                        <td style={s.td}>
                          <span style={{ color: T.textMuted, fontSize: 13 }}>{amp.juzgados?.nombre ?? '—'}</span>
                          <div style={s.sub}>{amp.juzgados?.ciudad || 'Hidalgo'}</div>
                        </td>
                        <td style={s.td}>
                          {!act ? (
                            <span style={{ ...s.pill, background: T.goldAlpha, color: T.gold, border: '1px solid rgba(212,175,55,0.25)' }}>Resuelto</span>
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

            {/* ── CARDS — mobile (flex column) ── */}
            <div className="amp-mobile" style={{ display: 'none', flexDirection: 'column' as const }}>
              {filtrados.map(amp => {
                const da   = amp.expedientes_amparo?.[0] ?? amp.expedientes_amparo ?? {}
                const pt   = proxTermo(amp.tareas)
                const esH  = pt === hoy
                const venc = pt && pt < hoy
                const act  = activo(amp.estado)
                return (
                  <a key={amp.id} href={`/sistema/expedientes/amparo/detalle?id=${amp.id}`} className="amp-row-link" style={s.rowLink}>
                    <div style={s.avatar}>
                      <span style={{ fontSize: 16, color: T.gold, fontWeight: 'bold' }}>AI</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={s.rowTitulo}>{amp.numero_expediente || 'fsdsdfs'}</span>
                        {!act ? (
                          <span style={{ fontSize: 11, color: T.gold, flexShrink: 0 }}>Resuelto</span>
                        ) : pt ? (
                          <span style={{ fontSize: 11, color: venc ? T.red : esH ? T.amber : T.textFaint, flexShrink: 0 }}>{esH ? 'Hoy' : pt}</span>
                        ) : <span style={{ fontSize: 11, color: T.textFaint }}>2026-06-26</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.textMuted }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: act ? T.green : T.gold, flexShrink: 0 }} />
                        {da.tipo_amparo || 'Indirecto'}
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
                <h2 style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, margin: 0, letterSpacing: '-0.4px' }}>Nuevo Expediente de Amparo</h2>
                <p   style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>Complete el formulario para registrar un nuevo juicio</p>
              </div>
              <button onClick={() => setAbierto(false)} style={s.btnCerrar} aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && <Alerta tipo="error">{error}</Alerta>}

            <form action={manejarSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Seccion titulo="Información del Amparo" icono="📋">
                <div className="amp-row-form" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                  <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Número de Expediente *">
                      <input name="numero_expediente" required style={s.input} placeholder="EJ: 427-2025" />
                    </Campo>
                  </div>
                  <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Fecha de Presentación">
                      <input name="fecha_presentacion" type="date" style={s.input} />
                    </Campo>
                  </div>
                  <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Quejoso *">
                      <input name="quejoso_nombre" required style={s.input} placeholder="Nombre" />
                    </Campo>
                  </div>
                  <div className="amp-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Tipo de Amparo *">
                      <select name="tipo_amparo" required style={s.input} defaultValue="Indirecto">
                        <option>Directo</option>
                        <option>Indirecto</option>
                      </select>
                    </Campo>
                  </div>
                </div>
              </Seccion>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                <button type="button" onClick={() => setAbierto(false)} style={s.btnSec}>Cancelar</button>
                <button type="submit" style={s.btnPrimario}>Crear Amparo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Styles unificados a 1px solid
// ─────────────────────────────────────────────────────────────────────────────
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
    background: T.gold,
    flexShrink: 0,
  },
  btnPrimario: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 16px',
    background: T.gold,
    color: '#0f1828',
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
    background: activo ? T.goldAlpha : 'transparent',
    color:      activo ? T.gold : T.textMuted,
    border:     `1px solid ${activo ? 'rgba(212,175,55,0.40)' : T.border}`,
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
    background: 'rgba(212,175,55,0.08)',
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
}