'use client'

import { useState } from 'react'
import { useExpedientes } from '@/hooks/useExpedientes'
import { useTema } from '@/app/sistema/layout' // ajusta la ruta si es necesario

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
}: {
  juzgados: Juzgado[]
  abogados: Abogado[]
  amparos:  any[]
}) {
  const { oscuro } = useTema()
  const T = oscuro ? T_DARK : T_LIGHT

  // 🔄 Hook offline-first — guarda en SQLite + cola de sync automáticamente
  const { guardar: guardarAmparo, isOnline } = useExpedientes('expedientes_amparo')

  const [abierto,    setAbierto]    = useState(false)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroTab,  setFiltroTab]  = useState<'todos' | 'tramite' | 'termino' | 'resueltos'>('todos')
  const [mensaje,    setMensaje]    = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [guardando,  setGuardando]  = useState(false)

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

  // ─────────────────────────────────────────────────────────────────────────
  // 🔄 Crear amparo — funciona online y offline vía SQLite + sync_queue
  // Genera ID temporal local (negativo) si está offline; el sync lo resuelve
  // ─────────────────────────────────────────────────────────────────────────
  async function manejarSubmit(formData: FormData) {
    setError(null)
    setGuardando(true)
    try {
      const idTemporal = -Date.now() // ID temporal único mientras no hay red

      // 1. Cliente (Quejoso) — usa el hook de clientes si lo tienes, o inserción directa
      //    Aquí asumimos que el id de cliente se resuelve igual con id temporal
      const clienteIdTemporal = -(Date.now() + 1)

      // 2. Expediente base
      await guardarAmparo({
        id:                 idTemporal,
        numero_expediente:  formData.get('numero_expediente') as string,
        fecha_inicio:       (formData.get('fecha_presentacion') as string) || null,
        materia_id:         null, // se resuelve en sync si tu backend lo requiere por nombre
        cliente_id:         clienteIdTemporal,
        juzgado_id:         Number(formData.get('juzgado_id')) || null,
        estado:             'Activo',
        descripcion:        (formData.get('descripcion') as string) || null,
      })

      // 3. Datos específicos de amparo (tabla hija) — incluye campos nuevos
      await guardarAmparo({
        expediente_id:          idTemporal,
        tipo_amparo:            formData.get('tipo_amparo') as string,
        autoridad_responsable:  formData.get('autoridad_responsable') as string,
        acto_reclamado:         formData.get('acto_reclamado') as string,
        tercero_interesado:     (formData.get('tercero_interesado') as string) || null,
        estadio_procesal:       (formData.get('estadio_procesal') as string) || null,
        proxima_audiencia:      (formData.get('proxima_audiencia') as string) || null,
      })

      setMensaje('Juicio de amparo registrado de manera exitosa.')
      setAbierto(false)
      setTimeout(() => setMensaje(null), 3000)
    } catch (e) {
      console.error(e)
      setError('Error al guardar el amparo: ' + String(e))
    } finally {
      setGuardando(false)
    }
  }

  const s = getStyles(T, oscuro)

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

      {/* ── ENCABEZADO ── */}
      <div className="amp-header" style={s.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={s.titulo}>Expedientes de Amparo</h1>
          <p style={s.subtitulo}>
            <span style={s.dot} />
            Gestión de juicios de amparo
            &nbsp;·&nbsp;
            <strong style={{ color: T.textPrimary }}>{cnt.todos}</strong> registrados
            {!isOnline && <span style={{ color: T.gold, marginLeft: 8 }}>· Sin conexión</span>}
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
                    {['No. Expediente','Quejoso','Autoridad Responsable','Acto Reclamado','Juzgado Fed.','Estadio Procesal','Próx. Término'].map(h => (
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
                  </a>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL — centrado, con altura máxima y scroll interno ── */}
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
                    {/* 🆕 Campos nuevos detectados en la app anterior */}
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
                  </div>
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (ahora reciben T y oscuro)
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

// ─────────────────────────────────────────────────────────────────────────────
// Función generadora de estilos dinámica
// ─────────────────────────────────────────────────────────────────────────────
const getStyles = (T: typeof T_DARK, oscuro: boolean) => ({
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
  },
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
    background: T.surfaceLow,
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
  },
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
  },
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