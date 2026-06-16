import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — alineados con layout.tsx (azul marino + dorado)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  surface:     '#0b1220',
  border:      'rgba(255,255,255,0.06)',

  accent:      '#3a5fb8',
  accentAlpha: 'rgba(58,95,184,0.12)',

  gold:        '#d4af37',
  goldAlpha:   'rgba(212,175,55,0.10)',

  green:       '#4ade80',
  greenAlpha:  'rgba(74,222,128,0.08)',

  red:         '#b3434f',
  redAlpha:    'rgba(179,67,79,0.10)',

  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted:   'rgba(255,255,255,0.40)',
  textFaint:   'rgba(255,255,255,0.22)',
  textAccent:  '#8fa8e0',
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE (Server Component)
// ─────────────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Perfil del usuario
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nombre_completo, rol, email')
    .eq('auth_id', user.id)
    .single()

  // Materias
  const { data: materias } = await supabase.from('materias').select('id, nombre')
  const idPorNombre = (nombre: string) => materias?.find((m) => m.nombre === nombre)?.id

  const idCivil   = idPorNombre('Civil')
  const idFamiliar = idPorNombre('Familiar')
  const idPenal   = idPorNombre('Penal')
  const idAmparo  = idPorNombre('Amparo')

  // Conteos
  const [
    { count: countCivilFamiliar },
    { count: countPenal },
    { count: countAmparo },
  ] = await Promise.all([
    supabase.from('expedientes').select('*', { count: 'exact', head: true }).in('materia_id', [idCivil, idFamiliar].filter(Boolean)),
    supabase.from('expedientes').select('*', { count: 'exact', head: true }).eq('materia_id', idPenal),
    supabase.from('expedientes').select('*', { count: 'exact', head: true }).eq('materia_id', idAmparo),
  ])

  const totalExpedientes = (countCivilFamiliar ?? 0) + (countPenal ?? 0) + (countAmparo ?? 0)

  // Últimos 5 expedientes
  const { data: recientes } = await supabase
    .from('expedientes')
    .select('id, numero_expediente, actor, demandado, created_at, materias(nombre)')
    .order('created_at', { ascending: false })
    .limit(5)

  // Fecha
  const hoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const nombreCorto = perfil?.nombre_completo?.split(' ')[0] ?? 'Usuario'

  return (
    <div style={css.content}>

      {/* Saludo + fecha */}
      <div>
        <h1 style={css.heading}>
          Bienvenido, <span style={{ color: T.textAccent }}>{nombreCorto}</span>
        </h1>
        <p style={css.subheading}>
          <span style={css.calDot} />
          {hoy.charAt(0).toUpperCase() + hoy.slice(1)}
        </p>
      </div>

      {/* Resumen rápido — 1 línea */}
      <div style={css.resumenBanner}>
        <span style={{ color: T.textMuted, fontSize: 13 }}>
          Total de expedientes en sistema:&nbsp;
          <strong style={{ color: T.textPrimary }}>{totalExpedientes}</strong>
        </span>
        <span style={css.dividerV} />
        <span style={{ color: T.textMuted, fontSize: 13 }}>
          Activo como&nbsp;<strong style={{ color: T.textAccent, textTransform: 'capitalize' }}>{perfil?.rol ?? '—'}</strong>
        </span>
      </div>

      {/* ── TARJETAS DE CONTEO ── */}
      <div style={css.statsGrid}>
        <StatCard
          label="Civil / Familiar"
          value={countCivilFamiliar ?? 0}
          icon={<IconScale />}
          color={T.accent}
          colorAlpha={T.accentAlpha}
          href="/sistema/expedientes/civil"
        />
        <StatCard
          label="Causas Penales"
          value={countPenal ?? 0}
          icon={<IconGavel />}
          color={T.red}
          colorAlpha={T.redAlpha}
          href="/sistema/expedientes/penal"
        />
        <StatCard
          label="Amparos"
          value={countAmparo ?? 0}
          icon={<IconShield />}
          color={T.gold}
          colorAlpha={T.goldAlpha}
          href="/sistema/expedientes/amparo"
        />
        <StatCard
          label="Total expedientes"
          value={totalExpedientes}
          icon={<IconFolder />}
          color={T.green}
          colorAlpha={T.greenAlpha}
        />
      </div>

      {/* ── EXPEDIENTES RECIENTES ── */}
      {recientes && recientes.length > 0 && (
        <section>
          <div style={css.sectionHeader}>
            <h2 style={css.sectionTitle}>Expedientes recientes</h2>
            <a href="/sistema/expedientes/civil" style={css.verTodos}>Ver todos →</a>
          </div>

          <div style={css.tabla}>
            {/* Cabecera */}
            <div style={{ ...css.tablaFila, ...css.tablaCabecera }}>
              <span>Expediente</span>
              <span style={css.colOcultar}>Actor</span>
              <span style={css.colOcultar}>Demandado</span>
              <span>Materia</span>
              <span style={css.colOcultar}>Fecha</span>
            </div>

            {recientes.map((exp: any) => (
              <a
                key={exp.id}
                href={`/sistema/expedientes/${exp.materias?.nombre?.toLowerCase() ?? 'civil'}/${exp.id}`}
                style={{ ...css.tablaFila, ...css.tablaFilaLink }}
              >
                <span style={{ color: T.textPrimary, fontWeight: 500, fontSize: 13 }}>
                  {exp.numero_expediente}
                </span>
                <span style={{ ...css.colOcultar, fontSize: 13, color: T.textMuted }}>
                  {exp.actor ?? '—'}
                </span>
                <span style={{ ...css.colOcultar, fontSize: 13, color: T.textMuted }}>
                  {exp.demandado ?? '—'}
                </span>
                <span>
                  <MateriaChip nombre={exp.materias?.nombre ?? '—'} />
                </span>
                <span style={{ ...css.colOcultar, fontSize: 12, color: T.textFaint }}>
                  {new Date(exp.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧩 COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon, color, colorAlpha, href,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  colorAlpha: string
  href?: string
}) {
  const inner = (
    <div style={{ ...css.statCard, borderColor: `${color}22` }}>
      <div style={{ ...css.statIcon, background: colorAlpha, color }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, color: T.textPrimary, letterSpacing: '-1px', lineHeight: 1 }}>
          {value}
        </div>
      </div>
      {href && (
        <div style={{ marginLeft: 'auto', color: T.textFaint, fontSize: 18, lineHeight: 1 }}>→</div>
      )}
    </div>
  )

  return href
    ? <a href={href} style={{ textDecoration: 'none' }}>{inner}</a>
    : inner
}

function MateriaChip({ nombre }: { nombre: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Civil:     { bg: T.accentAlpha, color: T.textAccent },
    Familiar:  { bg: T.accentAlpha, color: T.textAccent },
    Penal:     { bg: T.redAlpha,    color: T.red },
    Amparo:    { bg: T.goldAlpha,   color: T.gold },
  }
  const style = map[nombre] ?? { bg: 'rgba(255,255,255,0.06)', color: T.textMuted }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
      background: style.bg, color: style.color,
    }}>
      {nombre}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
const css = {
  content: {
    padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 40px)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 28,
    maxWidth: 1200,
  },

  heading: {
    fontSize: 'clamp(18px, 2.5vw, 24px)',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.5px',
    color: T.textPrimary,
  } as React.CSSProperties,

  subheading: {
    fontSize: 12,
    color: T.textFaint,
    margin: '4px 0 0',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    textTransform: 'capitalize' as const,
  },

  calDot: {
    display: 'inline-block' as const,
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: T.accent,
  },

  resumenBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 10,
    padding: '10px 18px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  dividerV: {
    display: 'inline-block' as const,
    width: 1,
    height: 14,
    background: T.border,
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14,
  } as React.CSSProperties,

  statCard: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 12,
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    transition: 'border-color 0.15s, background 0.15s',
    cursor: 'pointer',
  } as React.CSSProperties,

  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: T.textMuted,
    margin: 0,
    letterSpacing: '-0.1px',
  } as React.CSSProperties,

  verTodos: {
    fontSize: 12,
    color: T.textAccent,
    textDecoration: 'none',
    fontWeight: 500,
  } as React.CSSProperties,

  tabla: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 12,
    overflow: 'hidden',
  } as React.CSSProperties,

  tablaFila: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr 1fr 100px 110px',
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

  tablaFilaLink: {
    textDecoration: 'none',
    color: 'inherit',
    transition: 'background 0.12s',
  } as React.CSSProperties,

  colOcultar: {
    // En producción: @media (max-width: 640px) { display: none }
    // Con Tailwind: className="hidden sm:block"
  } as React.CSSProperties,
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔷 ICONOS SVG
// ─────────────────────────────────────────────────────────────────────────────
function IconScale() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 6l9-3 9 3M6 12l-3 6h6l-3-6zm12 0l-3 6h6l-3-6z"/>
    </svg>
  )
}
function IconGavel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 13-8.5 8.5a2.121 2.121 0 1 1-3-3L11 10"/>
      <path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>
    </svg>
  )
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
function IconFolder() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L11 7h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
    </svg>
  )
}