// app/tareas/cliente.tsx
'use client'

import { useState } from 'react'
import { crearTarea, actualizarEstadoTarea, eliminarTarea } from './actions'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — idénticos al dashboard
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

interface Tarea {
  id: number
  descripcion: string
  fecha_vencimiento: string | null
  completada: boolean
  estado_kanban: 'Por Hacer' | 'En Progreso' | 'Completada' | null
  asignado_a_usuario_id: number | null
  usuarios?: { nombre_completo: string } | null
  expedientes?: { numero_expediente: string; materias?: { nombre: string } | null } | null
}

export default function TableroTareasCliente({
  tareasInit,
  expedientes,
  abogados,
  usuarioActualId,
}: {
  tareasInit: Tarea[]
  expedientes: any[]
  abogados: any[]
  usuarioActualId: number
}) {
  const [abierto, setAbierto]     = useState(false)
  const [busqueda, setBusqueda]   = useState('')
  const [filtroTab, setFiltroTab] = useState<'todos' | 'mis_tareas' | 'pendientes' | 'completadas'>('todos')
  const [error, setError]         = useState<string | null>(null)

  const tareasFiltradas = tareasInit.filter((t) => {
    const term = busqueda.toLowerCase()
    const ok =
      t.descripcion?.toLowerCase().includes(term) ||
      t.expedientes?.numero_expediente?.toLowerCase().includes(term)
    if (!ok) return false
    if (filtroTab === 'mis_tareas')  return t.asignado_a_usuario_id === usuarioActualId
    if (filtroTab === 'pendientes')  return t.estado_kanban !== 'Completada' && !t.completada
    if (filtroTab === 'completadas') return t.estado_kanban === 'Completada' || t.completada
    return true
  })

  const colPorHacer   = tareasFiltradas.filter(t => t.estado_kanban === 'Por Hacer' || (!t.estado_kanban && !t.completada))
  const colEnProgreso = tareasFiltradas.filter(t => t.estado_kanban === 'En Progreso')
  const colCompletadas = tareasFiltradas.filter(t => t.estado_kanban === 'Completada' || t.completada)

  const cnt = {
    todos:       tareasInit.length,
    mis_tareas:  tareasInit.filter(t => t.asignado_a_usuario_id === usuarioActualId).length,
    pendientes:  tareasInit.filter(t => t.estado_kanban !== 'Completada' && !t.completada).length,
    completadas: tareasInit.filter(t => t.estado_kanban === 'Completada' || t.completada).length,
  }

  const renderFecha = (fechaStr: string | null) => {
    if (!fechaStr) return null
    const hoy     = new Date().toISOString().split('T')[0]
    const manana  = new Date(); manana.setDate(manana.getDate() + 1)
    const mananaStr = manana.toISOString().split('T')[0]
    const vencido = fechaStr < hoy

    if (fechaStr === hoy) return (
      <span style={{ background: T.redAlpha, color: T.red, border: `0.5px solid rgba(179,67,79,0.25)`, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Hoy</span>
    )
    if (fechaStr === mananaStr) return (
      <span style={{ background: T.accentAlpha, color: T.textAccent, border: `0.5px solid rgba(58,95,184,0.25)`, padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Mañana</span>
    )
    if (vencido) return (
      <span style={{ background: T.redAlpha, color: T.red, border: `0.5px solid rgba(179,67,79,0.25)`, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>⚠ {fechaStr}</span>
    )
    const d = new Date(fechaStr + 'T00:00:00')
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return (
      <span style={{ border: `0.5px solid ${T.border}`, color: T.textMuted, padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
        {`${d.getDate()} ${meses[d.getMonth()]}`}
      </span>
    )
  }

  const cambiarEstado = async (id: number, estado: 'Por Hacer' | 'En Progreso' | 'Completada') => {
    await actualizarEstadoTarea(id, estado)
  }

  const borrarTarea = async (id: number) => {
    if (confirm('¿Desea borrar de forma permanente esta tarea?')) {
      await eliminarTarea(id)
    }
  }

  async function manejarSubmit(formData: FormData) {
    setError(null)
    const r = await crearTarea(formData)
    if (r?.error) { setError(r.error) } else { setAbierto(false) }
  }

  return (
    <>
      {/* ── ENCABEZADO ── */}
      <div style={css.pageHeader}>
        <div>
          <h1 style={css.titulo}>Tareas</h1>
          <p style={css.subtitulo}>
            <span style={css.dot} />
            Gestiona pendientes relacionados con expedientes
          </p>
        </div>
        <button onClick={() => setAbierto(true)} style={css.btnPrimario}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nueva tarea
        </button>
      </div>

      {/* ── FILTROS ── */}
      <div style={css.filtrosRow}>
        <div style={css.searchWrap}>
          <svg style={css.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar tarea o expediente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={css.searchInput}
          />
        </div>
        <div style={css.tabs}>
          {([
            ['todos',       `Todos (${cnt.todos})`],
            ['mis_tareas',  `Mis tareas (${cnt.mis_tareas})`],
            ['pendientes',  `Pendientes (${cnt.pendientes})`],
            ['completadas', `Completadas (${cnt.completadas})`],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFiltroTab(key)} style={css.tab(filtroTab === key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABLERO KANBAN ── */}
      <div style={css.kanban}>

        {/* COLUMNA: POR HACER */}
        <Columna
          titulo="Por hacer"
          count={colPorHacer.length}
          color={T.textAccent}
          dot="○"
        >
          {colPorHacer.map(t => (
            <TarjetaTarea
              key={t.id}
              tarea={t}
              renderFecha={renderFecha}
              onCheck={() => cambiarEstado(t.id, 'En Progreso')}
              checked={false}
            />
          ))}
        </Columna>

        {/* COLUMNA: EN PROGRESO */}
        <Columna
          titulo="En progreso"
          count={colEnProgreso.length}
          color={T.amber}
          dot="◐"
        >
          {colEnProgreso.map(t => (
            <TarjetaTarea
              key={t.id}
              tarea={t}
              renderFecha={renderFecha}
              onCheck={() => cambiarEstado(t.id, 'Completada')}
              checked={false}
              extra={
                <button
                  onClick={() => cambiarEstado(t.id, 'Por Hacer')}
                  style={{ background: 'transparent', border: 'none', color: T.textFaint, fontSize: 11, padding: 0, cursor: 'pointer', textDecoration: 'underline', marginTop: 6 }}
                >
                  Regresar a Por hacer
                </button>
              }
            />
          ))}
        </Columna>

        {/* COLUMNA: COMPLETADAS */}
        <Columna
          titulo="Completadas"
          count={colCompletadas.length}
          color={T.green}
          dot="✓"
        >
          {colCompletadas.map(t => (
            <TarjetaTarea
              key={t.id}
              tarea={t}
              renderFecha={renderFecha}
              onCheck={() => cambiarEstado(t.id, 'En Progreso')}
              checked={true}
              completada
              extra={
                <button
                  onClick={() => borrarTarea(t.id)}
                  style={{ background: 'transparent', border: 'none', color: T.red, fontSize: 11, padding: 0, cursor: 'pointer', marginTop: 6 }}
                >
                  Eliminar tarea
                </button>
              }
            />
          ))}
        </Columna>

      </div>

      {/* ── MODAL NUEVA TAREA ── */}
      {abierto && (
        <div style={css.overlay} onClick={() => setAbierto(false)}>
          <div style={css.modal} onClick={(e) => e.stopPropagation()}>

            <div style={css.modalHeader}>
              <div>
                <h2 style={css.modalTitulo}>Nueva tarea</h2>
                <p style={css.modalSub}>Asigne un nuevo pendiente administrativo o procesal</p>
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

            <form action={manejarSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Campo label="Descripción de la tarea *">
                <input name="descripcion" required style={css.input} placeholder="Ej: Redactar demanda inicial o Copias..." />
              </Campo>
              <Campo label="Vincular a expediente">
                <select name="expediente_id" style={css.input} defaultValue="">
                  <option value="">Ninguno (tarea general del despacho)</option>
                  {expedientes.map((e) => (
                    <option key={e.id} value={e.id}>{e.numero_expediente} ({e.materias?.nombre})</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Asignar a abogado">
                <select name="asignado_a" style={css.input} defaultValue="">
                  <option value="">Sin asignar</option>
                  {abogados.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Fecha límite (vencimiento)">
                <input name="fecha_vencimiento" type="date" style={css.input} />
              </Campo>

              <div style={css.modalFooter}>
                <button type="button" onClick={() => setAbierto(false)} style={css.btnSecundario}>Cancelar</button>
                <button type="submit" style={css.btnPrimario}>Guardar tarea</button>
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
function Columna({ titulo, count, color, dot, children }: {
  titulo: string; count: number; color: string; dot: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 12,
      padding: 16,
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
        <span style={{ color, fontSize: 14 }}>{dot}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {titulo}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textFaint, background: T.surfaceLow, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: '1px 7px' }}>
          {count}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function TarjetaTarea({ tarea: t, renderFecha, onCheck, checked, completada, extra }: {
  tarea: Tarea
  renderFecha: (f: string | null) => React.ReactNode
  onCheck: () => void
  checked: boolean
  completada?: boolean
  extra?: React.ReactNode
}) {
  return (
    <div style={{
      background: T.surfaceLow,
      border: `0.5px solid ${T.border}`,
      borderRadius: 8,
      padding: '12px 14px',
      opacity: completada ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          style={{ marginTop: 3, cursor: 'pointer', accentColor: T.accent }}
        />
        <span style={{
          color: completada ? T.textMuted : T.textPrimary,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: completada ? 'line-through' : 'none',
          lineHeight: 1.4,
        }}>
          {t.descripcion}
        </span>
      </div>

      {t.usuarios && (
        <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 5, marginLeft: 24 }}>
          {t.usuarios.nombre_completo}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10, marginLeft: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        {t.expedientes && (
          <span style={{
            background: T.accentAlpha,
            color: T.textAccent,
            border: `0.5px solid rgba(58,95,184,0.2)`,
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
          }}>
            {t.expedientes.numero_expediente}
            {t.expedientes.materias?.nombre ? ` · ${t.expedientes.materias.nombre}` : ''}
          </span>
        )}
        {renderFecha(t.fecha_vencimiento)}
      </div>

      {extra && <div style={{ marginLeft: 24, marginTop: 4 }}>{extra}</div>}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>{label}</label>
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
  } as React.CSSProperties,
  filtrosRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginBottom: 20,
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
    background: T.surfaceLow,
    border: `0.5px solid ${T.border}`,
    borderRadius: 8,
    color: T.textPrimary,
    fontSize: 13,
    width: 260,
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
  kanban: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
    alignItems: 'flex-start',
  } as React.CSSProperties,
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(6,10,18,0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    zIndex: 200,
  },
  modal: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 14,
    padding: '28px 28px',
    width: '100%',
    maxWidth: 520,
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
    background: T.surfaceLow,
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
  input: {
    width: '100%',
    padding: '10px 12px',
    background: T.surfaceLow,
    border: `0.5px solid ${T.border}`,
    borderRadius: 8,
    color: T.textPrimary,
    fontSize: 13,
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,
}