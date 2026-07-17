'use client'

import { useEffect, useState } from 'react'
import { useTema } from '@/app/sistema/layout'
import { useExpedientes } from '@/hooks/useExpedientes'
import {
  crearExpedienteCivilLocal,
  obtenerUsuarioLocalPorEmail,
  eliminarExpedienteLocal,
  limpiarExpedienteCacheTrasBorrarOnline,
  queryColaboradoresLocal,
  agregarColaboradorLocal,
  eliminarColaboradorLocal,
} from '@/lib/dbHelpers'
import { leerSesionLocal } from '@/lib/authLocal'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS OSCUROS (Civil / Familiar – azul)
// ─────────────────────────────────────────────────────────────────────────────
const T_DARK = {
  surface:     '#0b1220',
  surfaceLow:  '#0f1828',
  border:      'rgba(255,255,255,0.05)',
  accent:      '#4a7fd4',
  accentAlpha: 'rgba(74,127,212,0.10)',
  accentBorder:'rgba(74,127,212,0.40)',
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
  textAccent:  '#8fa8e0',
  bg:          '#070b14',
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS CLAROS (Civil / Familiar – azul adaptado)
// ─────────────────────────────────────────────────────────────────────────────
const T_LIGHT = {
  surface:     '#ffffff',
  surfaceLow:  '#f9fafb',
  border:      'rgba(0,0,0,0.08)',
  accent:      '#2b5fb0',
  accentAlpha: 'rgba(43,95,176,0.08)',
  accentBorder:'rgba(43,95,176,0.25)',
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
  textAccent:  '#1e3a8a',
  bg:          '#f5f7fa',
}

type Juzgado = { id: number; nombre: string; ciudad: string; materia_id: number }
type Abogado = { id: number; nombre_completo: string }
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
  const { oscuro } = useTema()
  const T = oscuro ? T_DARK : T_LIGHT

  const {
    expedientes: expedientesLocales,
    isOnline,
    syncing,
    sincronizar,
    recargar,
  } = useExpedientes('expedientes_civiles')

  const expedientesActivos = (isOnline ? expedientes : expedientesLocales) ?? []

  const [abierto,    setAbierto]    = useState(false)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroTab,  setFiltroTab]  = useState<'todos' | 'activos' | 'termino' | 'concluidos'>('todos')
  const [mensaje,    setMensaje]    = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const [abogadoActual, setAbogadoActual] = useState<{ id: number; nombre_completo: string } | null>(null)

  // 🆕 Colaboradores seleccionados en el formulario de creación
  const [colaboradoresForm, setColaboradoresForm] = useState<number[]>([])

  // 🆕 Estado para "Ver más" y "Eliminar"
  const [detalleAbierto,   setDetalleAbierto]   = useState<any | null>(null)
  const [eliminarObjetivo, setEliminarObjetivo] = useState<any | null>(null)
  const [eliminando,       setEliminando]       = useState(false)

  // 🆕 Colaboradores del expediente abierto en el modal de detalle
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

  // 🆕 Carga colaboradores cada vez que se abre un detalle
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

  const filtrados = expedientesActivos.filter(exp => {
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
    todos:      expedientesActivos.length,
    activos:    expedientesActivos.filter(e => esActivo(e.estado)).length,
    concluidos: expedientesActivos.filter(e => e.estado === 'Concluido').length,
    termino:    expedientesActivos.filter(e => esActivo(e.estado) && proxTermo(e.tareas) !== null).length,
  }

  // 🆕 Marca/desmarca un abogado en el checklist del formulario
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

      const { expedienteId } = await crearExpedienteCivilLocal({
        cliente_nombre:        formData.get('cliente_nombre') as string,
        numero_expediente:     formData.get('numero_expediente') as string,
        fecha_inicio:          formData.get('fecha_inicio') as string,
        estado:                (formData.get('estado') as string) || 'Activo',
        ciudad:                (formData.get('ciudad') as string) || 'Huejutla',
        rol_cliente:           formData.get('rol_cliente') as string,
        contraparte:           (formData.get('contraparte') as string) || null,
        materia_juicio_tipo:   formData.get('materia_juicio_tipo') as string,
        juzgado_id:            Number(formData.get('juzgado_id')) || null,
        plazo_otorgado:        (formData.get('plazo_otorgado') as string) || null,
        fecha_limite_termino:  (formData.get('fecha_limite_termino') as string) || null,
        abogado_id:            usuarioLocal.id,
        descripcion:           (formData.get('descripcion') as string) || null,
      }, usuarioLocal.id)

      // 🆕 Agrega colaboradores adicionales marcados en el checklist
      for (const colabId of colaboradoresForm) {
        if (colabId === usuarioLocal.id) continue
        await agregarColaboradorLocal(expedienteId, colabId, false)
      }

      setMensaje('Expediente registrado con éxito.')
      setAbierto(false)
      setColaboradoresForm([])
      setTimeout(() => setMensaje(null), 3000)

      if (isOnline) await sincronizar()
      else await recargar()
    } catch (e: any) {
      setError(e?.message ?? 'Error al crear el expediente')
    }
  }

  // 🆕 Agrega un colaborador desde el modal de detalle
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

  // 🆕 Quita un colaborador desde el modal de detalle
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
  // 🆕 Eliminar expediente
  // Online: borra directo en Supabase y limpia el cache local sin encolar.
  // Offline: bloqueado en la UI (botón disabled), pero se deja el flujo local
  // como respaldo.
  // ─────────────────────────────────────────────────────────────────────────
  async function manejarEliminar(exp: any) {
    setEliminando(true)
    setError(null)
    try {
      if (isOnline) {
        const supabase = createClient()
        const { error: errSupabase } = await supabase
          .from('expedientes')
          .delete()
          .eq('id', exp.id)

        if (errSupabase) throw errSupabase

        await limpiarExpedienteCacheTrasBorrarOnline(exp.id)
        await sincronizar()
      } else {
        await eliminarExpedienteLocal(exp.id)
        await recargar()
      }

      setEliminarObjetivo(null)
      setDetalleAbierto(null)
      setMensaje('Expediente eliminado correctamente.')
      setTimeout(() => setMensaje(null), 3000)
    } catch (e) {
      console.error(e)
      setError('Error al eliminar el expediente: ' + String(e))
    } finally {
      setEliminando(false)
    }
  }

  const s = getStyles(T, oscuro)

  // 🆕 Abogados disponibles para agregar como colaborador en el detalle
  const abogadosDisponiblesDetalle = abogados.filter(
    a => !colaboradoresDetalle.some(c => c.usuario_id === a.id)
  )

  return (
    <div style={s.root}>
      <style>{`
        .civ-header   { flex-direction: row; }
        .civ-btn-new  { width: auto; }
        .civ-filtros  { flex-direction: row; }
        .civ-form-row { flex-wrap: wrap; }
        .civ-col-form { flex: 1 1 220px; }
        .civ-busqueda-wrapper { flex: 1 1 200px; width: auto; }
        .civ-desktop   { width: 100%; overflow-x: auto; }

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

        .civ-row:hover { background: ${oscuro ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}; }
        .civ-row-link:hover { background: ${oscuro ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}; }
      `}</style>

      {/* ── ENCABEZADO ── */}
      <div className="civ-header" style={s.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={s.titulo}>Expedientes Civil / Familiar</h1>
          <p style={s.subtitulo}>
            <span style={{ ...s.dot, background: T.accent }} />
            Gestión procesal
            &nbsp;·&nbsp;
            <strong style={{ color: T.textPrimary }}>{cnt.todos}</strong> registrados
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
        <button onClick={() => setAbierto(true)} className="civ-btn-new" style={{ ...s.btnPrimario, background: T.accent }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo Expediente
        </button>
      </div>

      {mensaje && <Alerta tipo="ok" oscuro={oscuro}>{mensaje}</Alerta>}

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
                    {['No. Expediente','Cliente','Contraparte','Juicio','Juzgado','Estado','Próx. Término','Acciones'].map(h => (
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
                      <tr key={exp.id} className="civ-row">
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
                          <span style={{ ...s.pill, background: act ? T.greenAlpha : T.goldAlpha, color: act ? T.green : T.gold, border: `1px solid ${act ? T.green : T.gold}44` }}>
                            {exp.estado}
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
                        {/* 🆕 Acciones */}
                        <td style={s.td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setDetalleAbierto(exp)}
                              style={s.btnIcono(T)}
                              title="Ver más"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setEliminarObjetivo(exp)}
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
            <div className="civ-mobile" style={{ display: 'none', flexDirection: 'column' as const }}>
              {filtrados.map(exp => {
                const pt   = proxTermo(exp.tareas)
                const esH  = pt === hoy
                const venc = pt && pt < hoy
                const act  = esActivo(exp.estado)
                return (
                  <a key={exp.id} href={`/sistema/expedientes/civil/detalle?id=${exp.id}`} className="civ-row-link" style={s.rowLink}>
                    <div style={{ ...s.avatar, background: T.accentAlpha, color: T.accent }}>
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
                    {/* Indicador de navegación — tocar la tarjeta lleva a la pantalla
                        real de detalle, que ya tiene su propio botón de eliminar */}
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

      {/* ── MODAL — Nuevo Expediente ── */}
      {abierto && (
        <div style={s.overlay} onClick={() => setAbierto(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Nuevo Expediente Civil / Familiar</h2>
                <p style={s.modalSub}>Complete los campos procesales necesarios</p>
              </div>
              <button onClick={() => setAbierto(false)} style={s.btnCerrar} aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div style={{ padding: '0 24px' }}>
                <Alerta tipo="error" oscuro={oscuro}>{error}</Alerta>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                manejarSubmit(new FormData(e.currentTarget))
              }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
            >
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
                <Seccion titulo="Datos generales" icono="📋" T={T} oscuro={oscuro}>
                  <div className="civ-form-row" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                    <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Número de Expediente *" T={T}>
                        <input name="numero_expediente" required style={s.input} placeholder="Ej: 201-2025" />
                      </Campo>
                    </div>
                    <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Fecha de inicio *" T={T}>
                        <input name="fecha_inicio" type="date" required style={s.input} />
                      </Campo>
                    </div>
                    <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Estado" T={T}>
                        <select name="estado" style={s.input} defaultValue="Activo">
                          <option>Activo</option>
                          <option>Concluido</option>
                        </select>
                      </Campo>
                    </div>
                    <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Ciudad *" T={T}>
                        <select name="ciudad" required style={s.input} defaultValue="Huejutla">
                          <option>Huejutla</option>
                          <option>Pachuca</option>
                          <option>Otra</option>
                        </select>
                      </Campo>
                    </div>
                  </div>
                </Seccion>

                <Seccion titulo="Partes" icono="👥" T={T} oscuro={oscuro}>
                  <div className="civ-form-row" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                    <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Cliente *" T={T}>
                        <input name="cliente_nombre" required style={s.input} placeholder="Nombre completo" />
                      </Campo>
                    </div>
                    <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Carácter *" T={T}>
                        <select name="rol_cliente" required style={s.input} defaultValue="Demandante">
                          <option>Demandante</option>
                          <option>Demandado</option>
                          <option>Tercero interesado</option>
                        </select>
                      </Campo>
                    </div>
                    <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Contraparte" T={T}>
                        <input name="contraparte" style={s.input} placeholder="Nombre de la parte contraria" />
                      </Campo>
                    </div>
                  </div>
                </Seccion>

                <Seccion titulo="Información procesal" icono="⚖️" T={T} oscuro={oscuro}>
                  <div className="civ-form-row" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                    <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Materia / Tipo de juicio *" T={T}>
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
                      <Campo label="Juzgado *" T={T}>
                        <select name="juzgado_id" required style={s.input} defaultValue="">
                          <option value="" disabled>Seleccionar juzgado...</option>
                          {juzgados.map((j) => (
                            <option key={j.id} value={j.id}>{j.nombre} ({j.ciudad})</option>
                          ))}
                        </select>
                      </Campo>
                    </div>
                    <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
                      <Campo label="Próximo término (plazo)" T={T}>
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
                      <Campo label="Fecha límite del término" T={T}>
                        <input name="fecha_limite_termino" type="date" style={s.input} />
                      </Campo>
                    </div>
                    <div className="civ-col-form" style={{ flex: '1 1 200px' }}>
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
                  <Campo label="Descripción / Observaciones" T={T}>
                    <textarea name="descripcion" rows={3} style={s.textarea}
                      placeholder="Anotaciones o estado inicial del juicio..." />
                  </Campo>
                </Seccion>

                {/* 🆕 Colaboradores adicionales */}
                <Seccion titulo="Colaboradores" icono="👥" T={T} oscuro={oscuro}>
                  <p style={{ fontSize: 11.5, color: T.textMuted, margin: '0 0 10px' }}>
                    {abogadoActual?.nombre_completo ?? 'Tú'} queda como responsable automáticamente.
                    Marca a quién más debe tener acceso a este expediente.
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
                <button type="submit" style={{ ...s.btnPrimario, background: T.accent }}>Guardar expediente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL — 🆕 Ver más (detalle) ── */}
      {detalleAbierto && (
        <div style={s.overlay} onClick={() => setDetalleAbierto(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>{detalleAbierto.numero_expediente}</h2>
                <p style={s.modalSub}>Detalle completo del expediente</p>
              </div>
              <button onClick={() => setDetalleAbierto(null)} style={s.btnCerrar} aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {error && <Alerta tipo="error" oscuro={oscuro}>{error}</Alerta>}

              <Seccion titulo="Datos generales" icono="📋" T={T} oscuro={oscuro}>
                <DetalleFila label="Cliente" valor={detalleAbierto.clientes?.nombre_completo} T={T} />
                <DetalleFila label="Carácter" valor={detalleAbierto.caracter_cliente} T={T} />
                <DetalleFila label="Estado" valor={detalleAbierto.estado} T={T} />
                <DetalleFila label="Ciudad" valor={detalleAbierto.ciudad} T={T} />
                <DetalleFila label="Fecha de inicio" valor={detalleAbierto.fecha_inicio} T={T} />
              </Seccion>
              <Seccion titulo="Partes y juicio" icono="👥" T={T} oscuro={oscuro}>
                <DetalleFila label="Contraparte" valor={detalleAbierto.contraparte} T={T} />
                <DetalleFila label="Tipo de juicio" valor={detalleAbierto.tipo_juicio} T={T} />
              </Seccion>
              <Seccion titulo="Juzgado" icono="🏛️" T={T} oscuro={oscuro}>
                <DetalleFila label="Juzgado" valor={detalleAbierto.juzgados?.nombre} T={T} />
                <DetalleFila label="Ciudad del juzgado" valor={detalleAbierto.juzgados?.ciudad} T={T} />
              </Seccion>
              {detalleAbierto.descripcion && (
                <Seccion titulo="Observaciones" icono="📝" T={T} oscuro={oscuro}>
                  <p style={{ fontSize: 13, color: T.textPrimary, margin: 0, lineHeight: 1.5 }}>
                    {detalleAbierto.descripcion}
                  </p>
                </Seccion>
              )}

              {/* 🆕 Colaboradores */}
              <Seccion titulo="Colaboradores" icono="👥" T={T} oscuro={oscuro}>
                {colaboradoresDetalle.length === 0 ? (
                  <p style={{ fontSize: 12, color: T.textFaint, margin: 0 }}>Sin colaboradores registrados.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 12 }}>
                    {colaboradoresDetalle.map(c => (
                      <div
                        key={c.usuario_id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 10px', borderRadius: 6,
                          background: T.surface, border: `1px solid ${T.border}`,
                        }}
                      >
                        <span style={{ fontSize: 13, color: T.textPrimary }}>
                          {c.nombre_completo}
                          {c.es_responsable && (
                            <span style={{ marginLeft: 6, fontSize: 10.5, color: T.accent }}>· Responsable</span>
                          )}
                        </span>
                        <button
                          onClick={() => manejarQuitarColaboradorDetalle(c.usuario_id)}
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '16px 24px', borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={() => setEliminarObjetivo(detalleAbierto)}
                style={{ ...s.btnSec, color: T.red, borderColor: `${T.red}55` }}
              >
                Eliminar expediente
              </button>
              <button onClick={() => setDetalleAbierto(null)} style={{ ...s.btnPrimario, background: T.accent }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL — 🆕 Confirmar eliminación ── */}
      {eliminarObjetivo && (
        <div style={{ ...s.overlay, zIndex: 300 }} onClick={() => !eliminando && setEliminarObjetivo(null)}>
          <div style={{ ...s.modal, maxWidth: 420, maxHeight: 'none' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 24 }}>
              <h2 style={s.modalTitle}>¿Eliminar expediente?</h2>
              <p style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>
                Vas a eliminar el expediente{' '}
                <strong style={{ color: T.textPrimary }}>{eliminarObjetivo.numero_expediente}</strong>.
                Esta acción no se puede deshacer.
              </p>
              {!isOnline && (
                <div style={{ marginTop: 12 }}>
                  <Alerta tipo="error" oscuro={oscuro}>
                    Necesitas conexión a internet para eliminar un expediente.
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

// ─── Sub-componentes adaptados al tema ─────────────────────────────────
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

// 🆕 Fila de solo lectura para el modal de detalle
function DetalleFila({ label, valor, T }: { label: string; valor: any; T: typeof T_DARK }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, textAlign: 'right' }}>{valor || '—'}</span>
    </div>
  )
}

// ─── Función generadora de estilos dinámica ────────────────────────────
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
  // 🆕 Botón de ícono para acciones (Ver más / Eliminar)
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