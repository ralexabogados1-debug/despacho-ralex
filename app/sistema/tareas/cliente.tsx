'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { crearTarea, actualizarEstadoTarea, eliminarTarea } from './actions'
import { useTema } from '@/app/sistema/layout' // Ajusta la ruta si es necesario
import { useTareas } from '@/hooks/useTareas'
import { generarIdTemporal } from '@/lib/dbHelpers'
import BannerOffline from '@/components/BannerOffline'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS OSCUROS
// ─────────────────────────────────────────────────────────────────────────────
const T_DARK = {
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
  bg:          '#070b14',
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS CLAROS
// ─────────────────────────────────────────────────────────────────────────────
const T_LIGHT = {
  surface:     '#ffffff',
  surfaceLow:  '#f9fafb',
  border:      'rgba(0,0,0,0.08)',
  accent:      '#2b5fb0',
  accentAlpha: 'rgba(43,95,176,0.08)',
  gold:        '#b8860b',
  goldAlpha:   'rgba(184,134,11,0.08)',
  green:       '#16a34a',
  greenAlpha:  'rgba(22,163,74,0.06)',
  red:         '#dc2626',
  redAlpha:    'rgba(220,38,38,0.06)',
  amber:       '#d97706',
  amberAlpha:  'rgba(217,119,6,0.08)',
  textPrimary: 'rgba(0,0,0,0.85)',
  textMuted:   'rgba(0,0,0,0.50)',
  textFaint:   'rgba(0,0,0,0.30)',
  textAccent:  '#1e3a8a',
  bg:          '#f5f7fa',
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
  const { oscuro } = useTema()
  const router = useRouter()
  const T = oscuro ? T_DARK : T_LIGHT

  const {
    tareas: tareasLocales,
    isOnline,
    guardar: guardarTareaLocal,
    eliminar: eliminarTareaLocal,
  } = useTareas()

  // 1. Estado local reactivo para manejar actualizaciones instantáneas
  const [tareas, setTareas] = useState<Tarea[]>([])

  // Sincronizar el estado cuando Next.js traiga nuevos datos del servidor o cambie la conexión
  useEffect(() => {
    const activas = (isOnline ? tareasInit : tareasLocales) ?? []
    setTareas(activas)
  }, [tareasInit, tareasLocales, isOnline])

  const [abierto, setAbierto]     = useState(false)
  const [busqueda, setBusqueda]   = useState('')
  const [filtroTab, setFiltroTab] = useState<'todos' | 'mis_tareas' | 'pendientes' | 'completadas'>('todos')
  const [error, setError]         = useState<string | null>(null)

  const css = useMemo(() => getStyles(T, oscuro), [T, oscuro])

  // Filtrado reactivo basado en el estado local "tareas"
  const tareasFiltradas = tareas.filter((t) => {
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
    todos:       tareas.length,
    mis_tareas:  tareas.filter(t => t.asignado_a_usuario_id === usuarioActualId).length,
    pendientes:  tareas.filter(t => t.estado_kanban !== 'Completada' && !t.completada).length,
    completadas: tareas.filter(t => t.estado_kanban === 'Completada' || t.completada).length,
  }

  const renderFecha = (fechaStr: string | null) => {
    if (!fechaStr) return null
    const hoy     = new Date().toISOString().split('T')[0]
    const manana  = new Date(); manana.setDate(manana.getDate() + 1)
    const mananaStr = manana.toISOString().split('T')[0]
    const vencido = fechaStr < hoy

    if (fechaStr === hoy) return (
      <span style={{ background: T.redAlpha, color: T.red, border: `0.5px solid ${T.red}44`, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Hoy</span>
    )
    if (fechaStr === mananaStr) return (
      <span style={{ background: T.accentAlpha, color: T.textAccent, border: `0.5px solid ${T.accent}44`, padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Mañana</span>
    )
    if (vencido) return (
      <span style={{ background: T.redAlpha, color: T.red, border: `0.5px solid ${T.red}44`, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>⚠ {fechaStr}</span>
    )
    const d = new Date(fechaStr + 'T00:00:00')
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return (
      <span style={{ border: `0.5px solid ${T.border}`, color: T.textMuted, padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
        {`${d.getDate()} ${meses[d.getMonth()]}`}
      </span>
    )
  }

  // 🔄 Función de Cambio de Estado con Optimistic Update
  const cambiarEstado = async (id: number, estado: 'Por Hacer' | 'En Progreso' | 'Completada') => {
    setError(null)

    // Guardamos copia de seguridad para revertir si hay error
    const estadoAnterior = [...tareas]

    // 1. Actualización visual instantánea en el cliente
    setTareas(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, estado_kanban: estado, completada: estado === 'Completada' }
          : t
      )
    )

    // 2. Persistencia
    if (isOnline) {
      const r = await actualizarEstadoTarea(id, estado)
      if (r?.error) {
        setError(r.error)
        setTareas(estadoAnterior) // Revertir en fallo
      } else {
        router.refresh() // Sincronizar datos del servidor silenciosamente
      }
    } else {
      try {
        await guardarTareaLocal({
          id,
          estado_kanban: estado,
          completada: estado === 'Completada' ? 1 : 0,
        })
      } catch (e: any) {
        setError(e?.message ?? 'No se pudo actualizar la tarea sin conexión.')
        setTareas(estadoAnterior) // Revertir en fallo local
      }
    }
  }

  // 🗑️ Borrado con Optimistic Update
  const borrarTarea = async (id: number) => {
    if (!confirm('¿Desea borrar de forma permanente esta tarea?')) return
    setError(null)
    const estadoAnterior = [...tareas]

    // Eliminación instantánea de la UI
    setTareas(prev => prev.filter(t => t.id !== id))

    if (isOnline) {
      const r = await eliminarTarea(id)
      if (r?.error) {
        setError(r.error)
        setTareas(estadoAnterior) // Revertir si falla en backend
      } else {
        router.refresh()
      }
    } else {
      try {
        await eliminarTareaLocal(String(id))
      } catch (e: any) {
        setError(e?.message ?? 'No se pudo eliminar la tarea sin conexión.')
        setTareas(estadoAnterior)
      }
    }
  }

  async function manejarSubmit(formData: FormData) {
    setError(null)
    if (isOnline) {
      const r = await crearTarea(formData)
      if (r?.error) { 
        setError(r.error) 
      } else { 
        setAbierto(false)
        router.refresh()
      }
      return
    }

    try {
      const expedienteIdRaw = formData.get('expediente_id') as string
      const asignadoRaw     = formData.get('asignado_a') as string

      const nuevaTareaLocal: Tarea = {
        id: generarIdTemporal(),
        expediente_id: expedienteIdRaw ? Number(expedienteIdRaw) : null,
        asignado_a_usuario_id: asignadoRaw ? Number(asignadoRaw) : null,
        descripcion: formData.get('descripcion') as string,
        fecha_vencimiento: (formData.get('fecha_vencimiento') as string) || null,
        completada: false,
        estado_kanban: 'Por Hacer',
      } as any

      await guardarTareaLocal({
        ...nuevaTareaLocal,
        completada: 0,
        eliminada: 0,
      } as any)

      setTareas(prev => [nuevaTareaLocal, ...prev])
      setAbierto(false)
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar la tarea sin conexión.')
    }
  }

  return (
    <>
      <style>{`
        @media (max-width: 520px) {
          .tar-page-header { flex-direction: column; align-items: stretch !important; gap: 14px !important; }
          .tar-btn-primario { width: 100%; justify-content: center; padding: 12px 18px !important; }
        }
        @media (max-width: 480px) {
          .tar-modal { padding: 20px !important; }
        }
        @media (max-width: 640px) {
          .tar-search { width: 100% !important; }
          .tar-filtros-row { flex-direction: column; align-items: stretch !important; }
          .tar-tabs { overflow-x: auto; flex-wrap: nowrap !important; padding-bottom: 4px; }
          .tar-tabs::-webkit-scrollbar { height: 4px; }
          .tar-kanban { grid-template-columns: 1fr !important; }
          .tar-col-scroll { max-height: 46vh !important; }
        }
        .tar-col-scroll {
          scrollbar-width: thin;
          scrollbar-color: ${T.border} transparent;
        }
        .tar-col-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .tar-col-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .tar-col-scroll::-webkit-scrollbar-thumb {
          background: ${T.border};
          border-radius: 3px;
        }
        .tar-col-scroll::-webkit-scrollbar-thumb:hover {
          background: ${T.accent}55;
        }
      `}</style>

      <BannerOffline esOffline={!isOnline} />

      {/* ── ENCABEZADO ── */}
      <div className="tar-page-header" style={css.pageHeader}>
        <div>
          <h1 style={css.titulo}>Tareas</h1>
          <p style={css.subtitulo}>
            <span style={css.dot} />
            Gestiona pendientes relacionados con expedientes
          </p>
        </div>
        <button onClick={() => setAbierto(true)} className="tar-btn-primario" style={css.btnPrimario}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nueva tarea
        </button>
      </div>

      {error && (
        <div style={{ ...css.alertaError, marginBottom: 16 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          {error}
        </div>
      )}

      {/* ── FILTROS ── */}
      <div className="tar-filtros-row" style={css.filtrosRow}>
        <div className="tar-search" style={css.searchWrap}>
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
        <div className="tar-tabs" style={css.tabs}>
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
      <div className="tar-kanban" style={css.kanban}>

        {/* COLUMNA: POR HACER */}
        <Columna
          titulo="Por hacer"
          count={colPorHacer.length}
          color={T.textAccent}
          dot="○"
          T={T}
        >
          {colPorHacer.map(t => (
            <TarjetaTarea
              key={t.id}
              tarea={t}
              renderFecha={renderFecha}
              onCheck={() => cambiarEstado(t.id, 'En Progreso')}
              T={T}
              extra={
                <button
                  onClick={() => borrarTarea(t.id)}
                  style={css.btnEliminarTarjeta}
                >
                  Eliminar tarea
                </button>
              }
            />
          ))}
        </Columna>

        {/* COLUMNA: EN PROGRESO */}
        <Columna
          titulo="En progreso"
          count={colEnProgreso.length}
          color={T.amber}
          dot="◐"
          T={T}
        >
          {colEnProgreso.map(t => (
            <TarjetaTarea
              key={t.id}
              tarea={t}
              renderFecha={renderFecha}
              onCheck={() => cambiarEstado(t.id, 'Completada')}
              T={T}
              extra={
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <button
                    onClick={() => cambiarEstado(t.id, 'Por Hacer')}
                    style={{ background: 'transparent', border: 'none', color: T.textFaint, fontSize: 11, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Regresar a Por hacer
                  </button>
                  <button
                    onClick={() => borrarTarea(t.id)}
                    style={css.btnEliminarTarjeta}
                  >
                    Eliminar tarea
                  </button>
                </div>
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
          T={T}
        >
          {colCompletadas.map(t => (
            <TarjetaTarea
              key={t.id}
              tarea={t}
              renderFecha={renderFecha}
              onCheck={() => cambiarEstado(t.id, 'Por Hacer')} 
              completada
              T={T}
              extra={
                <button
                  onClick={() => borrarTarea(t.id)}
                  style={css.btnEliminarTarjeta}
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
          <div className="tar-modal" style={css.modal} onClick={(e) => e.stopPropagation()}>

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

            {!isOnline && (
              <div style={css.alertaOffline}>
                📡 Sin conexión — la tarea se guardará localmente y se sincronizará cuando recuperes internet.
              </div>
            )}

            {error && (
              <div style={css.alertaError}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                manejarSubmit(new FormData(e.currentTarget))
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <Campo label="Descripción de la tarea *" T={T}>
                <input name="descripcion" required style={css.input} placeholder="Ej: Redactar demanda inicial o Copias..." />
              </Campo>
              <Campo label="Vincular a expediente" T={T}>
                <select name="expediente_id" style={css.input} defaultValue="">
                  <option value="">Ninguno (tarea general del despacho)</option>
                  {expedientes.map((e) => (
                    <option key={e.id} value={e.id}>{e.numero_expediente} ({e.materias?.nombre})</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Asignar a abogado" T={T}>
                <select name="asignado_a" style={css.input} defaultValue="">
                  <option value="">Sin asignar</option>
                  {abogados.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Fecha límite (vencimiento)" T={T}>
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
function Columna({ titulo, count, color, dot, T, children }: {
  titulo: string; count: number; color: string; dot: string; T: typeof T_DARK; children: React.ReactNode
}) {
  return (
    <div style={{
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 12,
      padding: 16,
      height: 'calc(100vh - 300px)',
      minHeight: 380,
      maxHeight: 720,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16, flexShrink: 0 }}>
        <span style={{ color, fontSize: 14 }}>{dot}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {titulo}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textFaint, background: T.surfaceLow, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: '1px 7px' }}>
          {count}
        </span>
      </div>
      <div className="tar-col-scroll" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflowY: 'auto',
        paddingRight: 4,
        flex: 1,
        minHeight: 0,
      }}>
        {children}
        {count === 0 && (
          <div style={{ fontSize: 12, color: T.textFaint, textAlign: 'center', padding: '20px 0' }}>
            Sin tareas
          </div>
        )}
      </div>
    </div>
  )
}

function CirculoCheck({
  estado,
  onCheck,
  T,
}: {
  estado: 'Por Hacer' | 'En Progreso' | 'Completada'
  onCheck: () => void
  T: typeof T_DARK
}) {
  let borderColor = T.border
  let bg = 'transparent'
  let icon = null

  if (estado === 'En Progreso') {
    borderColor = T.amber
    bg = T.amberAlpha
    icon = (
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: T.amber,
        display: 'block'
      }} />
    )
  } else if (estado === 'Completada') {
    borderColor = T.green
    bg = T.green
    icon = (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onCheck()
      }}
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        border: `2px solid ${borderColor}`,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        marginTop: 2,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none',
      }}
      title={
        estado === 'Por Hacer' ? 'Mover a "En progreso"' :
        estado === 'En Progreso' ? 'Mover a "Completadas"' :
        'Mover a "Por hacer"'
      }
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.15)'
        if (estado === 'Por Hacer') {
          e.currentTarget.style.borderColor = T.accent
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        if (estado === 'Por Hacer') {
          e.currentTarget.style.borderColor = T.border
        }
      }}
    >
      {icon}
    </button>
  )
}

function TarjetaTarea({ tarea: t, renderFecha, onCheck, completada, T, extra }: {
  tarea: Tarea
  renderFecha: (f: string | null) => React.ReactNode
  onCheck: () => void
  completada?: boolean
  T: typeof T_DARK
  extra?: React.ReactNode
}) {
  const estadoReal = (t.estado_kanban === 'Completada' || t.completada)
    ? 'Completada'
    : t.estado_kanban === 'En Progreso'
    ? 'En Progreso'
    : 'Por Hacer'

  return (
    <div style={{
      background: T.surfaceLow,
      border: `0.5px solid ${T.border}`,
      borderRadius: 8,
      padding: '12px 14px',
      opacity: completada ? 0.7 : 1,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <CirculoCheck estado={estadoReal} onCheck={onCheck} T={T} />
        
        <span style={{
          color: completada ? T.textMuted : T.textPrimary,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: completada ? 'line-through' : 'none',
          lineHeight: 1.4,
          minWidth: 0,
          wordBreak: 'break-word',
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
            border: `0.5px solid ${T.accent}44`,
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

      {extra && <div style={{ marginLeft: 24, marginTop: 6 }}>{extra}</div>}
    </div>
  )
}

function Campo({ label, T, children }: { label: string; T: typeof T_DARK; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>{label}</label>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 ESTILOS DINÁMICOS
// ─────────────────────────────────────────────────────────────────────────────
function getStyles(T: typeof T_DARK, oscuro: boolean) {
  return {
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
      flexWrap: 'wrap' as const,
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
    btnEliminarTarjeta: {
      background: 'transparent',
      border: 'none',
      color: T.red,
      fontSize: 11,
      padding: 0,
      cursor: 'pointer',
    } as React.CSSProperties,
    alertaError: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: T.red,
      background: T.redAlpha,
      border: `0.5px solid ${T.red}44`,
      padding: '10px 14px',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 500,
    } as React.CSSProperties,
    alertaOffline: {
      color: T.amber,
      background: T.amberAlpha,
      border: `0.5px solid ${T.amber}44`,
      padding: '10px 14px',
      borderRadius: 8,
      fontSize: 12.5,
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
      width: '100%',
      padding: '9px 12px 9px 33px',
      background: T.surfaceLow,
      border: `0.5px solid ${T.border}`,
      borderRadius: 8,
      color: T.textPrimary,
      fontSize: 13,
      boxSizing: 'border-box' as const,
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
      border:     `0.5px solid ${activo ? `${T.accent}55` : T.border}`,
      borderRadius: 8,
      cursor: 'pointer',
      fontSize: 12.5,
      fontWeight: activo ? 600 : 400,
      transition: 'all 0.15s',
      whiteSpace: 'nowrap' as const,
      flexShrink: 0,
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
      background: oscuro ? 'rgba(6,10,18,0.75)' : 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      zIndex: 200,
      overflowY: 'auto' as const,
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
}