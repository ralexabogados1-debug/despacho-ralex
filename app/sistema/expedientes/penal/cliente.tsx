'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTema } from '@/app/sistema/layout'
import { useExpedientes } from '@/hooks/useExpedientes'
import {
  crearCausaPenalLocal,
  obtenerUsuarioLocalPorEmail,
  eliminarExpedienteLocal,
  limpiarExpedienteCacheTrasBorrarOnline,
  queryColaboradoresLocal,
  agregarColaboradorLocal,
  eliminarColaboradorLocal,
} from '@/lib/dbHelpers'
import { leerSesionLocal } from '@/lib/authLocal'
import { createClient } from '@/lib/supabase/client'
import BannerOffline from '@/components/BannerOffline'

// ─── Tokens OSCUROS (Penal – rojo vino) ─────────────────────────────────
const T_DARK = {
  surface:     '#0b1220',
  surfaceLow:  '#0f1828',
  border:      'rgba(255,255,255,0.05)',
  accent:      '#b3434f',
  accentAlpha: 'rgba(179,67,79,0.10)',
  accentBorder:'rgba(179,67,79,0.40)',
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
  bg:          '#070b14',
}

// ─── Tokens CLAROS (Penal – rojo vino adaptado) ─────────────────────────
const T_LIGHT = {
  surface:     '#ffffff',
  surfaceLow:  '#f9fafb',
  border:      'rgba(0,0,0,0.08)',
  accent:      '#b91c1c',
  accentAlpha: 'rgba(185,28,28,0.08)',
  accentBorder:'rgba(185,28,28,0.25)',
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
  bg:          '#f5f7fa',
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
  const { oscuro } = useTema()
  const {
    expedientes: causasLocales,
    isOnline,
    syncing,
    sincronizar,
    recargar,
  } = useExpedientes('expedientes_penales')

  const causasActivas = isOnline ? causas : causasLocales

  const T = oscuro ? T_DARK : T_LIGHT

  const [abierto,    setAbierto]    = useState(false)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroTab,  setFiltroTab]  = useState<'todos' | 'activos' | 'termino' | 'concluidos'>('todos')
  const [mensaje,    setMensaje]    = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const [abogadoActual, setAbogadoActual] = useState<{ id: number; nombre_completo: string } | null>(null)

  // Colaboradores seleccionados en el formulario de creación
  const [colaboradoresForm, setColaboradoresForm] = useState<number[]>([])

  // Estado para "Ver más" y "Eliminar"
  const [detalleAbierto,   setDetalleAbierto]   = useState<any | null>(null)
  const [eliminarObjetivo, setEliminarObjetivo] = useState<any | null>(null)
  const [eliminando,       setEliminando]       = useState(false)

  // Colaboradores del expediente abierto en el modal de detalle
  const [colaboradoresDetalle, setColaboradoresDetalle] = useState<any[]>([])
  const [nuevoColaboradorId,   setNuevoColaboradorId]   = useState<string>('')
  const [guardandoColaborador, setGuardandoColaborador] = useState(false)

  useEffect(() => {
    (async () => {
      const sesion = leerSesionLocal()
      if (!sesion) return
      const usuarioLocal = await obtenerUsuarioLocalPorEmail(sesion.email)
      if (usuarioLocal) {
        setAbogadoActual({ id: usuarioLocal.id, nombre_completo: usuarioLocal.nombre_completo })
      }
    })()
  }, [])

  // Carga colaboradores cada vez que se abre un detalle
  useEffect(() => {
    if (!detalleAbierto) {
      setColaboradoresDetalle([])
      setNuevoColaboradorId('')
      return
    }
    (async () => {
      const lista = await queryColaboradoresLocal(detalleAbierto.id)
      setColaboradoresDetalle(lista)
    })()
  }, [detalleAbierto])

  const hoy = new Date().toISOString().split('T')[0]

  const proxTermo = (tareas: any[]) =>
    tareas
      ?.filter(t => !t.completada && t.fecha_vencimiento)
      .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
      [0]?.fecha_vencimiento ?? null

  const esActivo = (estado: string) => estado === 'Activo'

  const filtrados = causasActivas.filter(c => {
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
    todos:      causasActivas.length,
    activos:    causasActivas.filter(c => esActivo(c.estado)).length,
    concluidos: causasActivas.filter(c => c.estado === 'Concluido').length,
    termino:    causasActivas.filter(c => esActivo(c.estado) && proxTermo(c.tareas) !== null).length,
  }

  // Marca/desmarca un abogado en el checklist del formulario
  function alternarColaboradorForm(id: number) {
    setColaboradoresForm(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function manejarSubmit(formData: FormData) {
    setError(null)
    try {
      const sesion = leerSesionLocal()
      const usuarioLocal = sesion ? await obtenerUsuarioLocalPorEmail(sesion.email) : null

      if (!usuarioLocal) {
        setError('No se pudo identificar al usuario en sesión. Vuelve a iniciar sesión.')
        return
      }

      const { expedienteId } = await crearCausaPenalLocal({
        cliente_nombre: formData.get('cliente_nombre') as string,
        numero_causa:   formData.get('numero_causa') as string,
        numero_carpeta: (formData.get('numero_carpeta') as string) || null,
        delito:         formData.get('delito') as string,
        etapa_procesal: formData.get('etapa_procesal') as string,
        fecha_inicio:   formData.get('fecha_inicio') as string,
        estado:         (formData.get('estado') as string) || 'Activo',
        rol_cliente:    formData.get('rol_cliente') as string,
        rol_abogado:    formData.get('rol_abogado') as string,
        contraparte:    (formData.get('contraparte') as string) || null,
        juez_id:        Number(formData.get('juez_id')) || null,
        mp_id:          Number(formData.get('mp_id')) || null,
        abogado_id:     usuarioLocal.id,
        descripcion:    (formData.get('descripcion') as string) || null,
      }, usuarioLocal.id)

      // Agrega colaboradores adicionales marcados en el checklist
      for (const colabId of colaboradoresForm) {
        if (colabId === usuarioLocal.id) continue
        await agregarColaboradorLocal(expedienteId, colabId, false)
      }

      setMensaje('Causa penal creada correctamente.')
      setAbierto(false)
      setColaboradoresForm([])
      setTimeout(() => setMensaje(null), 3000)

      if (isOnline) await sincronizar()
      else await recargar()
    } catch (e: any) {
      setError(e?.message ?? 'Error al crear la causa')
    }
  }

  // Agrega un colaborador desde el modal de detalle
  async function manejarAgregarColaboradorDetalle() {
    if (!detalleAbierto || !nuevoColaboradorId) return
    setGuardandoColaborador(true)
    setError(null)
    try {
      await agregarColaboradorLocal(detalleAbierto.id, Number(nuevoColaboradorId), false)

      const lista = await queryColaboradoresLocal(detalleAbierto.id)
      setColaboradoresDetalle(lista)
      setNuevoColaboradorId('')

      if (isOnline) await sincronizar()
      else await recargar()
    } catch (e) {
      console.error(e)
      setError('Error al agregar colaborador: ' + String(e))
    } finally {
      setGuardandoColaborador(false)
    }
  }

  // Quita un colaborador desde el modal de detalle
  async function manejarQuitarColaboradorDetalle(usuarioId: number) {
    if (!detalleAbierto) return
    setGuardandoColaborador(true)
    setError(null)
    try {
      await eliminarColaboradorLocal(detalleAbierto.id, usuarioId)

      const lista = await queryColaboradoresLocal(detalleAbierto.id)
      setColaboradoresDetalle(lista)

      if (isOnline) await sincronizar()
      else await recargar()
    } catch (e) {
      console.error(e)
      setError('Error al quitar colaborador: ' + String(e))
    } finally {
      setGuardandoColaborador(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Eliminar causa penal
  // Online: borra directo en Supabase y limpia el cache local sin encolar.
  // Offline: bloqueado en la UI (botón disabled), pero se deja el flujo local
  // como respaldo.
  // ─────────────────────────────────────────────────────────────────────────
  async function manejarEliminar(c: any) {
    setEliminando(true)
    setError(null)
    try {
      if (isOnline) {
        const supabase = createClient()
        const { error: errSupabase } = await supabase
          .from('expedientes')
          .delete()
          .eq('id', c.id)

        if (errSupabase) throw errSupabase

        await limpiarExpedienteCacheTrasBorrarOnline(c.id)
        await sincronizar()
      } else {
        await eliminarExpedienteLocal(c.id)
        await recargar()
      }

      setEliminarObjetivo(null)
      setDetalleAbierto(null)
      setMensaje('Causa eliminada correctamente.')
      setTimeout(() => setMensaje(null), 3000)
    } catch (e) {
      console.error(e)
      setError('Error al eliminar la causa: ' + String(e))
    } finally {
      setEliminando(false)
    }
  }

  const s = getStyles(T, oscuro)

  // Abogados disponibles para agregar como colaborador en el detalle
  const abogadosDisponiblesDetalle = abogados.filter(
    a => !colaboradoresDetalle.some(c => c.usuario_id === a.id)
  )

  return (
    <div style={s.root}>
      <style>{`
        .pen-header   { flex-direction: row; }
        .pen-btn-new  { width: auto; }
        .pen-filtros  { flex-direction: row; }
        .pen-form-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
        .pen-col-form { flex: 1 1 200px; min-width: 180px; }
        .pen-busqueda-wrapper { flex: 1 1 200px; width: auto; }

        @media (max-width: 700px) {
          .pen-header   { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .pen-btn-new  { width: 100% !important; justify-content: center !important; }
          .pen-filtros  { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .pen-busqueda-wrapper { width: 100% !important; flex: none !important; }
          .pen-tabs     { width: 100% !important; justify-content: flex-start !important; }
          .pen-tabs button { flex: 1 1 auto; text-align: center; justify-content: center; }
          .pen-col-form { flex: 1 1 100% !important; min-width: 100% !important; }
          .pen-form-row { gap: 10px !important; }
          
          .pen-desktop { display: none !important; }
          .pen-mobile  { display: flex !important; }
        }

        @media (min-width: 701px) {
          .pen-mobile  { display: none !important; }
        }

        .pen-row:hover { background: ${oscuro ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}; }
        .pen-row-link:hover { background: ${oscuro ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}; }
      `}</style>

      <BannerOffline esOffline={!isOnline} />

      {/* ── ENCABEZADO ── */}
      <div className="pen-header" style={s.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={s.titulo}>Causas Penales</h1>
          <p style={s.subtitulo}>
            <span style={{ ...s.dot, background: T.accent }} />
            Gestión en materia penal
            &nbsp;·&nbsp;
            <strong style={{ color: T.textPrimary }}>{cnt.todos}</strong> registradas
            &nbsp;·&nbsp;
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: isOnline ? T.green : T.amber
            }}>
              <span style={{
                width: 5, height: 5,
                borderRadius: '50%',
                background: isOnline ? T.green : T.amber,
                display: 'inline-block'
              }}/>
              {syncing ? 'Sincronizando...' : isOnline ? 'En línea' : 'Sin conexión'}
            </span>
          </p>
        </div>
        <button onClick={() => setAbierto(true)} className="pen-btn-new" style={{ ...s.btnPrimario, background: T.accent }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nueva Causa
        </button>
      </div>

      {mensaje && <Alerta tipo="ok" oscuro={oscuro}>{mensaje}</Alerta>}

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
            <div className="pen-desktop">
              <table style={s.table}>
                <thead>
                  <tr>
                    {['No. Causa','Cliente / Rol','Delito','Etapa','Juez / MP','Estado','Próx. Término','Acciones'].map(h => (
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
                      <tr key={c.id} className="pen-row">
                        <td style={s.td}>
                          <Link href={`/sistema/expedientes/penal/detalle?id=${c.id}`} style={{ fontWeight: 600, color: T.textPrimary, fontSize: 13, textDecoration: 'none' }}>
                            {c.numero_expediente}
                          </Link>
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
                          <span style={{ ...s.pill, background: act ? T.greenAlpha : T.goldAlpha, color: act ? T.green : T.gold, border: `1px solid ${act ? T.green : T.gold}44` }}>
                            {c.estado}
                          </span>
                        </td>
                        <td style={s.td}>
                          {!act ? (
                            <span style={{ ...s.pill, background: T.goldAlpha, color: T.gold, border: `1px solid ${T.gold}44` }}>Concluido</span>
                          ) : pt ? (
                            <span style={{ fontWeight: esH || venc ? 600 : 400, color: venc ? T.red : esH ? T.amber : T.textMuted, fontSize: 13 }}>
                              {venc ? '⚠ ' : esH ? '● ' : ''}{pt}
                            </span>
                          ) : (
                            <span style={{ color: T.textFaint, fontSize: 13 }}>—</span>
                          )}
                        </td>
                        <td style={s.td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setDetalleAbierto(c)}
                              style={s.btnIcono(T)}
                              title="Ver más"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setEliminarObjetivo(c)}
                              style={{ ...s.btnIcono(T), color: T.red, borderColor: `${T.red}44` }}
                              title="Eliminar"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                              </svg>
                            </button>
                          </div>
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
                  <Link key={c.id} href={`/sistema/expedientes/penal/detalle?id=${c.id}`} className="pen-row-link" style={s.rowLink}>
                    <div style={{ ...s.avatar, background: T.accentAlpha, color: T.accent }}>
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
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL — Nueva Causa ── */}
      {abierto && (
        <div style={s.overlay} onClick={() => setAbierto(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Nueva Causa Penal</h2>
                <p style={s.modalSub}>Complete los campos para el registro del caso</p>
              </div>
              <button onClick={() => setAbierto(false)} style={s.btnCerrar} aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && <Alerta tipo="error" oscuro={oscuro}>{error}</Alerta>}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                manejarSubmit(new FormData(e.currentTarget))
              }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
            >
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
                <Seccion titulo="Información de la causa" icono="📋" T={T} oscuro={oscuro}>
                  <div className="pen-form-row">
                    <div className="pen-col-form">
                      <Campo label="Número de causa *" T={T}>
                        <input name="numero_causa" required style={s.input} placeholder="Ej: 118-2025" />
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="No. Carpeta de Investigación" T={T}>
                        <input name="numero_carpeta" style={s.input} placeholder="Ej: 05-20-26" />
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Delito *" T={T}>
                        <input name="delito" required style={s.input} placeholder="Ej: Robo con violencia" />
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Etapa procesal *" T={T}>
                        <select name="etapa_procesal" required style={s.input} defaultValue="">
                          <option value="" disabled>Seleccionar...</option>
                          <option>Inicial</option>
                          <option>Intermedia</option>
                          <option>Juicio</option>
                        </select>
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Fecha de inicio *" T={T}>
                        <input name="fecha_inicio" type="date" required style={s.input} />
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Estado" T={T}>
                        <select name="estado" style={s.input} defaultValue="Activo">
                          <option>Activo</option>
                          <option>Concluido</option>
                        </select>
                      </Campo>
                    </div>
                  </div>
                </Seccion>

                <Seccion titulo="Partes involucradas" icono="👥" T={T} oscuro={oscuro}>
                  <div className="pen-form-row">
                    <div className="pen-col-form">
                      <Campo label="Cliente *" T={T}>
                        <input name="cliente_nombre" required style={s.input} placeholder="Nombre del cliente" />
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Rol del cliente *" T={T}>
                        <select name="rol_cliente" required style={s.input} defaultValue="Imputado">
                          <option>Imputado</option>
                          <option>Víctima</option>
                        </select>
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Rol del abogado *" T={T}>
                        <select name="rol_abogado" required style={s.input} defaultValue="Defensor">
                          <option>Defensor</option>
                          <option>Asesor jurídico</option>
                        </select>
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Contraparte" T={T}>
                        <input name="contraparte" style={s.input} placeholder="Nombre de la contraparte u ofendido" />
                      </Campo>
                    </div>
                  </div>
                </Seccion>

                <Seccion titulo="Información procesal" icono="⚖️" T={T} oscuro={oscuro}>
                  <div className="pen-form-row">
                    <div className="pen-col-form">
                      <Campo label="Juez asignado *" T={T}>
                        <select name="juez_id" required style={s.input} defaultValue="">
                          <option value="" disabled>Seleccionar juez</option>
                          {jueces.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                        </select>
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Ministerio Público" T={T}>
                        <select name="mp_id" style={s.input} defaultValue="">
                          <option value="">Seleccionar MP</option>
                          {ministerios.map((m) => <option key={m.id} value={m.id}>{m.nombre_agencia}</option>)}
                        </select>
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Próx. audiencia (término)" T={T}>
                        <input name="fecha_limite_termino" type="date" style={s.input} />
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Tipo de audiencia" T={T}>
                        <select name="plazo_otorgado" style={s.input} defaultValue="">
                          <option value="">Seleccionar...</option>
                          <option>Inicial</option>
                          <option>Vinculación</option>
                          <option>Cautelar</option>
                        </select>
                      </Campo>
                    </div>
                    <div className="pen-col-form">
                      <Campo label="Abogado responsable" T={T}>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={abogadoActual?.nombre_completo ?? 'Cargando sesión...'}
                          style={{ ...s.input, opacity: 0.75, cursor: 'not-allowed' }}
                        />
                      </Campo>
                    </div>
                  </div>
                  <Campo label="Descripción / Notas" T={T}>
                    <textarea name="descripcion" rows={3} style={s.textarea}
                      placeholder="Descripción general del caso..." />
                  </Campo>
                </Seccion>

                {/* Colaboradores adicionales */}
                <Seccion titulo="Colaboradores" icono="👥" T={T} oscuro={oscuro}>
                  <p style={{ fontSize: 11.5, color: T.textMuted, margin: '0 0 10px' }}>
                    {abogadoActual?.nombre_completo ?? 'Tú'} queda como responsable automáticamente.
                    Marca a quién más debe tener acceso a esta causa.
                  </p>
                  {abogados.filter(a => a.id !== abogadoActual?.id).length === 0 ? (
                    <p style={{ fontSize: 12, color: T.textFaint }}>No hay otros abogados registrados.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                      {abogados.filter(a => a.id !== abogadoActual?.id).map(ab => (
                        <label
                          key={ab.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.textPrimary, cursor: 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            checked={colaboradoresForm.includes(ab.id)}
                            onChange={() => alternarColaboradorForm(ab.id)}
                          />
                          {ab.nombre_completo}
                        </label>
                      ))}
                    </div>
                  )}
                </Seccion>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: `1px solid ${T.border}` }}>
                <button type="button" onClick={() => setAbierto(false)} style={s.btnSec}>Cancelar</button>
                <button type="submit" style={{ ...s.btnPrimario, background: T.accent }}>Crear causa</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL — Ver más (detalle) ── */}
      {detalleAbierto && (
        <div style={s.overlay} onClick={() => setDetalleAbierto(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>{detalleAbierto.numero_expediente}</h2>
                <p style={s.modalSub}>Detalle completo de la causa</p>
              </div>
              <button onClick={() => setDetalleAbierto(null)} style={s.btnCerrar} aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {error && <Alerta tipo="error" oscuro={oscuro}>{error}</Alerta>}

              {(() => {
                const penal = detalleAbierto.expedientes_penales?.[0] ?? {}
                return (
                  <>
                    <Seccion titulo="Datos generales" icono="📋" T={T} oscuro={oscuro}>
                      <DetalleFila label="Cliente" valor={detalleAbierto.clientes?.nombre_completo} T={T} />
                      <DetalleFila label="Rol del cliente" valor={detalleAbierto.caracter_cliente} T={T} />
                      <DetalleFila label="Rol del abogado" valor={penal.rol_abogado} T={T} />
                      <DetalleFila label="Estado" valor={detalleAbierto.estado} T={T} />
                      <DetalleFila label="Fecha de inicio" valor={detalleAbierto.fecha_inicio} T={T} />
                    </Seccion>
                    <Seccion titulo="Delito y carpeta" icono="⚖️" T={T} oscuro={oscuro}>
                      <DetalleFila label="Delito" valor={penal.delito} T={T} />
                      <DetalleFila label="No. Carpeta de Investigación" valor={penal.numero_carpeta_investigacion} T={T} />
                      <DetalleFila label="Etapa procesal" valor={penal.estadio_procesal} T={T} />
                      <DetalleFila label="Contraparte" valor={detalleAbierto.contraparte} T={T} />
                    </Seccion>
                    <Seccion titulo="Juez y Ministerio Público" icono="🏛️" T={T} oscuro={oscuro}>
                      <DetalleFila label="Juez asignado" valor={detalleAbierto.jueces?.nombre} T={T} />
                      <DetalleFila label="Ministerio Público" valor={penal.ministerios_publicos?.nombre_agencia} T={T} />
                    </Seccion>
                    {detalleAbierto.descripcion && (
                      <Seccion titulo="Descripción / Notas" icono="📝" T={T} oscuro={oscuro}>
                        <p style={{ fontSize: 13, color: T.textPrimary, margin: 0, lineHeight: 1.5 }}>
                          {detalleAbierto.descripcion}
                        </p>
                      </Seccion>
                    )}

                    {/* Colaboradores */}
                    <Seccion titulo="Colaboradores" icono="👥" T={T} oscuro={oscuro}>
                      {colaboradoresDetalle.length === 0 ? (
                        <p style={{ fontSize: 12, color: T.textFaint, margin: 0 }}>Sin colaboradores registrados.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 12 }}>
                          {colaboradoresDetalle.map(cl => (
                            <div
                              key={cl.usuario_id}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '6px 10px', borderRadius: 6,
                                background: T.surface, border: `1px solid ${T.border}`,
                              }}
                            >
                              <span style={{ fontSize: 13, color: T.textPrimary }}>
                                {cl.nombre_completo}
                                {cl.es_responsable && (
                                  <span style={{ marginLeft: 6, fontSize: 10.5, color: T.accent }}>· Responsable</span>
                                )}
                              </span>
                              <button
                                onClick={() => manejarQuitarColaboradorDetalle(cl.usuario_id)}
                                disabled={guardandoColaborador}
                                style={{ ...s.btnIcono(T), color: T.red, borderColor: `${T.red}44`, width: 22, height: 22 }}
                                title="Quitar colaborador"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {abogadosDisponiblesDetalle.length > 0 && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select
                            value={nuevoColaboradorId}
                            onChange={e => setNuevoColaboradorId(e.target.value)}
                            style={{ ...s.input, flex: 1 }}
                          >
                            <option value="">Agregar colaborador...</option>
                            {abogadosDisponiblesDetalle.map(a => (
                              <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                            ))}
                          </select>
                          <button
                            onClick={manejarAgregarColaboradorDetalle}
                            disabled={!nuevoColaboradorId || guardandoColaborador}
                            style={{ ...s.btnSec, whiteSpace: 'nowrap' as const }}
                          >
                            {guardandoColaborador ? 'Agregando...' : 'Agregar'}
                          </button>
                        </div>
                      )}
                    </Seccion>
                  </>
                )
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '16px 24px', borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={() => setEliminarObjetivo(detalleAbierto)}
                style={{ ...s.btnSec, color: T.red, borderColor: `${T.red}55` }}
              >
                Eliminar causa
              </button>
              <button onClick={() => setDetalleAbierto(null)} style={{ ...s.btnPrimario, background: T.accent }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL — Confirmar eliminación ── */}
      {eliminarObjetivo && (
        <div style={{ ...s.overlay, zIndex: 300 }} onClick={() => !eliminando && setEliminarObjetivo(null)}>
          <div style={{ ...s.modal, maxWidth: 420, maxHeight: 'none' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h2 style={s.modalTitle}>¿Eliminar causa?</h2>
              <p style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>
                Vas a eliminar la causa{' '}
                <strong style={{ color: T.textPrimary }}>{eliminarObjetivo.numero_expediente}</strong>.
                Esta acción no se puede deshacer.
              </p>
              {!isOnline && (
                <div style={{ marginTop: 12 }}>
                  <Alerta tipo="error" oscuro={oscuro}>
                    Necesitas conexión a internet para eliminar una causa.
                  </Alerta>
                </div>
              )}
              {error && (
                <div style={{ marginTop: 12 }}>
                  <Alerta tipo="error" oscuro={oscuro}>{error}</Alerta>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 24px 24px' }}>
              <button onClick={() => setEliminarObjetivo(null)} disabled={eliminando} style={s.btnSec}>
                Cancelar
              </button>
              <button
                onClick={() => manejarEliminar(eliminarObjetivo)}
                disabled={!isOnline || eliminando}
                style={{ ...s.btnPrimario, background: T.red, opacity: (!isOnline || eliminando) ? 0.5 : 1 }}
              >
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────
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

function DetalleFila({ label, valor, T }: { label: string; valor: any; T: typeof T_DARK }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, textAlign: 'right' }}>{valor || '—'}</span>
    </div>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────
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
    background: T.surfaceLow,
    color: T.textMuted,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  } as React.CSSProperties,
  btnIcono: (T: typeof T_DARK) => ({
    width: 26, height: 26,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    background: T.surfaceLow,
    color: T.textMuted,
    cursor: 'pointer',
    flexShrink: 0,
  }) as React.CSSProperties,
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
    background: activo ? T.accentAlpha : 'transparent',
    color:      activo ? T.accent : T.textMuted,
    border:     `1px solid ${activo ? T.accentBorder : T.border}`,
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
    minWidth: 780,
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
  textarea: {
    width: '100%',
    padding: '10px 12px',
    background: T.surfaceLow,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    color: T.textPrimary,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
  } as React.CSSProperties,
})