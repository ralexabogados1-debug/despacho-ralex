// app/(sistema)/calendario/cliente.tsx
'use client'

import { useState } from 'react'
import { crearEventoRapido, actualizarEvento, eliminarEvento } from './actions'

const TARJETA = '#0b0f19'
const BORDE = '#1f293d'
const ACCENTO = '#3b82f6'
const TEXTO_TENUE = '#9ca3af'
const INPUT_BG = '#111827'

const COLOR_TIPO: Record<string, { bg: string; text: string; dot: string }> = {
  'Audiencia': { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171', dot: '#ef4444' },
  'Término': { bg: 'rgba(245, 158, 11, 0.1)', text: '#fbbf24', dot: '#f59e0b' },
  'Tarea/Pendiente': { bg: 'rgba(59, 130, 246, 0.1)', text: '#60a5fa', dot: '#3b82f6' }
}

interface Evento {
  id: number
  titulo: string
  fecha: string
  hora: string
  tipo: string 
  expediente: string | null
}

export default function CalendarioCliente({ eventosIniciales, expedientes }: { eventosIniciales: Evento[], expedientes: any[] }) {
  const [abierto, setAbierto] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [filtros, setFiltros] = useState({ Audiencia: true, Término: true, 'Tarea/Pendiente': true })
  const [eventoSeleccionado, setEventoSeleccionado] = useState<Evento | null>(null)

  const [fechaBase, setFechaBase] = useState(new Date(2026, 5, 1)) 
  const [fechaSeleccionada, setFechaSeleccionada] = useState('2026-06-04')

  const anio = fechaBase.getFullYear()
  const mes = fechaBase.getMonth()

  const obtenerDiasCalendario = () => {
    const primerDiaMes = new Date(anio, mes, 1)
    const ultimoDiaMes = new Date(anio, mes + 1, 0)
    const diaSemanaInicio = primerDiaMes.getDay() 
    const bloques = []

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

  const diasMes = obtenerDiasCalendario()
  const mesesNombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

  const mesAnterior = () => setFechaBase(new Date(anio, mes - 1, 1))
  const mesSiguiente = () => setFechaBase(new Date(anio, mes + 1, 1))
  const irAHoy = () => {
    const hoy = new Date()
    setFechaBase(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    setFechaSeleccionada(hoy.toISOString().split('T')[0])
  }

  const eventosFiltrados = eventosIniciales.filter(e => filtros[e.tipo as keyof typeof filtros])
  const eventosDelDia = eventosFiltrados.filter(e => e.fecha === fechaSeleccionada)
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
    if (confirm('¿Estás seguro de que deseas eliminar este evento de la agenda?')) {
      const res = await eliminarEvento(eventoSeleccionado.id)
      if (res?.error) setErrorForm(res.error)
      else setAbierto(false)
    }
  }

  const expedientePreseleccionado = expedientes.find(ex => ex.numero_expediente === eventoSeleccionado?.expediente)?.id ?? ""

  const obtenerHora24 = (horaStr: string) => {
    if (!horaStr) return "10:00"
    const [tiempo, ampm] = horaStr.split(' ')
    let [hrs, mins] = tiempo.split(':')
    let horas = parseInt(hrs, 10)
    if (ampm === 'pm' && horas < 12) horas += 12
    if (ampm === 'am' && horas === 12) horas = 0
    return `${String(horas).padStart(2, '0')}:${mins}`
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, color: 'white' }}>
      
      {/* SECCIÓN IZQUIERDA: CUADRÍCULA MENSUAL */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <h1 style={{ fontSize: 26, margin: 0, fontWeight: 700, letterSpacing: '-0.5px', textTransform: 'capitalize' }}>
              {mesesNombres[mes]} <span style={{ color: TEXTO_TENUE, fontWeight: 400 }}>{anio}</span>
            </h1>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.keys(filtros).map((tipo) => {
                const activo = filtros[tipo as keyof typeof filtros]
                const colorData = COLOR_TIPO[tipo] || { dot: '#fff' }
                return (
                  <button 
                    key={tipo}
                    onClick={() => setFiltros(f => ({ ...f, [tipo]: !f[tipo as keyof typeof f] }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                      background: activo ? '#1e293b' : 'transparent',
                      border: `1px solid ${activo ? BORDE : 'transparent'}`,
                      borderRadius: 20, color: activo ? 'white' : TEXTO_TENUE,
                      cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorData.dot }} />
                    {tipo}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, background: INPUT_BG, padding: 4, borderRadius: 8, border: `1px solid ${BORDE}` }}>
            <button onClick={mesAnterior} style={btnNavStyle}>&lt;</button>
            <button onClick={irAHoy} style={{ ...btnNavStyle, fontSize: 12, padding: '0 12px', fontWeight: 500 }}>Hoy</button>
            <button onClick={mesSiguiente} style={btnNavStyle}>&gt;</button>
          </div>
        </div>

        {/* REJILLA DE DÍAS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: BORDE, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDE}` }}>
          {['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'].map(d => (
            <div key={d} style={{ padding: '12px 10px', background: '#090d16', textAlign: 'center', fontSize: 11, color: TEXTO_TENUE, fontWeight: 600, textTransform: 'uppercase' }}>
              {d}
            </div>
          ))}

          {diasMes.map((dm, idx) => {
            const eventosDia = eventosFiltrados.filter(e => e.fecha === dm.fechaCompleta)
            const esSeleccionado = fechaSeleccionada === dm.fechaCompleta

            return (
              <div 
                key={idx} 
                onClick={() => setFechaSeleccionada(dm.fechaCompleta)}
                style={{ 
                  minHeight: 115, padding: 10, 
                  background: esSeleccionado ? '#111c30' : dm.esMesActual ? TARJETA : '#06090f',
                  cursor: 'pointer', opacity: dm.esMesActual ? 1 : 0.35, position: 'relative'
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: esSeleccionado ? ACCENTO : 'white', marginBottom: 8 }}>
                  {dm.dia}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {eventosDia.slice(0, 3).map(ev => {
                    const c = COLOR_TIPO[ev.tipo] || { bg: '#1e293b', text: '#fff' }
                    return (
                      <div 
                        key={ev.id} 
                        onClick={(e) => abrirEditarEvento(ev, e)}
                        title="Haz clic para editar este evento"
                        style={{ 
                          background: c.bg, color: c.text, padding: '4px 8px', borderRadius: 6, 
                          fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap', transition: 'transform 0.1s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        {ev.hora ? `${ev.hora} ` : ''}{ev.titulo}
                      </div>
                    )
                  })}
                  {eventosDia.length > 3 && (
                    <div style={{ fontSize: 9, color: TEXTO_TENUE, textAlign: 'right', fontWeight: 500 }}>
                      +{eventosDia.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* BARRA LATERAL DERECHA (PANELES) */}
      <div style={{ background: TARJETA, border: `1px solid ${BORDE}`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 24, height: 'fit-content' }}>
        
        <div>
          <h3 style={{ fontSize: 15, margin: '0 0 4px', fontWeight: 600 }}>Agenda del día</h3>
          <p style={{ color: TEXTO_TENUE, fontSize: 12, marginTop: 0, marginBottom: 20 }}>
            {new Date(fechaSeleccionada + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {eventosDelDia.length === 0 ? (
              <div style={cajaVaciaStyle}>No hay citas programadas</div>
            ) : (
              eventosDelDia.map(e => {
                const c = COLOR_TIPO[e.tipo] || { text: '#fff', dot: '#fff' }
                return (
                  <div 
                    key={e.id} 
                    onClick={(evt) => abrirEditarEvento(e, evt)} 
                    style={{ background: INPUT_BG, border: `1px solid ${BORDE}`, borderRadius: 10, padding: 14, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: c.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} /> {e.tipo}
                      </span>
                      {e.hora && <span style={{ fontSize: 11, color: TEXTO_TENUE }}>{e.hora}</span>}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 6, fontWeight: 500 }}>{e.titulo}</div>
                    {e.expediente && <div style={{ fontSize: 11, color: TEXTO_TENUE, marginTop: 4 }}>Exp. {e.expediente}</div>}
                  </div>
                )
              })
            )}
          </div>

          <h3 style={{ fontSize: 14, margin: '0 0 12px', fontWeight: 600 }}>Urgente / Próximo</h3>
          {proximoEventoCritico ? (
            <div 
              onClick={(evt) => abrirEditarEvento(proximoEventoCritico, evt)}
              style={{ background: 'linear-gradient(145deg, #1e1b1b, #111827)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 14, display: 'flex', gap: 12, cursor: 'pointer' }}
            >
              <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '6px 12px', borderRadius: 8, height: 'fit-content', textAlign: 'center', minWidth: 32 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{proximoEventoCritico.fecha.split('-')[2]}</div>
                <div style={{ fontSize: 9, textTransform: 'uppercase' }}>{mesesNombres[new Date(proximoEventoCritico.fecha + 'T00:00:00').getMonth()].substring(0,3)}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{proximoEventoCritico.titulo}</div>
                <div style={{ fontSize: 11, color: TEXTO_TENUE, marginTop: 2 }}>{proximoEventoCritico.tipo} {proximoEventoCritico.hora ? `· ${proximoEventoCritico.hora}` : ''}</div>
              </div>
            </div>
          ) : (
            <div style={cajaVaciaStyle}>Sin términos próximos</div>
          )}
        </div>

        <button onClick={abrirNuevoEvento} style={btnPrincipalStyle}>
          + Nuevo Evento
        </button>
      </div>

      {/* MODAL GLOBAL SUPERPUESTO */}
      {abierto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setAbierto(false)}>
          <div style={{ background: TARJETA, border: `1px solid ${BORDE}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>
              {eventoSeleccionado ? 'Editar Evento' : 'Agendar Evento'}
            </h3>
            <p style={{ color: TEXTO_TENUE, fontSize: 12, marginTop: 0, marginBottom: 20 }}>
              {eventoSeleccionado ? 'Modifica los parámetros guardados de la cita.' : 'Rellena la información del hito procesal.'}
            </p>
            
            {errorForm && <p style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{errorForm}</p>}

            <form action={async (fd) => { 
              setErrorForm(null)
              let res
              if (eventoSeleccionado) {
                res = await actualizarEvento(eventoSeleccionado.id, fd)
              } else {
                res = await crearEventoRapido(fd)
              }
              
              if (res?.error) setErrorForm(res.error) 
              else setAbierto(false)
            }}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Categoría</label>
                <select name="tipo_evento" defaultValue={eventoSeleccionado?.tipo ?? "Audiencia"} style={inputStyle}>
                  <option>Audiencia</option>
                  <option>Término</option>
                  <option>Tarea/Pendiente</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Título del evento *</label>
                <input name="descripcion" required defaultValue={eventoSeleccionado?.titulo ?? ""} style={inputStyle} placeholder="Ej: Audiencia constitucional" />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Fecha y Hora pactada *</label>
                <input 
                  name="fecha_hora" 
                  type="datetime-local" 
                  required
                  defaultValue={eventoSeleccionado ? `${eventoSeleccionado.fecha}T${obtenerHora24(eventoSeleccionado.hora)}` : `${fechaSeleccionada}T10:00`} 
                  style={inputStyle} 
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Expediente Asociado</label>
                <select name="expediente_id" defaultValue={expedientePreseleccionado} style={inputStyle}>
                  <option value="">Ninguno (Asunto General)</option>
                  {expedientes.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.numero_expediente}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {eventoSeleccionado && (
                    <button type="button" onClick={handleEliminar} style={{ background: 'transparent', color: '#f87171', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, marginRight: 10 }}>
                      Eliminar
                    </button>
                  )}
                  <button type="button" onClick={() => setAbierto(false)} style={{ background: 'transparent', color: TEXTO_TENUE, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                    Cancelar
                  </button>
                </div>
                <button type="submit" style={{ ...btnPrincipalStyle, width: 'auto', padding: '10px 24px' }}>
                  {eventoSeleccionado ? 'Guardar Cambios' : 'Agendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const btnNavStyle: React.CSSProperties = { background: 'transparent', border: 'none', color: 'white', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: TEXTO_TENUE, marginBottom: 6, fontWeight: 500 }
const cajaVaciaStyle: React.CSSProperties = { border: `1px solid ${BORDE}`, borderStyle: 'dashed', color: TEXTO_TENUE, padding: 24, textAlign: 'center', borderRadius: 10, fontSize: 12 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDE}`, borderRadius: 8, background: INPUT_BG, color: 'white', fontSize: 14, boxSizing: 'border-box', outline: 'none' }
const btnPrincipalStyle: React.CSSProperties = { width: '100%', padding: '12px', background: ACCENTO, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }