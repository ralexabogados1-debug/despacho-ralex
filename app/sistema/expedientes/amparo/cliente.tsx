// app/expedientes/amparo/cliente.tsx
'use client'

import { useState } from 'react'
import { crearExpedienteAmparo } from './actions'

// Paleta alineada con el dashboard — Amparos usa dorado como color distintivo
const TARJETA = '#0b1220'
const BORDE = '#1c2940'
const GOLD = '#d4af37'
const GOLD_ALPHA = 'rgba(212,175,55,0.10)'
const TEXTO_TENUE = '#7e8ba3'
const CAMPO_BG = '#0f1830'

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
    if (!tareas || tareas.length === 0) return null
    const pendientes = tareas
      .filter((t) => !t.completada && t.fecha_vencimiento)
      .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
    return pendientes[0] ? pendientes[0].fecha_vencimiento : null
  }

  // --- FILTROS DE PESTAÑAS (WIREFRAME image_817f84.png) ---
  const amparosFiltrados = amparos.filter((amp) => {
    const dataAmp = amp.expedientes_amparo?.[0] ?? amp.expedientes_amparo ?? {}
    const term = busqueda.toLowerCase()

    const matchesSearch =
      amp.numero_expediente?.toLowerCase().includes(term) ||
      amp.clientes?.nombre_completo?.toLowerCase().includes(term) ||
      dataAmp.autoridad_responsable?.toLowerCase().includes(term) ||
      dataAmp.acto_reclamado?.toLowerCase().includes(term)

    if (!matchesSearch) return false

    const proxTermino = obtenerProximoTermino(amp.tareas)
    const hoy = new Date().toISOString().split('T')[0]

    if (filtroTab === 'tramite') return amp.estado === 'Activo' || amp.estado === 'En trámite'
    if (filtroTab === 'resueltos') return amp.estado === 'Resuelto' || amp.estado === 'Concluido'
    if (filtroTab === 'termino') {
      return (amp.estado === 'Activo' || amp.estado === 'En trámite') && proxTermino !== null && proxTermino >= hoy
    }
    return true
  })

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
    <>
      {/* HEADER DE CONTROL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: 'white', fontSize: 28, margin: 0 }}>Expedientes de Amparo</h1>
          <p style={{ color: TEXTO_TENUE, margin: '4px 0 0' }}>
            Gestión de juicios de amparo · {amparosFiltrados.length} registrados
          </p>
        </div>
        <button onClick={() => setAbierto(true)} style={{ padding: '12px 20px', background: GOLD, color: '#412402', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          + Nuevo Amparo
        </button>
      </div>

      {mensaje && <p style={{ color: '#8affa8', background: '#13301d', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{mensaje}</p>}

      {/* FILTROS SUPERIORES DE TABLA */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Buscar por expediente, quejoso, autoridad..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ ...inputStyle, width: '310px', margin: 0 }}
        />

        <button onClick={() => setFiltroTab('todos')} style={tabStyle(filtroTab === 'todos')}>Todos ({amparos.length})</button>
        <button onClick={() => setFiltroTab('tramite')} style={tabStyle(filtroTab === 'tramite')}>En trámite</button>
        <button onClick={() => setFiltroTab('termino')} style={tabStyle(filtroTab === 'termino')}>Con término próximo</button>
        <button onClick={() => setFiltroTab('resueltos')} style={tabStyle(filtroTab === 'resueltos')}>Resueltos</button>
      </div>

      {/* RENDERIZADO DE LA TABLA */}
      <div style={{ background: TARJETA, border: `1px solid ${BORDE}`, borderRadius: 12, padding: 24, overflowX: 'auto' }}>
        {amparosFiltrados.length === 0 ? (
          <p style={{ color: TEXTO_TENUE, margin: 0 }}>No hay amparos que coincidan con la selección.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: TEXTO_TENUE, fontSize: 12, textTransform: 'uppercase' }}>
                <th style={thStyle}>No. Expediente</th>
                <th style={thStyle}>Quejoso</th>
                <th style={thStyle}>Autoridad Responsable</th>
                <th style={thStyle}>Acto Reclamado</th>
                <th style={thStyle}>Juzgado Fed.</th>
                <th style={thStyle}>Próx. Término</th>
              </tr>
            </thead>
            <tbody>
              {amparosFiltrados.map((amp) => {
                const dataAmp = amp.expedientes_amparo?.[0] ?? amp.expedientes_amparo ?? {}
                const proxTerm = obtenerProximoTermino(amp.tareas)
                const esHoy = proxTerm === new Date().toISOString().split('T')[0]

                return (
                  <tr key={amp.id} style={{ color: 'white' }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{amp.numero_expediente}</span>
                      <div style={subTexto}>{dataAmp.tipo_amparo || 'Amparo Indirecto'}</div>
                    </td>
                    <td style={tdStyle}>{amp.clientes?.nombre_completo ?? '—'}</td>
                    <td style={tdStyle}>{dataAmp.autoridad_responsable ?? '—'}</td>
                    <td style={tdStyle}>{dataAmp.acto_reclamado ?? '—'}</td>
                    <td style={tdStyle}>
                      {amp.juzgados?.nombre ?? '—'}
                      <div style={subTexto}>{amp.juzgados?.ciudad || 'Hidalgo'}</div>
                    </td>
                    <td style={tdStyle}>
                      {amp.estado === 'Resuelto' || amp.estado === 'Concluido' ? (
                        <span style={{ color: TEXTO_TENUE }}>Resuelto</span>
                      ) : proxTerm ? (
                        <span style={{ color: esHoy ? '#e8a3a3' : 'white', fontWeight: esHoy ? 'bold' : 'normal' }}>
                          {esHoy ? '⚠️ Hoy' : proxTerm}
                        </span>
                      ) : (
                        <span style={{ color: TEXTO_TENUE }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* FORMULARIO MODAL (WIREFRAME image_817cc1.png) */}
      {abierto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto', zIndex: 50 }} onClick={() => setAbierto(false)}>
          <div style={{ background: TARJETA, border: `1px solid ${BORDE}`, borderRadius: 14, padding: 32, width: '100%', maxWidth: 840, marginTop: 20 }} onClick={(ev) => ev.stopPropagation()}>
            <h2 style={{ color: 'white', fontSize: 24, margin: '4px 0 2px' }}>Nuevo Expediente de Amparo</h2>
            <p style={{ color: TEXTO_TENUE, fontSize: 13, marginTop: 0, marginBottom: 20 }}>Complete el formulario para registrar un nuevo juicio de amparo</p>

            {error && <p style={{ color: '#ff8a8a', background: '#3a1a1a', padding: '10px 12px', borderRadius: 6, fontSize: 14 }}>{error}</p>}

            <form action={manejarSubmit}>

              {/* BLOQUE 1: INFORMACIÓN DEL AMPARO */}
              <div style={seccionStyle}>
                <div style={seccionTitulo}>Información del Amparo</div>
                <div style={grid2}>
                  <Campo label="Número de Expediente ***">
                    <input name="numero_expediente" required style={inputStyle} placeholder="EJ: 427-2025" />
                  </Campo>
                  <Campo label="Fecha de Presentación">
                    <input name="fecha_presentacion" type="date" style={inputStyle} />
                  </Campo>
                  <Campo label="Quejoso ***">
                    <input name="quejoso_nombre" required style={inputStyle} placeholder="Nombre del quejoso" />
                  </Campo>
                  <Campo label="Tipo de Amparo ***">
                    <select name="tipo_amparo" required style={inputStyle} defaultValue="Indirecto">
                      <option>Directo</option>
                      <option>Indirecto</option>
                    </select>
                  </Campo>
                  <Campo label="Próximo Término">
                    <input name="proximo_termino" type="date" style={inputStyle} />
                  </Campo>
                  <Campo label="Estado">
                    <select name="estado" style={inputStyle} defaultValue="En trámite">
                      <option>En trámite</option>
                      <option>Resuelto</option>
                    </select>
                  </Campo>
                </div>
              </div>

              {/* BLOQUE 2: ACTO RECLAMADO */}
              <div style={seccionStyle}>
                <div style={seccionTitulo}>Acto Reclamado</div>
                <Campo label="Autoridad Responsable ***">
                  <input name="autoridad_responsable" required style={inputStyle} placeholder="EJ: Juez Primero Civil del Distrito Judicial de..." />
                </Campo>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, color: 'white', marginBottom: 5 }}>Acto Reclamado ***</label>
                  <textarea name="acto_reclamado" required rows={2} style={inputStyle} placeholder="Descripción del acto reclamado..." />
                </div>
                <Campo label="Tercero Interesado">
                  <input name="tercero_interesado" style={inputStyle} placeholder="Nombre del tercero interesado (si aplica)" />
                </Campo>
              </div>

              {/* BLOQUE 3: INFORMACIÓN PROCESAL */}
              <div style={seccionStyle}>
                <div style={seccionTitulo}>Información Procesal</div>
                <div style={grid2}>
                  <Campo label="Juzgado de Distrito ***">
                    <select name="juzgado_id" required style={inputStyle} defaultValue="">
                      <option value="" disabled>Seleccionar Juzgado Federal...</option>
                      {juzgados.map((j) => (
                        <option key={j.id} value={j.id}>{j.nombre} ({j.ciudad})</option>
                      ))}
                    </select>
                  </Campo>

                  <Campo label="Abogado Responsable">
                    <select name="abogado_id" style={inputStyle} defaultValue="">
                      <option value="">Seleccionar abogado...</option>
                      {abogados.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                      ))}
                    </select>
                  </Campo>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block', fontSize: 13, color: 'white', marginBottom: 5 }}>Descripción / Observaciones</label>
                  <textarea name="descripcion" rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Notas adicionales - respaldo cuando no hay internet para el portal del PJF..." />
                </div>
              </div>

              {/* DISPARADORES */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                <button type="button" onClick={() => setAbierto(false)} style={{ padding: '12px 20px', background: 'transparent', color: TEXTO_TENUE, border: `1px solid ${BORDE}`, borderRadius: 8, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '12px 24px', background: GOLD, color: '#412402', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                  Crear Causa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, color: 'white', marginBottom: 5, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

const tabStyle = (activo: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  background: activo ? GOLD_ALPHA : 'transparent',
  color: activo ? GOLD : TEXTO_TENUE,
  border: activo ? `1px solid ${GOLD}` : `1px solid ${BORDE}`,
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: activo ? 600 : 400,
})

const thStyle: React.CSSProperties = { padding: '10px', borderBottom: `1px solid ${BORDE}`, textAlign: 'left' }
const tdStyle: React.CSSProperties = { padding: '14px 10px', borderBottom: `1px solid ${BORDE}`, verticalAlign: 'top' }
const subTexto: React.CSSProperties = { color: TEXTO_TENUE, fontSize: 12, marginTop: 3 }
const seccionStyle: React.CSSProperties = { border: `1px solid ${BORDE}`, borderRadius: 10, padding: 20, marginBottom: 18 }
const seccionTitulo: React.CSSProperties = { color: 'white', fontSize: 15, fontWeight: 600, marginBottom: 16 }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }
const inputStyle: React.CSSProperties = { width: '100%', padding: 10, border: `1px solid ${BORDE}`, borderRadius: 8, fontSize: 14, background: CAMPO_BG, color: 'white', boxSizing: 'border-box' }