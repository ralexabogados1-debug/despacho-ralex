'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTema } from '@/app/sistema/layout'
import { leerSesionLocal } from '@/lib/authLocal'
import { query } from '@/lib/dbHelpers'
import { hayConexionReal } from '@/lib/checkconnection'
import { actualizarPerfilUsuario } from './actions'

// ── TOKENS (sin cambios) ─────────────────────────────────────────────
const T_DARK = {
  surface:      '#0b1220',
  border:       'rgba(255,255,255,0.06)',
  accent:       '#3a5fb8',
  accentAlpha:  'rgba(58,95,184,0.12)',
  accentBorder: 'rgba(58,95,184,0.30)',
  gold:         '#d4af37',
  goldAlpha:    'rgba(212,175,55,0.10)',
  green:        '#4ade80',
  greenAlpha:   'rgba(74,222,128,0.08)',
  red:          '#b3434f',
  redAlpha:     'rgba(179,67,79,0.10)',
  textPrimary:  'rgba(255,255,255,0.85)',
  textMuted:    'rgba(255,255,255,0.40)',
  textFaint:    'rgba(255,255,255,0.22)',
  textAccent:   '#8fa8e0',
  bg:           '#070b14',
  surfaceHover: '#0f1828',
}

const T_LIGHT = {
  surface:      '#ffffff',
  border:       'rgba(0,0,0,0.08)',
  accent:       '#2b5fb0',
  accentAlpha:  'rgba(43,95,176,0.08)',
  accentBorder: 'rgba(43,95,176,0.20)',
  gold:         '#b8860b',
  goldAlpha:    'rgba(184,134,11,0.08)',
  green:        '#16a34a',
  greenAlpha:   'rgba(22,163,74,0.06)',
  red:          '#dc2626',
  redAlpha:     'rgba(220,38,38,0.06)',
  textPrimary:  'rgba(0,0,0,0.85)',
  textMuted:    'rgba(0,0,0,0.50)',
  textFaint:    'rgba(0,0,0,0.30)',
  textAccent:   '#1e3a8a',
  bg:           '#f5f7fa',
  surfaceHover: '#f9fafb',
}

interface PerfilProps {
  usuario: any
  expedientes: any[]
  conteoTareas: number
  conteoEventos: number
  onPerfilActualizado?: () => Promise<void>   // ✅ callback para refrescar los datos del padre
}

export default function PerfilUsuarioCliente({ usuario, expedientes, conteoTareas, conteoEventos, onPerfilActualizado }: PerfilProps) {
  const { oscuro } = useTema()
  const T = oscuro ? T_DARK : T_LIGHT
  const router = useRouter()

  const [modalAbierto, setModalAbierto] = useState(false)
  const [errorForm, setErrorForm]       = useState<string | null>(null)
  const [guardando, setGuardando]       = useState(false)

  const styles = useMemo(() => getStyles(T, oscuro), [T, oscuro])

  const formatearFecha = (fechaStr: string) => {
    if (!fechaStr) return '—'
    return new Date(fechaStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const iniciales = usuario.nombre_completo?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() ?? 'US'

  const abrirEdicion = () => {
    setErrorForm(null)
    setModalAbierto(true)
  }

  return (
    <div style={styles.root}>
      <style>{`
        .perfil-grid {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
        }
        .t-contenedor {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .t-min-ancho {
          min-width: 500px;
        }
        .t-fila {
          display: grid;
          grid-template-columns: 1.2fr 1.2fr 100px 100px;
          padding: 11px 18px;
          border-bottom: 0.5px solid ${T.border};
          align-items: center;
          gap: 12px;
        }
        .t-col-hide { display: block; }

        .p-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px 16px;
          margin-bottom: 8px;
        }
        .p-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .p-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 12px;
          padding-top: 20px;
          border-top: 0.5px solid ${T.border};
        }

        @media (max-width: 900px) {
          .perfil-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 640px) {
          .p-footer {
            flex-direction: column;
            gap: 10px;
          }
          .p-footer button {
            width: 100%;
            padding: 10px 16px;
          }
          .t-fila {
            grid-template-columns: 1fr 100px;
            padding: 10px 14px;
          }
          .t-col-hide { display: none; }
          .t-min-ancho { min-width: 0; }
        }

        @media (max-width: 420px) {
          .kpi-grid { 
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); 
          }
        }
      `}</style>

      {/* ─── HEADER ─── */}
      <div className="p-header">
        <div className="p-header-left">
          <span style={{ fontSize: 12, color: T.textMuted }}>
            Mi perfil &rsaquo; <span style={{ color: T.textPrimary }}>{usuario.nombre_completo}</span>
          </span>
        </div>
      </div>

      {/* ─── TÍTULO Y VOLVER ─── */}
      <div className="title-row">
        <button onClick={() => router.back()} aria-label="Volver" style={styles.btnBack}>←</button>
        <h1 style={styles.pageTitle}>Perfil de usuario</h1>
      </div>

      {/* ─── GRID PRINCIPAL ─── */}
      <div className="perfil-grid">

        {/* Columna izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={styles.cardCenter}>
            <div style={styles.avatarLarge}>{iniciales}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 4, overflowWrap: 'anywhere' }}>{usuario.nombre_completo}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, overflowWrap: 'anywhere' }}>{usuario.email}</div>
            <MateriaChip nombre={usuario.rol ?? 'Abogado'} T={T} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, fontSize: 12, color: T.textMuted }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: usuario.activo ? T.green : T.red, display: 'inline-block' }} />
              {usuario.activo ? 'Cuenta activa' : 'Cuenta inactiva'}
            </div>
          </div>

          <div style={styles.card}>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: '0 0 14px' }}>Datos de la cuenta</p>
            {[
              ['Nombre completo',    usuario.nombre_completo],
              ['Correo electrónico', usuario.email],
              ['Rol asignado',       usuario.rol ?? '—'],
              ['Fecha de alta',      formatearFecha(usuario.created_at ?? usuario.fecha_alta)],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 0', borderBottom: `0.5px solid ${T.border}` }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary, overflowWrap: 'anywhere' }}>{val}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Columna derecha */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="kpi-grid">
            {[
              { label: 'Expedientes',    value: expedientes.length },
              { label: 'Tareas activas', value: conteoTareas },
              { label: 'Aud. próximas',  value: conteoEventos },
            ].map(({ label, value }) => (
              <div key={label} style={styles.kpiCard}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.textFaint, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: T.textPrimary, letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: '0 0 14px' }}>Expedientes asignados</p>
            
            <div style={{ border: `0.5px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div className="t-contenedor">
                <div className="t-min-ancho">
                  <div className="t-fila" style={{ fontSize: 11, fontWeight: 500, color: T.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase', background: T.surfaceHover }}>
                    <span>No. Expediente</span>
                    <span className="t-col-hide">Quejoso / Asunto</span>
                    <span className="t-col-hide">Materia</span>
                    <span style={{ textAlign: 'right' }}>Estado</span>
                  </div>
                  {expedientes.length === 0 ? (
                    <div style={{ padding: '28px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: 13, color: T.textMuted, textAlign: 'center' }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: T.textFaint }}>
                        <path d="M3 7a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L11 7h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
                      </svg>
                      No hay expedientes asignados actualmente.
                    </div>
                  ) : expedientes.map((exp: any) => (
                    <div key={exp.id} className="t-fila">
                      <span style={{ fontWeight: 600, fontSize: 13, color: T.textPrimary, overflowWrap: 'anywhere' }}>{exp.numero_expediente}</span>
                      <span className="t-col-hide" style={{ fontSize: 13, color: T.textMuted }}>{exp.quejoso ?? '—'}</span>
                      <span className="t-col-hide"><MateriaChip nombre={exp.tipo_amparo ?? exp.materia ?? 'Amparo'} T={T} /></span>
                      <span style={{ textAlign: 'right' }}><EstadoChip estado={exp.estado_tramite ?? exp.estado ?? 'En trámite'} T={T} /></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
          </div>

        </div>
      </div>

      {/* ─── PIE DE PÁGINA ─── */}
      <div className="p-footer">
        <button style={styles.btnOutline}>
          Desactivar cuenta
        </button>
        <button style={styles.btnPrimario} onClick={abrirEdicion}>
          Editar perfil
        </button>
      </div>

      {/* ─── MODAL EDITAR PERFIL ─── */}
      {modalAbierto && (
        <div
          style={{
            position: 'fixed', inset: 0, background: oscuro ? 'rgba(3,7,18,0.75)' : 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '16px', overflowY: 'auto', zIndex: 100,
          }}
          onClick={() => setModalAbierto(false)}
        >
          <div
            style={{
              background: T.surface, border: `0.5px solid ${T.border}`,
              borderRadius: 16, padding: '24px 20px',
              width: '100%', maxWidth: 440,
              maxHeight: '90vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: T.textPrimary }}>
              Editar perfil
            </h3>
            <p style={{ color: T.textMuted, fontSize: 12, marginTop: 0, marginBottom: 20 }}>
              Actualiza tu nombre. El correo electrónico no puede modificarse aquí.
            </p>

            {errorForm && (
              <p style={{ color: T.red, background: T.redAlpha, padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                {errorForm}
              </p>
            )}

            <form action={async (fd) => {
              setErrorForm(null)
              setGuardando(true)
              const nombre = (fd.get('nombre_completo') as string)?.trim()
              if (!nombre) {
                setErrorForm('El nombre es obligatorio')
                setGuardando(false)
                return
              }

              try {
                const sesion = leerSesionLocal()
                if (!sesion?.email) {
                  setErrorForm('No se pudo identificar al usuario. Vuelve a iniciar sesión.')
                  setGuardando(false)
                  return
                }

                // 1. Siempre actualizar en la base local
                await query(
                  `UPDATE usuarios SET nombre_completo = ? WHERE email = ?`,
                  [nombre, sesion.email]
                )

                // 2. Si hay internet, intentar sincronizar con el servidor
                const online = await hayConexionReal()
                if (online) {
                  try {
                    const res = await actualizarPerfilUsuario(fd)
                    if (res?.error) {
                      console.warn('No se pudo sincronizar con el servidor:', res.error)
                    }
                  } catch (err) {
                    console.warn('Error al sincronizar con Supabase:', err)
                  }
                }

                setModalAbierto(false)

                // 3. Refrescar los datos del padre (si se proporcionó el callback)
                if (onPerfilActualizado) {
                  await onPerfilActualizado()
                } else {
                  router.refresh() // fallback por si el padre no pasó el callback
                }
              } catch (e: any) {
                setErrorForm(e?.message ?? 'Error al actualizar el perfil')
              } finally {
                setGuardando(false)
              }
            }}>
              <div style={{ marginBottom: 14 }}>
                <label style={styles.label}>Nombre completo *</label>
                <input
                  name="nombre_completo" required
                  defaultValue={usuario.nombre_completo ?? ''}
                  style={styles.input}
                  placeholder="Ej: Juan Pérez López"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={styles.label}>Correo electrónico</label>
                <input
                  value={usuario.email ?? ''}
                  disabled
                  style={{ ...styles.input, opacity: 0.5, cursor: 'not-allowed' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setModalAbierto(false)}
                  style={{ background: 'transparent', color: T.textMuted, border: 'none', cursor: 'pointer', fontSize: 13, padding: '10px 8px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}
                  style={{ ...styles.btnPrimario, padding: '10px 24px', opacity: guardando ? 0.6 : 1 }}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes (sin cambios) ────────────────────────────────────
function MateriaChip({ nombre, T }: { nombre: string; T: typeof T_DARK }) {
  const map: Record<string, { bg: string; color: string }> = {
    Civil:    { bg: T.accentAlpha, color: T.textAccent },
    Familiar: { bg: T.accentAlpha, color: T.textAccent },
    Penal:    { bg: T.redAlpha,    color: T.red },
    Amparo:   { bg: T.goldAlpha,   color: T.gold },
    Abogado:  { bg: T.accentAlpha, color: T.textAccent },
    admin:    { bg: T.goldAlpha,   color: T.gold },
  }
  const s = map[nombre] ?? { bg: T.border, color: T.textMuted }
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, display: 'inline-block' }}>{nombre}</span>
}

function EstadoChip({ estado, T }: { estado: string; T: typeof T_DARK }) {
  const esActivo = /activ/i.test(estado)
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'inline-block', background: esActivo ? T.greenAlpha : T.goldAlpha, color: esActivo ? T.green : T.gold }}>{estado}</span>
}

// ─── Estilos dinámicos ────────────────────────────────────────────────
function getStyles(T: typeof T_DARK, oscuro: boolean) {
  return {
    root: {
      width: '100%',
      padding: 'clamp(16px, 3vw, 40px) clamp(12px, 3vw, 40px)',
      boxSizing: 'border-box' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 20,
    },
    pageTitle: {
      fontSize: 'clamp(18px, 2.5vw, 22px)',
      fontWeight: 700,
      margin: 0,
      letterSpacing: '-0.5px',
      color: T.textPrimary,
    } as React.CSSProperties,
    btnPrimario: {
      background: T.accent,
      border: 'none',
      borderRadius: 8,
      padding: '8px 16px',
      fontSize: 12,
      fontWeight: 600,
      color: '#fff',
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'background 0.15s',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,
    btnOutline: {
      background: 'transparent',
      border: `0.5px solid ${T.border}`,
      borderRadius: 8,
      padding: '8px 16px',
      fontSize: 12,
      fontWeight: 500,
      color: T.textMuted,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'background 0.15s, border-color 0.15s',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,
    btnBack: {
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 8,
      width: 34,
      height: 34,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      fontWeight: 700,
      color: T.textPrimary,
      cursor: 'pointer',
      fontFamily: 'inherit',
      flexShrink: 0,
    } as React.CSSProperties,
    card: {
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 12,
      padding: 20,
    } as React.CSSProperties,
    cardCenter: {
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 12,
      padding: '28px 20px',
      textAlign: 'center' as const,
    } as React.CSSProperties,
    avatarLarge: {
      width: 60,
      height: 60,
      borderRadius: '50%',
      background: T.accentAlpha,
      border: `0.5px solid ${T.accentBorder}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      fontWeight: 700,
      color: T.textAccent,
      margin: '0 auto 14px',
    } as React.CSSProperties,
    kpiCard: {
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 12,
      padding: '14px 16px',
      textAlign: 'center' as const,
    } as React.CSSProperties,
    label: {
      display: 'block',
      fontSize: 12,
      color: T.textMuted,
      marginBottom: 6,
      fontWeight: 500,
    } as React.CSSProperties,
    input: {
      width: '100%',
      padding: '10px 12px',
      border: `0.5px solid ${T.border}`,
      borderRadius: 8,
      background: T.surfaceHover,
      color: T.textPrimary,
      fontSize: 14,
      boxSizing: 'border-box' as const,
      outline: 'none',
      fontFamily: 'inherit',
    } as React.CSSProperties,
  }
}