// app/calendario/cliente.tsx
'use client'

import { useState } from 'react'
import { crearEventoRapido, actualizarEvento, eliminarEvento } from './actions'

const T = {
  surface:     '#0b1220',
  surfaceLow:  '#0f1828',
  border:      'rgba(255,255,255,0.06)',
  accent:      '#3a5fb8',
  accentAlpha: 'rgba(58,95,184,0.12)',
  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted:   'rgba(255,255,255,0.40)',
  textFaint:   'rgba(255,255,255,0.22)',
  textAccent:  '#8fa8e0',
  red:         '#b3434f',
  redAlpha:    'rgba(179,67,79,0.10)',
}

const COLOR_TIPO: Record<string, { bg: string; text: string; dot: string }> = {
  'Audiencia':       { bg: 'rgba(179,67,79,0.14)',  text: '#e08a93', dot: '#b3434f' },
  'Término':         { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', dot: '#f59e0b' },
  'Tarea/Pendiente': { bg: 'rgba(58,95,184,0.14)',  text: '#8fa8e0', dot: '#3a5fb8' },
}

interface Evento {
  id:         number
  titulo:     string
  fecha:      string
  hora:       string
  tipo:       string
  expediente: string | null
}

export default function CalendarioCliente({
  eventosIniciales,
  expedientes,
}: {
  eventosIniciales: Evento[]
  expedientes: any[]
}) {
  const [abierto, setAbierto]                       = useState(false)
  const [errorForm, setErrorForm]                   = useState<string | null>(null)
  const [filtros, setFiltros]                       = useState({ Audiencia: true, Término: true, 'Tarea/Pendiente': true })
  const [eventoSeleccionado, setEventoSeleccionado] = useState<Evento | null>(null)
  const [fechaBase, setFechaBase]                   = useState(new Date())
  const [fechaSeleccionada, setFechaSeleccionada]   = useState(new Date().toISOString().split('T')[0])

  const anio = fechaBase.getFullYear()
  const mes  = fechaBase.getMonth()

  const obtenerDiasCalendario = () => {
    const primerDiaMes    = new Date(anio, mes, 1)
    const ultimoDiaMes    = new Date(anio, mes + 1, 0)
    const diaSemanaInicio = primerDiaMes.getDay()
    const bloques: { dia: number; fechaCompleta: string; esMesActual: boolean }[] = []

    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const d = new Date(anio, mes, -i)
      bloques.push({ dia: d.getDate(), fechaCompleta: d.toISOString().split('T')[0], esMesActual: false })
    }
    for (let i = 1; i <= ultimoDiaMes.getDate(); i++) {
      const stringDia = String(i).padStart(2, '0')
      const stringMes = String(mes + 1).padStart(2, '0')
      bloques.push({ dia: i, fechaCompleta: `${anio}-${stringMes}-${stringDia}`, esMesActual: true })
    }
    const diasRestantes = 42 - bloques.length
    for (let i = 1; i <= diasRestantes; i++) {
      const d = new Date(anio, mes + 1, i)
      bloques.push({ dia: d.getDate(), fechaCompleta: d.toISOString().split('T')[0], esMesActual: false })
    }
    return bloques
  }

  const diasMes      = obtenerDiasCalendario()
  const mesesNombres = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

  const mesAnterior  = () => setFechaBase(new Date(anio, mes - 1, 1))
  const mesSiguiente = () => setFechaBase(new Date(anio, mes + 1, 1))
  const irAHoy = () => {
    const hoy = new Date()
    setFechaBase(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    setFechaSeleccionada(hoy.toISOString().split('T')[0])
  }

  const eventosFiltrados     = eventosIniciales.filter(e => filtros[e.tipo as keyof typeof filtros])
  const eventosDelDia        = eventosFiltrados.filter(e => e.fecha === fechaSeleccionada)
  const proximoEventoCritico = eventosFiltrados
    .filter(e => e.fecha >= fechaSeleccionada)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0]

  const abrirNuevoEvento = () => {
    setEventoSeleccionado(null)
    setErrorForm(null)
    setAbierto(true)
  }

  const abrirEditarEvento = (ev: Evento, e: React.MouseEvent) => {
    e.stopPropagation()
    setEventoSeleccionado(ev)
    setErrorForm(null)
    setAbierto(true)
  }

  const handleEliminar = async () => {
    if (!eventoSeleccionado) return
    if (confirm('¿Eliminar este evento?')) {
      const res = await eliminarEvento(eventoSeleccionado.id)
      if (res?.error) setErrorForm(res.error)
      else setAbierto(false)
    }
  }

  const expedientePreseleccionado = expedientes.find(
    ex => ex.numero_expediente === eventoSeleccionado?.expediente
  )?.id ?? ''

  const obtenerHora24 = (horaStr: string) => {
    if (!horaStr) return '10:00'
    const [tiempo, ampm] = horaStr.split(' ')
    const [hrs, mins]    = tiempo.split(':')
    let horas            = parseInt(hrs, 10)
    if (ampm === 'pm' && horas < 12) horas += 12
    if (ampm === 'am' && horas === 12) horas = 0
    return `${String(horas).padStart(2, '0')}:${mins}`
  }

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 40px)', color: T.textPrimary, width: '100%', boxSizing: 'border-box' }}>

      {/* ✅ display de celda-dot y celda-texto controlado SOLO por CSS, nunca por inline style */}
      <style>{`
        .cal-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 24px;
          align-items: start;
        }
        .celda-dia    { height: 100px; }
        .celda-texto  { display: flex; flex-direction: column; gap: 2px; overflow: hidden; flex: 1; min-height: 0; }
        .celda-dot    { display: none; gap: 3px; margin-top: 2px; flex-wrap: wrap; }
        .panel-lateral { display: flex; }

        @media (max-width: 1024px) {
          .cal-grid      { grid-template-columns: 1fr; }
          .panel-lateral { order: -1; }
        }
        @media (max-width: 640px) {
          .cal-grid     { gap: 16px; }
          .celda-dia    { height: 56px !important; padding: 4px !important; }
          .celda-texto  { display: none !important; }
          .celda-dot    { display: flex !important; }
          .dow-label    { font-size: 9px !important; padding: 6px 2px !important; }
        }
      `}</style>

      <div className="cal-grid">

        {/* ── CALENDARIO MENSUAL ── */}
        <div style={{ minWidth: 0 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'clamp(18px, 3vw, 26px)', margin: 0, fontWeight: 700, letterSpacing: '-0.5px', textTransform: 'capitalize' }}>
              {mesesNombres[mes]} <span style={{ color: T.textMuted, fontWeight: 400 }}>{anio}</span>
            </h1>
            <div style={{ display: 'flex', gap: 4, background: T.surfaceLow, padding: 4, borderRadius: 8, border: `0.5px solid ${T.border}`, flexShrink: 0 }}>
              <button onClick={mesAnterior}  style={css.btnNav}>‹</button>
              <button onClick={irAHoy}       style={{ ...css.btnNav, fontSize: 12, padding: '0 12px', fontWeight: 500 }}>Hoy</button>
              <button onClick={mesSiguiente} style={css.btnNav}>›</button>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {Object.keys(filtros).map((tipo) => {
              const activo    = filtros[tipo as keyof typeof filtros]
              const colorData = COLOR_TIPO[tipo] || { dot: '#fff' }
              return (
                <button
                  key={tipo}
                  onClick={() => setFiltros(f => ({ ...f, [tipo]: !f[tipo as keyof typeof f] }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', flexShrink: 0,
                    background: activo ? T.surfaceLow : 'transparent',
                    border: `0.5px solid ${activo ? T.border : 'transparent'}`,
                    borderRadius: 20, color: activo ? T.textPrimary : T.textMuted,
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorData.dot, flexShrink: 0 }} />
                  {tipo}
                </button>
              )
            })}
          </div>

          {/* Rejilla */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1, background: T.border, borderRadius: 12,
            overflow: 'hidden', border: `0.5px solid ${T.border}`,
          }}>
            {['dom','lun','mar','mié','jue','vie','sáb'].map(d => (
              <div key={d} className="dow-label" style={{
                padding: '10px 4px', background: '#08101e',
                textAlign: 'center', fontSize: 11,
                color: T.textMuted, fontWeight: 600, textTransform: 'uppercase',
              }}>
                {d}
              </div>
            ))}

            {diasMes.map((dm, idx) => {
              const eventosDia     = eventosFiltrados.filter(e => e.fecha === dm.fechaCompleta)
              const esSeleccionado = fechaSeleccionada === dm.fechaCompleta
              const esHoy          = dm.fechaCompleta === new Date().toISOString().split('T')[0]

              return (
                <div
                  key={idx}
                  className="celda-dia"
                  onClick={() => setFechaSeleccionada(dm.fechaCompleta)}
                  style={{
                    padding: 6,
                    background: esSeleccionado ? T.accentAlpha : dm.esMesActual ? T.surface : '#06090f',
                    cursor: 'pointer', opacity: dm.esMesActual ? 1 : 0.35,
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  }}
                >
                  {/* Número del día */}
                  <div style={{
                    fontSize: 12, fontWeight: 600, marginBottom: 4, flexShrink: 0,
                    color: esSeleccionado ? T.textAccent : esHoy ? T.textAccent : T.textPrimary,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {esHoy && <span style={{ width: 4, height: 4, borderRadius: '50%', background: T.textAccent }} />}
                    {dm.dia}
                  </div>

                  {/* ✅ Texto — visible en desktop, oculto en mobile por CSS */}
                  <div className="celda-texto">
                    {eventosDia.slice(0, 2).map(ev => {
                      const c = COLOR_TIPO[ev.tipo] || { bg: T.surfaceLow, text: '#fff' }
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => abrirEditarEvento(ev, e)}
                          title={`${ev.hora ? ev.hora + ' — ' : ''}${ev.titulo}`}
                          style={{
                            background: c.bg, color: c.text,
                            padding: '2px 5px', borderRadius: 4,
                            fontSize: 10, fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', flexShrink: 0,
                          }}
                        >
                          {ev.hora ? `${ev.hora} ` : ''}{ev.titulo}
                        </div>
                      )
                    })}
                    {eventosDia.length > 2 && (
                      <div style={{ fontSize: 9, color: T.textFaint, fontWeight: 500 }}>
                        +{eventosDia.length - 2} más
                      </div>
                    )}
                  </div>

                  {/* ✅ Puntos — ocultos en desktop, visibles en mobile por CSS */}
                  {/* SIN display en inline style — lo controla únicamente el CSS */}
                  <div className="celda-dot">
                    {eventosDia.slice(0, 3).map(ev => {
                      const c = COLOR_TIPO[ev.tipo] || { dot: '#fff' }
                      return (
                        <span
                          key={ev.id}
                          style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }}
                        />
                      )
                    })}
                  </div>

                </div>
              )
            })}
          </div>
        </div>

        {/* ── PANEL LATERAL ── */}
        <div className="panel-lateral" style={{
          background: T.surface, border: `0.5px solid ${T.border}`,
          borderRadius: 16, padding: 20,
          flexDirection: 'column', gap: 20, height: 'fit-content',
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: 0, fontWeight: 600 }}>Agenda del día</h3>
              <span style={{ fontSize: 12, color: T.textMuted }}>
                {new Date(fechaSeleccionada + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {eventosDelDia.length === 0 ? (
                <div style={css.cajaVacia}>No hay citas programadas</div>
              ) : (
                eventosDelDia.map(e => {
                  const c = COLOR_TIPO[e.tipo] || { text: '#fff', dot: '#fff' }
                  return (
                    <div
                      key={e.id}
                      onClick={(evt) => abrirEditarEvento(e, evt)}
                      style={{
                        background: T.surfaceLow, border: `0.5px solid ${T.border}`,
                        borderRadius: 10, padding: 12, cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: c.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} />
                          {e.tipo}
                        </span>
                        {e.hora && <span style={{ fontSize: 11, color: T.textMuted }}>{e.hora}</span>}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 5, fontWeight: 500 }}>{e.titulo}</div>
                      {e.expediente && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>Exp. {e.expediente}</div>}
                    </div>
                  )
                })
              )}
            </div>

            <h3 style={{ fontSize: 13, margin: '0 0 10px', fontWeight: 600 }}>Urgente / Próximo</h3>
            {proximoEventoCritico ? (
              <div
                onClick={(evt) => abrirEditarEvento(proximoEventoCritico, evt)}
                style={{
                  background: T.redAlpha, border: '0.5px solid rgba(179,67,79,0.22)',
                  borderRadius: 12, padding: 14, display: 'flex', gap: 12, cursor: 'pointer',
                }}
              >
                <div style={{
                  background: 'rgba(179,67,79,0.15)', color: T.red,
                  padding: '6px 10px', borderRadius: 8,
                  textAlign: 'center', minWidth: 32, flexShrink: 0,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{proximoEventoCritico.fecha.split('-')[2]}</div>
                  <div style={{ fontSize: 9, textTransform: 'uppercase' }}>
                    {mesesNombres[new Date(proximoEventoCritico.fecha + 'T00:00:00').getMonth()].substring(0, 3)}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{proximoEventoCritico.titulo}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {proximoEventoCritico.tipo}{proximoEventoCritico.hora ? ` · ${proximoEventoCritico.hora}` : ''}
                  </div>
                </div>
              </div>
            ) : (
              <div style={css.cajaVacia}>Sin términos próximos</div>
            )}
          </div>

          <button onClick={abrirNuevoEvento} style={css.btnPrimary}>
            + Nuevo Evento
          </button>
        </div>
      </div>

      {/* ── MODAL ── */}
      {abierto && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.75)',
            backdropFilter: 'blur(4px)', display: 'flex',
            alignItems: 'flex-start', justifyContent: 'center',
            padding: '24px 16px', overflowY: 'auto', zIndex: 100,
          }}
          onClick={() => setAbierto(false)}
        >
          <div
            style={{
              background: T.surface, border: `0.5px solid ${T.border}`,
              borderRadius: 16, padding: 'clamp(20px, 5vw, 28px)',
              width: '100%', maxWidth: 420, marginTop: 20,
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>
              {eventoSeleccionado ? 'Editar Evento' : 'Agendar Evento'}
            </h3>
            <p style={{ color: T.textMuted, fontSize: 12, marginTop: 0, marginBottom: 20 }}>
              {eventoSeleccionado ? 'Modifica los parámetros guardados.' : 'Rellena la información del hito procesal.'}
            </p>

            {errorForm && (
              <p style={{ color: T.red, background: T.redAlpha, padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                {errorForm}
              </p>
            )}

            <form action={async (fd) => {
              setErrorForm(null)
              const res = eventoSeleccionado
                ? await actualizarEvento(eventoSeleccionado.id, fd)
                : await crearEventoRapido(fd)
              if (res?.error) setErrorForm(res.error)
              else setAbierto(false)
            }}>

              <div style={{ marginBottom: 14 }}>
                <label style={css.label}>Categoría</label>
                <select name="tipo_evento" defaultValue={eventoSeleccionado?.tipo ?? 'Audiencia'} style={css.input}>
                  <option>Audiencia</option>
                  <option>Término</option>
                  <option>Tarea/Pendiente</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={css.label}>Título del evento *</label>
                <input
                  name="descripcion" required
                  defaultValue={eventoSeleccionado?.titulo ?? ''}
                  style={css.input}
                  placeholder="Ej: Audiencia constitucional"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={css.label}>Fecha y hora *</label>
                <input
                  name="fecha_hora" type="datetime-local" required
                  defaultValue={eventoSeleccionado
                    ? `${eventoSeleccionado.fecha}T${obtenerHora24(eventoSeleccionado.hora)}`
                    : `${fechaSeleccionada}T10:00`}
                  style={css.input}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={css.label}>Expediente asociado</label>
                <select name="expediente_id" defaultValue={expedientePreseleccionado} style={css.input}>
                  <option value="">Ninguno</option>
                  {expedientes.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.numero_expediente}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {eventoSeleccionado && (
                    <button type="button" onClick={handleEliminar}
                      style={{ background: 'transparent', color: T.red, border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                      Eliminar
                    </button>
                  )}
                  <button type="button" onClick={() => setAbierto(false)}
                    style={{ background: 'transparent', color: T.textMuted, border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                    Cancelar
                  </button>
                </div>
                <button type="submit" style={{ ...css.btnPrimary, width: 'auto', padding: '10px 24px' }}>
                  {eventoSeleccionado ? 'Guardar' : 'Agendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const css = {
  btnNav: {
    background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.85)', padding: '6px 10px',
    borderRadius: 6, cursor: 'pointer', fontSize: 14,
  } as React.CSSProperties,

  btnPrimary: {
    width: '100%', padding: '11px', background: '#3a5fb8',
    color: 'white', border: 'none', borderRadius: 10,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,

  cajaVacia: {
    border: '0.5px dashed rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.40)', padding: 20,
    textAlign: 'center' as const, borderRadius: 10, fontSize: 12,
  } as React.CSSProperties,

  label: {
    display: 'block', fontSize: 12,
    color: 'rgba(255,255,255,0.40)', marginBottom: 6, fontWeight: 500,
  } as React.CSSProperties,

  input: {
    width: '100%', padding: '10px 12px',
    border: '0.5px solid rgba(255,255,255,0.06)',
    borderRadius: 8, background: '#0f1828',
    color: 'rgba(255,255,255,0.85)', fontSize: 14,
    boxSizing: 'border-box' as const, outline: 'none',
  } as React.CSSProperties,
}