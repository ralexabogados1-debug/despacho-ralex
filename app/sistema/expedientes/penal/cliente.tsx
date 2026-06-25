'use client'

import { useState } from 'react'
import { crearCausaPenal } from './actions'

// ─── Tokens (rojo vino para Penal) ────────────────────────────────────────
const ACCENT        = '#b3434f'
const ACCENT_ALPHA  = 'rgba(179,67,79,0.10)'
const ACCENT_BORDER = 'rgba(179,67,79,0.40)'

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

  const filtrados = causas.filter(c => {
    const penal = c.expedientes_penales?.[0] ?? {}
    const term  = busqueda.toLowerCase()
    const ok =
      c.numero_expediente?.toLowerCase().includes(term) ||
      c.clientes?.nombre_completo?.toLowerCase().includes(term) ||
      penal.delito?.toLowerCase().includes(term) ||
      penal.numero_carpeta_investigacion?.toLowerCase().includes(term)
    if (!ok) return false
    const pt = proxTermo(c.tareas)
    if (filtroTab === 'activos')    return esActivo(c.estado)
    if (filtroTab === 'concluidos') return c.estado === 'Concluido'
    if (filtroTab === 'termino')    return esActivo(c.estado) && pt !== null && pt >= hoy
    return true
  })

  const cnt = {
    todos:      causas.length,
    activos:    causas.filter(c => esActivo(c.estado)).length,
    concluidos: causas.filter(c => c.estado === 'Concluido').length,
    termino:    causas.filter(c => esActivo(c.estado) && proxTermo(c.tareas) !== null).length,
  }

  async function manejarSubmit(formData: FormData) {
    setError(null)
    const r = await crearCausaPenal(formData)
    if (r?.error) { setError(r.error) }
    else {
      setMensaje('Causa penal creada correctamente.')
      setAbierto(false)
      setTimeout(() => setMensaje(null), 3000)
    }
  }

  return (
    <div style={s.root}>
      <style>{`
        .pen-header   { flex-direction: row; }
        .pen-btn-new  { width: auto; }
        .pen-filtros  { flex-direction: row; }
        .pen-form-row { flex-wrap: wrap; }
        .pen-col-form { flex: 1 1 220px; }
        .pen-busqueda-wrapper { flex: 1 1 200px; width: auto; }

        @media (max-width: 700px) {
          .pen-header   { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .pen-btn-new  { width: 100% !important; justify-content: center !important; }
          .pen-filtros  { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .pen-busqueda-wrapper { width: 100% !important; flex: none !important; }
          .pen-tabs     { width: 100% !important; justify-content: flex-start !important; }
          .pen-tabs button { flex: 1 1 auto; text-align: center; justify-content: center; }
          .pen-col-form { flex: 1 1 100% !important; }
          
          .pen-desktop { display: none !important; }
          .pen-mobile  { display: flex !important; }
        }

        @media (min-width: 701px) {
          .pen-mobile  { display: none !important; }
        }
      `}</style>

      {/* ── ENCABEZADO ── */}
      <div className="pen-header" style={s.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={s.titulo}>Causas Penales</h1>
          <p style={s.subtitulo}>
            <span style={{ ...s.dot, background: ACCENT }} />
            Gestión en materia penal
            &nbsp;·&nbsp;
            <strong style={{ color: T.textPrimary }}>{cnt.todos}</strong> registradas
          </p>
        </div>
        <button onClick={() => setAbierto(true)} className="pen-btn-new" style={{ ...s.btnPrimario, background: ACCENT }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nueva Causa
        </button>
      </div>

      {mensaje && <Alerta tipo="ok">{mensaje}</Alerta>}

      {/* ── FILTROS ── */}
      <div className="pen-filtros" style={s.filtrosRow}>
        <div className="pen-busqueda-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <svg style={s.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por causa, carpeta, cliente o delito..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={s.searchInput}
          />
        </div>

        <div className="pen-tabs" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, flexShrink: 0 }}>
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
              <path d="m14 13-8.5 8.5a2.121 2.121 0 1 1-3-3L11 10"/><path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>
            </svg>
            Sin causas penales con los criterios seleccionados
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="pen-desktop" style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['No. Causa','Cliente / Rol','Delito','Etapa','Juez / MP','Estado','Próx. Término'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(c => {
                    const penal = c.expedientes_penales?.[0] ?? {}
                    const pt    = proxTermo(c.tareas)
                    const esH   = pt === hoy
                    const venc  = pt && pt < hoy
                    const act   = esActivo(c.estado)
                    return (
                      <tr key={c.id} className="pen-row" style={{ cursor: 'pointer' }}>
                        <td style={s.td}>
                          <a href={`/sistema/expedientes/penal/detalle?id=${c.id}`} style={{ fontWeight: 600, color: T.textPrimary, fontSize: 13, textDecoration: 'none' }}>
                            {c.numero_expediente}
                          </a>
                          <div style={s.sub}>Carp: {penal.numero_carpeta_investigacion ?? '—'}</div>
                        </td>
                        <td style={s.td}>
                          <span style={{ color: T.textPrimary, fontSize: 13 }}>{c.clientes?.nombre_completo ?? '—'}</span>
                          <div style={s.sub}>{c.caracter_cliente} · {penal.rol_abogado}</div>
                        </td>
                        <td style={{ ...s.td, color: T.textMuted, fontSize: 13 }}>{penal.delito ?? '—'}</td>
                        <td style={{ ...s.td, color: T.textMuted, fontSize: 13 }}>{penal.estadio_procesal ?? '—'}</td>
                        <td style={s.td}>
                          <span style={{ color: T.textMuted, fontSize: 13 }}>{c.jueces?.nombre ?? '—'}</span>
                          <div style={s.sub}>{penal.ministerios_publicos?.nombre_agencia ?? 'Sin MP'}</div>
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.pill, background: act ? T.greenAlpha : T.goldAlpha, color: act ? T.green : T.gold, border: `1px solid ${act ? 'rgba(74,222,128,0.25)' : 'rgba(212,175,55,0.25)'}` }}>
                            {c.estado}
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
            <div className="pen-mobile" style={{ display: 'none', flexDirection: 'column' as const }}>
              {filtrados.map(c => {
                const penal = c.expedientes_penales?.[0] ?? {}
                const pt    = proxTermo(c.tareas)
                const esH   = pt === hoy
                const venc  = pt && pt < hoy
                const act   = esActivo(c.estado)
                return (
                  <a key={c.id} href={`/sistema/expedientes/penal/detalle?id=${c.id}`} className="pen-row-link" style={s.rowLink}>
                    <div style={{ ...s.avatar, background: ACCENT_ALPHA, color: ACCENT }}>
                      <span style={{ fontSize: 16, fontWeight: 'bold' }}>P</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={s.rowTitulo}>{c.numero_expediente || '—'}</span>
                        {!act ? (
                          <span style={{ fontSize: 11, color: T.gold, flexShrink: 0 }}>Concluido</span>
                        ) : pt ? (
                          <span style={{ fontSize: 11, color: venc ? T.red : esH ? T.amber : T.textFaint, flexShrink: 0 }}>{esH ? 'Hoy' : pt}</span>
                        ) : <span style={{ fontSize: 11, color: T.textFaint }}>—</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.textMuted }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: act ? T.green : T.gold, flexShrink: 0 }} />
                        {penal.delito || 'Sin delito'}
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
                <h2 style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, margin: 0, letterSpacing: '-0.4px' }}>Nueva Causa Penal</h2>
                <p   style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>Complete los campos para el registro del caso</p>
              </div>
              <button onClick={() => setAbierto(false)} style={s.btnCerrar} aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && <Alerta tipo="error">{error}</Alerta>}

            <form action={manejarSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Seccion titulo="Información de la causa" icono="📋">
                <div className="pen-form-row" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Número de causa *">
                      <input name="numero_causa" required style={s.input} placeholder="Ej: 118-2025" />
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="No. Carpeta de Investigación">
                      <input name="numero_carpeta" style={s.input} placeholder="Ej: 05-20-26" />
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Delito *">
                      <input name="delito" required style={s.input} placeholder="Ej: Robo con violencia" />
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Etapa procesal *">
                      <select name="etapa_procesal" required style={s.input} defaultValue="">
                        <option value="" disabled>Seleccionar...</option>
                        <option>Inicial</option>
                        <option>Intermedia</option>
                        <option>Juicio</option>
                      </select>
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Fecha de inicio *">
                      <input name="fecha_inicio" type="date" required style={s.input} />
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Estado">
                      <select name="estado" style={s.input} defaultValue="Activo">
                        <option>Activo</option>
                        <option>Concluido</option>
                      </select>
                    </Campo>
                  </div>
                </div>
              </Seccion>

              <Seccion titulo="Partes involucradas" icono="👥">
                <div className="pen-form-row" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Cliente *">
                      <input name="cliente_nombre" required style={s.input} placeholder="Nombre del cliente" />
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Rol del cliente *">
                      <select name="rol_cliente" required style={s.input} defaultValue="Imputado">
                        <option>Imputado</option>
                        <option>Víctima</option>
                      </select>
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Rol del abogado *">
                      <select name="rol_abogado" required style={s.input} defaultValue="Defensor">
                        <option>Defensor</option>
                        <option>Asesor jurídico</option>
                      </select>
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Contraparte">
                      <input name="contraparte" style={s.input} placeholder="Nombre de la contraparte u ofendido" />
                    </Campo>
                  </div>
                </div>
              </Seccion>

              <Seccion titulo="Información procesal" icono="⚖️">
                <div className="pen-form-row" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Juez asignado *">
                      <select name="juez_id" required style={s.input} defaultValue="">
                        <option value="" disabled>Seleccionar juez</option>
                        {jueces.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                      </select>
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Ministerio Público">
                      <select name="mp_id" style={s.input} defaultValue="">
                        <option value="">Seleccionar MP</option>
                        {ministerios.map((m) => <option key={m.id} value={m.id}>{m.nombre_agencia}</option>)}
                      </select>
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Próx. audiencia (término)">
                      <input name="fecha_limite_termino" type="date" style={s.input} />
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Tipo de audiencia">
                      <select name="plazo_otorgado" style={s.input} defaultValue="">
                        <option value="">Seleccionar...</option>
                        <option>Inicial</option>
                        <option>Vinculación</option>
                        <option>Cautelar</option>
                      </select>
                    </Campo>
                  </div>
                  <div className="pen-col-form" style={{ flex: '1 1 200px' }}>
                    <Campo label="Abogado responsable">
                      <select name="abogado_id" style={s.input} defaultValue="">
                        <option value="">Sin asignar</option>
                        {abogados.map((a) => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                      </select>
                    </Campo>
                  </div>
                </div>
                <Campo label="Descripción / Notas">
                  <textarea name="descripcion" rows={3} style={s.textarea}
                    placeholder="Descripción general del caso..." />
                </Campo>
              </Seccion>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                <button type="button" onClick={() => setAbierto(false)} style={s.btnSec}>Cancelar</button>
                <button type="submit" style={{ ...s.btnPrimario, background: ACCENT }}>Crear causa</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────
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

// ─── Estilos (estructura Amparos, acento rojo) ────────────────────────────
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