// app/perfil/cliente.tsx
'use client'

import { useRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
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
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface PerfilProps {
  usuario: any
  expedientes: any[]
  conteoTareas: number
  conteoEventos: number
  actividad: any[]
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function PerfilUsuarioCliente({
  usuario,
  expedientes,
  conteoTareas,
  conteoEventos,
  actividad,
}: PerfilProps) {
  const router = useRouter()

  const formatearFecha = (fechaStr: string) => {
    if (!fechaStr) return '—'
    return new Date(fechaStr).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  const iniciales = usuario.nombre_completo
    ?.split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase() ?? 'US'

  return (
    <div style={css.page}>

      {/* ── HEADER ── */}
      <div style={css.headerRow}>
        <span style={css.breadcrumb}>
          Usuarios &rsaquo;{' '}
          <span style={{ color: T.textPrimary }}>{usuario.nombre_completo}</span>
        </span>
        <div style={css.headerActions}>
          <button style={css.btnGhost}>Desactivar</button>
          <button style={css.btnPrimary}>Editar perfil</button>
        </div>
      </div>

      {/* ── TÍTULO ── */}
      <div style={css.titleRow}>
        <button onClick={() => router.back()} style={css.btnBack}>←</button>
        <h1 style={css.heading}>Perfil de usuario</h1>
      </div>

      {/* ── GRID PRINCIPAL ── */}
      <div style={css.grid}>

        {/* COLUMNA IZQUIERDA */}
        <div style={css.col}>

          {/* Tarjeta de identidad */}
          <div style={{ ...css.card, textAlign: 'center', padding: '24px 20px' }}>
            <div style={css.avatar}>{iniciales}</div>
            <div style={css.nombre}>{usuario.nombre_completo}</div>
            <div style={css.email}>{usuario.email}</div>
            <MateriaChip nombre={usuario.rol ?? 'Abogado'} />
            <div style={css.estadoFila}>
              <span style={css.dotVerde} />
              Cuenta activa
            </div>
          </div>

          {/* Datos de la cuenta */}
          <div style={css.card}>
            <p style={css.sectionTitle}>Datos de la cuenta</p>
            {[
              ['Nombre completo',    usuario.nombre_completo],
              ['Correo electrónico', usuario.email],
              ['Rol asignado',       usuario.rol ?? '—'],
              ['Fecha de alta',      formatearFecha(usuario.fecha_alta)],
              ['Último acceso',      'Hoy · 08:50 am'],
            ].map(([label, val]) => (
              <div key={label} style={css.datumRow}>
                <span style={css.datumLabel}>{label}</span>
                <span style={css.datumVal}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div style={css.col}>

          {/* KPIs */}
          <div style={css.kpiGrid}>
            <KpiCard label="Expedientes"    value={expedientes.length} />
            <KpiCard label="Tareas activas" value={conteoTareas} />
            <KpiCard label="Aud. próximas"  value={conteoEventos} />
          </div>

          {/* Tabla de expedientes */}
          <div style={css.card}>
            <p style={css.sectionTitle}>Expedientes asignados</p>
            <div style={css.tabla}>
              <div style={{ ...css.tablaFila, ...css.tablaCabecera }}>
                <span>No. Expediente</span>
                <span>Quejoso / Asunto</span>
                <span>Materia</span>
                <span style={{ textAlign: 'right' }}>Estado</span>
              </div>

              {expedientes.length === 0 ? (
                <div style={{ padding: '16px 18px', fontSize: 13, color: T.textMuted }}>
                  Sin expedientes asignados.
                </div>
              ) : (
                expedientes.map((exp: any) => (
                  <div key={exp.id} style={css.tablaFila}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: T.textPrimary }}>
                      {exp.numero_expediente}
                    </span>
                    <span style={{ fontSize: 13, color: T.textMuted }}>
                      {exp.quejoso ?? '—'}
                    </span>
                    <span>
                      <MateriaChip nombre={exp.tipo_amparo ?? exp.materia ?? 'Amparo'} />
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <EstadoChip estado={exp.estado_tramite ?? exp.estado ?? 'En trámite'} />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actividad reciente */}
          <div style={css.card}>
            <p style={css.sectionTitle}>Actividad reciente</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {actividad.length === 0 ? (
                <span style={{ fontSize: 13, color: T.textMuted }}>
                  Sin actividad registrada.
                </span>
              ) : (
                actividad.map((act: any) => (
                  <div key={act.id} style={css.logFila}>
                    <span style={css.logDot} />
                    <div>
                      <div style={css.logTexto}>
                        {act.descripcion ?? 'Realizó cambios en el sistema'}
                      </div>
                      <div style={css.logFecha}>{formatearFecha(act.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧩 COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={css.kpiCard}>
      <div style={css.kpiLabel}>{label}</div>
      <div style={css.kpiValue}>{value}</div>
    </div>
  )
}

function MateriaChip({ nombre }: { nombre: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Civil:    { bg: T.accentAlpha, color: T.textAccent },
    Familiar: { bg: T.accentAlpha, color: T.textAccent },
    Penal:    { bg: T.redAlpha,    color: T.red },
    Amparo:   { bg: T.goldAlpha,   color: T.gold },
    Abogado:  { bg: T.accentAlpha, color: T.textAccent },
  }
  const s = map[nombre] ?? { bg: 'rgba(255,255,255,0.06)', color: T.textMuted }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px',
      borderRadius: 20, background: s.bg, color: s.color,
      display: 'inline-block',
    }}>
      {nombre}
    </span>
  )
}

function EstadoChip({ estado }: { estado: string }) {
  const esActivo = /activ/i.test(estado)
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      display: 'inline-block',
      background: esActivo ? T.greenAlpha : T.goldAlpha,
      color:      esActivo ? T.green      : T.gold,
    }}>
      {estado}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
const css = {
  // ✅ Sin background ni minHeight — el layout ya provee el fondo
  page: {
  padding:    'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 40px)',
  display:    'flex',
  flexDirection: 'column' as const,
  gap:        20,
  width:      '100%',                   // ← agregar
  maxWidth:   1200,
  boxSizing:  'border-box' as const,    // ← agregar
},

  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,

  breadcrumb: {
    fontSize: 12,
    color: T.textMuted,
    fontWeight: 500,
  } as React.CSSProperties,

  headerActions: {
    display: 'flex',
    gap: 10,
  } as React.CSSProperties,

  btnGhost: {
    background: 'transparent',
    border: `0.5px solid rgba(255,255,255,0.12)`,
    borderRadius: 8,
    padding: '7px 16px',
    fontSize: 12,
    fontWeight: 500,
    color: T.textMuted,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  btnPrimary: {
    background: T.accent,
    border: 'none',
    borderRadius: 8,
    padding: '7px 16px',
    fontSize: 12,
    fontWeight: 600,
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,

  btnBack: {
    background: T.surface,
    border: `0.5px solid rgba(255,255,255,0.12)`,
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
  } as React.CSSProperties,

  heading: {
    fontSize: 'clamp(18px, 2.5vw, 22px)',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.5px',
    color: T.textPrimary,
  } as React.CSSProperties,

  // ✅ minmax(0, 1fr) evita desbordamiento de la columna derecha
  grid: {
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr)',
    gap: 20,
    alignItems: 'start',
  } as React.CSSProperties,

  col: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },

  card: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 12,
    padding: 20,
  } as React.CSSProperties,

  avatar: {
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

  nombre: {
    fontSize: 16,
    fontWeight: 700,
    color: T.textPrimary,
    marginBottom: 4,
  } as React.CSSProperties,

  email: {
    fontSize: 12,
    color: T.textMuted,
    marginBottom: 14,
  } as React.CSSProperties,

  estadoFila: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    fontSize: 12,
    color: T.textMuted,
  } as React.CSSProperties,

  dotVerde: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: T.green,
    display: 'inline-block',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: T.textPrimary,
    margin: '0 0 14px 0',
  } as React.CSSProperties,

  datumRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    padding: '10px 0',
    borderBottom: `0.5px solid ${T.border}`,
  },

  datumLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: T.textMuted,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  },

  datumVal: {
    fontSize: 13,
    fontWeight: 500,
    color: T.textPrimary,
  } as React.CSSProperties,

  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  } as React.CSSProperties,

  kpiCard: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 12,
    padding: '16px',
    textAlign: 'center' as const,
  },

  kpiLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: T.textFaint,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  } as React.CSSProperties,

  kpiValue: {
    fontSize: 32,
    fontWeight: 700,
    color: T.textPrimary,
    letterSpacing: '-1px',
    lineHeight: 1,
  } as React.CSSProperties,

  tabla: {
    border: `0.5px solid ${T.border}`,
    borderRadius: 10,
    overflow: 'hidden',
  } as React.CSSProperties,

  // ✅ minmax(0, ...) en todas las columnas flexibles
  tablaFila: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1.2fr) 100px 100px',
    padding: '11px 18px',
    borderBottom: `0.5px solid ${T.border}`,
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,

  tablaCabecera: {
    fontSize: 11,
    fontWeight: 500,
    color: T.textFaint,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    background: '#080b14',
  },

  logFila: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  } as React.CSSProperties,

  logDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: T.accent,
    flexShrink: 0,
    marginTop: 5,
    display: 'inline-block',
  } as React.CSSProperties,

  logTexto: {
    fontSize: 13,
    fontWeight: 500,
    color: T.textPrimary,
  } as React.CSSProperties,

  logFecha: {
    fontSize: 12,
    color: T.textFaint,
    marginTop: 2,
  } as React.CSSProperties,
}