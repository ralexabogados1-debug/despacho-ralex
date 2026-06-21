'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cambiarEstadoUsuario } from './actions'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS
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

interface Metricas {
  totalAbogados: number
  totalActivos: number
  totalInactivos: number
}

interface UsuariosClienteProps {
  usuariosIniciales: any[]
  metricas: Metricas
}

export default function UsuariosCliente({ usuariosIniciales, metricas }: UsuariosClienteProps) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('Todos')
  const [pendiente, startTransition] = useTransition()
  const [usuarioCargando, setUsuarioCargando] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const usuariosFiltrados = usuariosIniciales.filter((usuario) => {
    const cumpleBusqueda =
      usuario.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.email.toLowerCase().includes(busqueda.toLowerCase())
    const cumpleFiltroRol = filtroRol === 'Todos' || usuario.rol === filtroRol
    return cumpleBusqueda && cumpleFiltroRol
  })

  const pendientesAprobacion = usuariosIniciales.filter((u) => !u.activo)

  function manejarCambioEstado(usuarioId: number, estadoActual: boolean) {
    setUsuarioCargando(usuarioId)
    setMensaje(null)
    startTransition(async () => {
      const res = await cambiarEstadoUsuario(usuarioId, !estadoActual)
      setUsuarioCargando(null)
      if (res?.error) {
        setMensaje('Error: ' + res.error)
      } else {
        setMensaje(!estadoActual ? 'Usuario activado correctamente.' : 'Usuario suspendido.')
        setTimeout(() => setMensaje(null), 3000)
      }
    })
  }

  return (
    <>
      {/* ── ENCABEZADO ── */}
      <div style={css.pageHeader}>
        <div>
          <h1 style={css.titulo}>Control de Usuarios</h1>
          <p style={css.subtitulo}>
            <span style={css.dot} />
            Administra el personal del despacho jurídico y sus permisos.
          </p>
        </div>
        <button onClick={() => alert('Función de invitación pendiente')} style={css.btnPrimario}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Invitar nuevo abogado
        </button>
      </div>

      {/* ── ALERTA: usuarios pendientes de aprobación ── */}
      {pendientesAprobacion.length > 0 && (
        <div style={css.alertaPendientes}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <span>
            <strong>{pendientesAprobacion.length}</strong>{' '}
            {pendientesAprobacion.length === 1 ? 'cuenta nueva está' : 'cuentas nuevas están'} pendiente{pendientesAprobacion.length === 1 ? '' : 's'} de aprobación.
          </span>
        </div>
      )}

      {/* Mensaje de confirmación */}
      {mensaje && (
        <div style={css.alertaExito}>
          {mensaje}
        </div>
      )}

      {/* ── TARJETAS DE MÉTRICAS (KPIs) ── */}
      <div style={css.kpiGrid}>
        <div style={css.kpiCard}>
          <span style={css.kpiLabel}>ABOGADOS REGISTRADOS</span>
          <div style={css.kpiValor}>{metricas.totalAbogados}</div>
        </div>
        <div style={css.kpiCard}>
          <span style={css.kpiLabel}>CUENTAS ACTIVAS</span>
          <div style={{ ...css.kpiValor, color: T.green }}>{metricas.totalActivos}</div>
        </div>
        <div style={css.kpiCard}>
          <span style={css.kpiLabel}>CUENTAS SUSPENDIDAS</span>
          <div style={{ ...css.kpiValor, color: T.red }}>{metricas.totalInactivos}</div>
        </div>
      </div>

      {/* ── BARRA DE FILTROS ── */}
      <div style={css.filtrosRow}>
        <div style={css.searchWrap}>
          <svg style={css.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar abogado por nombre o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={css.searchInput}
          />
        </div>
        <select
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          style={css.selectFiltro}
        >
          <option value="Todos">Todos los roles</option>
          <option value="admin">Administradores</option>
          <option value="Abogado">Abogados</option>
          <option value="Colaborador">Colaboradores</option>
        </select>
      </div>

      {/* ── TABLA ── */}
      <div style={css.cardTabla}>
        <table style={css.tabla}>
          <thead>
            <tr style={css.tablaHeader}>
              <th style={{ paddingLeft: 12 }}>Abogado / Empleado</th>
              <th>Correo Electrónico</th>
              <th>Rol del Sistema</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right', paddingRight: 12 }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} style={css.vacio}>
                  No se encontraron usuarios con esos criterios de búsqueda.
                </td>
              </tr>
            ) : (
              usuariosFiltrados.map((usuario) => {
                const esAdmin = usuario.rol?.toLowerCase() === 'admin'
                const cargando = usuarioCargando === usuario.id

                return (
                  <tr key={usuario.id} style={css.filaTabla}>
                    <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={css.avatar}>
                        {usuario.nombre_completo.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span style={css.nombreUsuario}>{usuario.nombre_completo}</span>
                        <span style={css.idUsuario}>ID Interno: #{usuario.id}</span>
                      </div>
                    </td>
                    <td style={{ color: T.textPrimary }}>{usuario.email}</td>
                    <td>
                      <span style={{
                        ...css.badgeRol,
                        background: esAdmin ? T.accentAlpha : T.goldAlpha,
                        color: esAdmin ? T.textAccent : T.gold,
                        borderColor: esAdmin ? 'rgba(58,95,184,0.25)' : 'rgba(212,175,55,0.25)',
                      }}>
                        {usuario.rol}
                      </span>
                    </td>
                    <td>
                      <div style={css.estado(usuario.activo)}>
                        <span style={css.estadoDot(usuario.activo)} />
                        {usuario.activo ? 'Activo' : 'Pendiente'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 12 }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => router.push(`/sistema/perfil/${usuario.id}`)}
                          style={css.btnVerPerfil}
                        >
                          Ver perfil
                        </button>

                        {/* No permitir que el admin se desactive a sí mismo desde aquí */}
                        <button
                          onClick={() => manejarCambioEstado(usuario.id, usuario.activo)}
                          disabled={cargando}
                          style={usuario.activo ? css.btnSuspender : css.btnActivar}
                        >
                          {cargando
                            ? '...'
                            : usuario.activo
                              ? 'Suspender'
                              : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </>
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
    marginBottom: 20,
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

  alertaPendientes: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    background: T.amberAlpha,
    border: '0.5px solid rgba(251,191,36,0.22)',
    color: T.amber,
    padding: '11px 16px',
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 16,
  } as React.CSSProperties,

  alertaExito: {
    background: T.greenAlpha,
    border: '0.5px solid rgba(74,222,128,0.20)',
    color: T.green,
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 16,
  } as React.CSSProperties,

  // KPIs
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 24,
  } as React.CSSProperties,
  kpiCard: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 12,
    padding: '16px 20px',
  } as React.CSSProperties,
  kpiLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: T.textMuted,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
  },
  kpiValor: {
    fontSize: 26,
    fontWeight: 700,
    marginTop: 4,
    color: T.textPrimary,
  } as React.CSSProperties,

  // Filtros
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
    flex: 1,
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
    outline: 'none',
  } as React.CSSProperties,
  selectFiltro: {
    padding: '9px 14px',
    background: T.surfaceLow,
    border: `0.5px solid ${T.border}`,
    borderRadius: 8,
    color: T.textPrimary,
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
  } as React.CSSProperties,

  // Tabla
  cardTabla: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 12,
    overflow: 'hidden',
  } as React.CSSProperties,
  tabla: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
    textAlign: 'left' as const,
  },
  tablaHeader: {
    color: T.textMuted,
    borderBottom: `0.5px solid ${T.border}`,
    height: 40,
  } as React.CSSProperties,
  filaTabla: {
    borderBottom: `0.5px solid ${T.border}`,
    transition: 'background 0.15s',
  } as React.CSSProperties,
  vacio: {
    padding: 24,
    textAlign: 'center' as const,
    color: T.textFaint,
  } as React.CSSProperties,
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: T.surfaceLow,
    border: `0.5px solid ${T.border}`,
    color: T.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  } as React.CSSProperties,
  nombreUsuario: {
    fontWeight: 600,
    color: T.textPrimary,
    display: 'block',
  } as React.CSSProperties,
  idUsuario: {
    fontSize: 11,
    color: T.textFaint,
  } as React.CSSProperties,
  badgeRol: {
    border: '0.5px solid',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  } as React.CSSProperties,
  estado: (activo: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    color: activo ? T.green : T.amber,
  }),
  estadoDot: (activo: boolean) => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: activo ? '#22c55e' : T.amber,
  }),
  btnVerPerfil: {
    background: 'transparent',
    border: `0.5px solid ${T.border}`,
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: T.textMuted,
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties,
  btnActivar: {
    background: T.greenAlpha,
    border: '0.5px solid rgba(74,222,128,0.25)',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: T.green,
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties,
  btnSuspender: {
    background: T.redAlpha,
    border: '0.5px solid rgba(179,67,79,0.25)',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: T.red,
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties,
}