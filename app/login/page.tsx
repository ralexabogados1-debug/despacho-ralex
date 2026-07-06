// app/login/page.tsx
import FormularioLogin from './clienteLogin'

const T = {
  bg:          '#0b1220',
  surface:     '#0f1a2e',
  border:      'rgba(255,255,255,0.08)',
  textPrimary: 'rgba(255,255,255,0.90)',
  textMuted:   'rgba(255,255,255,0.42)',
  textFaint:   'rgba(255,255,255,0.24)',
  textAccent:  '#8fa8e0',
  green:       '#4ade80',
  greenAlpha:  'rgba(74,222,128,0.08)',
  red:         '#f87171',
  redAlpha:    'rgba(248,113,113,0.08)',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; registrado?: string }>
}) {
  const params = await searchParams

  return (
    <div style={css.shell}>
      <div style={css.bgGlow} />
      <div style={css.center}>

        {/* Logo */}
        <div style={css.logoRow}>
          <img
            src="/img/Gemini_Generated_Image_wbbwjpwbbwjpwbbw.png"
            alt="Logo"
            style={{
              width: 44, height: 44,
              borderRadius: '50%', objectFit: 'cover',
              flexShrink: 0,
              border: '0.5px solid rgba(212,175,55,0.30)',
            }}
          />
          <div>
            <div style={css.logoNombre}>Jurídico Legal</div>
            <div style={css.logoSub}>Sistema de Gestión Jurídica</div>
          </div>
        </div>

        {/* Tarjeta */}
        <div style={css.card}>
          <div style={css.cardHeader}>
            <h1 style={css.titulo}>Iniciar sesión</h1>
            <p style={css.subtitulo}>Ingresa tus credenciales para continuar</p>
          </div>

          {/* Formulario con lógica offline */}
          <FormularioLogin
            error={params.error}
            registrado={params.registrado}
          />

          <div style={css.cardFooter}>
            <span style={{ color: T.textFaint, fontSize: 13 }}>¿No tienes cuenta?</span>
            <a href="/registro" style={css.link}>Regístrate</a>
          </div>
        </div>

        <p style={css.pie}>
          © {new Date().getFullYear()} Jurídico Legal — Acceso restringido
        </p>
      </div>
    </div>
  )
}

const css = {
  shell: {
    minHeight: '100vh',
    background: T.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    padding: '24px 16px',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'absolute' as const,
    top: '-20%', left: '50%',
    transform: 'translateX(-50%)',
    width: '60%', height: '50%',
    background: 'radial-gradient(ellipse at center, rgba(58,95,184,0.12) 0%, transparent 70%)',
    pointerEvents: 'none' as const,
  },
  center: {
    width: '100%', maxWidth: 420,
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', gap: 24,
    position: 'relative' as const, zIndex: 1,
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 12,
  } as React.CSSProperties,
  logoNombre: {
    fontSize: 17, fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: '-0.3px', lineHeight: 1.2,
  } as React.CSSProperties,
  logoSub: {
    fontSize: 11.5, color: T.textFaint, marginTop: 1,
  } as React.CSSProperties,
  card: {
    width: '100%',
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 16, padding: '32px 28px',
    display: 'flex', flexDirection: 'column' as const, gap: 20,
  },
  cardHeader: {
    display: 'flex', flexDirection: 'column' as const, gap: 4,
  } as React.CSSProperties,
  titulo: {
    fontSize: 22, fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',
    margin: 0, letterSpacing: '-0.5px',
  } as React.CSSProperties,
  subtitulo: {
    fontSize: 13, color: T.textMuted, margin: 0,
  } as React.CSSProperties,
  cardFooter: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingTop: 4, borderTop: `0.5px solid ${T.border}`,
  } as React.CSSProperties,
  link: {
    fontSize: 13, fontWeight: 600,
    color: T.textAccent, textDecoration: 'none',
  } as React.CSSProperties,
  pie: {
    fontSize: 11.5, color: T.textFaint, textAlign: 'center' as const,
  },
}