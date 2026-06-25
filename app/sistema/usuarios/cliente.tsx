'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cambiarEstadoUsuario } from './actions'

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

interface Metricas { totalAbogados: number; totalActivos: number; totalInactivos: number }
interface UsuariosClienteProps { usuariosIniciales: any[]; metricas: Metricas }

export default function UsuariosCliente({ usuariosIniciales, metricas }: UsuariosClienteProps) {
  const router = useRouter()
  const [busqueda, setBusqueda]           = useState('')
  const [filtroRol, setFiltroRol]         = useState('Todos')
  const [, startTransition]               = useTransition()
  const [usuarioCargando, setUsuarioCargando] = useState<number | null>(null)
  const [mensaje, setMensaje]             = useState<string | null>(null)

  const usuariosFiltrados = usuariosIniciales.filter((u) => {
    const ok = u.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
               u.email.toLowerCase().includes(busqueda.toLowerCase())
    return ok && (filtroRol === 'Todos' || u.rol === filtroRol)
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
      <style>{`
        .u-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .u-filtros { display: flex; gap: 10px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
        .u-search { position: relative; display: flex; align-items: center; flex: 1; min-width: 200px; }
        /* Columnas que se ocultan en mobile */
        .u-col-email { }
        .u-col-rol { }
        .u-col-accion { text-align: right; padding-right: 12px; }
        .u-td-nombre { padding: 12px; display: flex; align-items: center; gap: 12px; }
        .u-btn-accion { display: flex; gap: 8px; justify-content: flex-end; }
        @media (max-width: 700px) {
          .u-col-email { display: none; }
          .u-col-rol   { display: none; }
          .u-td-email  { display: none; }
          .u-td-rol    { display: none; }
          .u-btn-ver   { display: none; }
        }
        @media (max-width: 480px) {
          .u-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      {/* ── ENCABEZADO ── */}
      <div className="u-header">
        <div>
          <h1 style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, color: T.textPrimary, margin: 0, letterSpacing: '-0.5px' }}>
            Control de Usuarios
          </h1>
          <p style={{ fontSize: 13, color: T.textMuted, margin: '5px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: T.accent }} />
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

      {/* ── ALERTA pendientes ── */}
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

      {/* ── MENSAJE ── */}
      {mensaje && (
        <div style={{ background: T.greenAlpha, border: '0.5px solid rgba(74,222,128,0.20)', color: T.green, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
          {mensaje}
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'ABOGADOS REGISTRADOS', valor: metricas.totalAbogados, color: T.textPrimary },
          { label: 'CUENTAS ACTIVAS',      valor: metricas.totalActivos,   color: T.green },
          { label: 'CUENTAS SUSPENDIDAS',  valor: metricas.totalInactivos, color: T.red },
        ].map(({ label, valor, color }) => (
          <div key={label} style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color }}>{valor}</div>
          </div>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div className="u-filtros">
        <div className="u-search">
          <svg style={{ position: 'absolute', left: 11, color: T.textFaint, pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 33px', background: T.surfaceLow, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.textPrimary, fontSize: 13, outline: 'none' }}
          />
        </div>
        <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}
          style={{ padding: '9px 14px', background: T.surfaceLow, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.textPrimary, fontSize: 13, cursor: 'pointer', outline: 'none' }}>
          <option value="Todos">Todos los roles</option>
          <option value="admin">Administradores</option>
          <option value="Abogado">Abogados</option>
          <option value="Colaborador">Colaboradores</option>
        </select>
      </div>

      {/* ── TABLA ── */}
      <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ color: T.textMuted, borderBottom: `0.5px solid ${T.border}`, height: 40 }}>
              <th style={{ paddingLeft: 12 }}>Abogado</th>
              <th className="u-col-email">Correo</th>
              <th className="u-col-rol">Rol</th>
              <th>Estado</th>
              <th className="u-col-accion">Acción</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: T.textFaint }}>
                  No se encontraron usuarios con esos criterios.
                </td>
              </tr>
            ) : usuariosFiltrados.map((usuario) => {
              const esAdmin  = usuario.rol?.toLowerCase() === 'admin'
              const cargando = usuarioCargando === usuario.id

              return (
                <tr key={usuario.id} style={{ borderBottom: `0.5px solid ${T.border}` }}>
                  <td className="u-td-nombre">
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.surfaceLow, border: `0.5px solid ${T.border}`, color: T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {usuario.nombre_completo.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: T.textPrimary, display: 'block' }}>{usuario.nombre_completo}</span>
                      <span style={{ fontSize: 11, color: T.textFaint }}>#{usuario.id}</span>
                    </div>
                  </td>
                  <td className="u-td-email" style={{ color: T.textPrimary }}>{usuario.email}</td>
                  <td className="u-td-rol">
                    <span style={{ border: '0.5px solid', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: esAdmin ? T.accentAlpha : T.goldAlpha, color: esAdmin ? T.textAccent : T.gold, borderColor: esAdmin ? 'rgba(58,95,184,0.25)' : 'rgba(212,175,55,0.25)' }}>
                      {usuario.rol}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: usuario.activo ? T.green : T.amber }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: usuario.activo ? '#22c55e' : T.amber }} />
                      {usuario.activo ? 'Activo' : 'Pendiente'}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: 12 }}>
                    <div className="u-btn-accion">
                      <button className="u-btn-ver" onClick={() => router.push(`/sistema/perfil/${usuario.id}`)} style={css.btnVerPerfil}>
                        Ver perfil
                      </button>
                      <button onClick={() => manejarCambioEstado(usuario.id, usuario.activo)} disabled={cargando}
                        style={usuario.activo ? css.btnSuspender : css.btnActivar}>
                        {cargando ? '...' : usuario.activo ? 'Suspender' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

const css = {
  btnPrimario: { display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: '#3a5fb8', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 } as React.CSSProperties,
  alertaPendientes: { display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.22)', color: '#fbbf24', padding: '11px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 } as React.CSSProperties,
  btnVerPerfil: { background: 'transparent', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.40)', cursor: 'pointer' } as React.CSSProperties,
  btnActivar:   { background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.25)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#4ade80', cursor: 'pointer' } as React.CSSProperties,
  btnSuspender: { background: 'rgba(179,67,79,0.10)', border: '0.5px solid rgba(179,67,79,0.25)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#b3434f', cursor: 'pointer' } as React.CSSProperties,
}