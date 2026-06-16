import { registrar } from './actions'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — idénticos a login-page.tsx y dashboard.tsx
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:          '#0b1220',
  surface:     '#0f1a2e',
  surfaceHigh: '#162236',
  border:      'rgba(255,255,255,0.08)',
  accent:      '#3a5fb8',
  gold:        '#d4af37',
  textPrimary: 'rgba(255,255,255,0.90)',
  textMuted:   'rgba(255,255,255,0.42)',
  textFaint:   'rgba(255,255,255,0.24)',
  textAccent:  '#8fa8e0',
  red:         '#f87171',
  redAlpha:    'rgba(248,113,113,0.08)',
}

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <div style={css.shell}>
      <div style={css.bgGlow} />

      <div style={css.center}>

        {/* Logo */}
        <div style={css.logoRow}>
          <div style={css.logoMark}>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.gold, letterSpacing: '-0.5px' }}>JL</span>
          </div>
          <div>
            <div style={css.logoNombre}>Jurídico Legal</div>
            <div style={css.logoSub}>Sistema de Gestión Jurídica</div>
          </div>
        </div>

        {/* Tarjeta */}
        <div style={css.card}>

          <div style={css.cardHeader}>
            <h1 style={css.titulo}>Crear cuenta</h1>
            <p style={css.subtitulo}>Completa el formulario para registrarte en el sistema</p>
          </div>

          {params.error && (
            <div style={css.alertaError}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              {params.error}
            </div>
          )}

          <form action={registrar} style={css.form}>

            {/* Nombre y apellidos en fila */}
            <div style={css.fila}>
              <div style={css.campo}>
                <label style={css.label}>Nombre</label>
                <div style={css.inputWrap}>
                  <svg style={css.inputIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/>
                  </svg>
                  <input name="nombre" type="text" placeholder="Juan" required style={css.input} />
                </div>
              </div>
              <div style={css.campo}>
                <label style={css.label}>Apellidos</label>
                <div style={css.inputWrap}>
                  <svg style={css.inputIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/>
                  </svg>
                  <input name="apellidos" type="text" placeholder="Pérez García" required style={css.input} />
                </div>
              </div>
            </div>

            {/* Correo */}
            <div style={css.campo}>
              <label style={css.label}>Correo electrónico</label>
              <div style={css.inputWrap}>
                <svg style={css.inputIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <input name="email" type="email" placeholder="correo@ejemplo.com" required style={css.input} />
              </div>
            </div>

            {/* Contraseñas en fila */}
            <div style={css.fila}>
              <div style={css.campo}>
                <label style={css.label}>Contraseña</label>
                <div style={css.inputWrap}>
                  <svg style={css.inputIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input name="password" type="password" placeholder="••••••••" required minLength={6} style={css.input} />
                </div>
              </div>
              <div style={css.campo}>
                <label style={css.label}>Confirmar contraseña</label>
                <div style={css.inputWrap}>
                  <svg style={css.inputIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input name="confirmar" type="password" placeholder="••••••••" required minLength={6} style={css.input} />
                </div>
              </div>
            </div>

            {/* Nota de seguridad */}
            <div style={css.nota}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: T.textFaint }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>Mínimo 6 caracteres. Tu contraseña es encriptada de forma segura.</span>
            </div>

            <button type="submit" style={css.btnPrimario}>
              Crear cuenta
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>

          </form>

          <div style={css.cardFooter}>
            <span style={{ color: T.textFaint, fontSize: 13 }}>¿Ya tienes una cuenta?</span>
            <a href="/login" style={css.link}>Iniciar sesión</a>
          </div>

        </div>

        <p style={css.pie}>
          © {new Date().getFullYear()} Jurídico Legal — Acceso restringido
        </p>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
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
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '60%',
    height: '50%',
    background: 'radial-gradient(ellipse at center, rgba(58,95,184,0.12) 0%, transparent 70%)',
    pointerEvents: 'none' as const,
  },

  center: {
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 24,
    position: 'relative' as const,
    zIndex: 1,
  },

  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,

  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 11,
    background: T.surfaceHigh,
    border: `0.5px solid rgba(212,175,55,0.30)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  logoNombre: {
    fontSize: 17,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: '-0.3px',
    lineHeight: 1.2,
  } as React.CSSProperties,

  logoSub: {
    fontSize: 11.5,
    color: T.textFaint,
    marginTop: 1,
  } as React.CSSProperties,

  card: {
    width: '100%',
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 16,
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  },

  cardHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  } as React.CSSProperties,

  titulo: {
    fontSize: 22,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',
    margin: 0,
    letterSpacing: '-0.5px',
  } as React.CSSProperties,

  subtitulo: {
    fontSize: 13,
    color: T.textMuted,
    margin: 0,
  } as React.CSSProperties,

  alertaError: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: T.red,
    background: T.redAlpha,
    border: '0.5px solid rgba(248,113,113,0.20)',
    padding: '10px 13px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
  } as React.CSSProperties,

  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
  },

  fila: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  } as React.CSSProperties,

  campo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 7,
  },

  label: {
    fontSize: 12.5,
    fontWeight: 600,
    color: T.textMuted,
    letterSpacing: '0.01em',
  } as React.CSSProperties,

  inputWrap: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },

  inputIcon: {
    position: 'absolute' as const,
    left: 12,
    color: T.textFaint,
    pointerEvents: 'none' as const,
    flexShrink: 0,
  },

  input: {
    width: '100%',
    padding: '11px 12px 11px 36px',
    background: T.surfaceHigh,
    border: `0.5px solid ${T.border}`,
    borderRadius: 9,
    color: 'rgba(255,255,255,0.90)',
    fontSize: 13.5,
    boxSizing: 'border-box' as const,
    outline: 'none',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,

  nota: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 7,
    fontSize: 11.5,
    color: T.textFaint,
    lineHeight: 1.4,
    padding: '8px 0 0',
  } as React.CSSProperties,

  btnPrimario: {
    marginTop: 4,
    padding: '13px 20px',
    background: T.accent,
    color: 'white',
    border: 'none',
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 0.15s',
    letterSpacing: '-0.1px',
  } as React.CSSProperties,

  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
    borderTop: `0.5px solid ${T.border}`,
  } as React.CSSProperties,

  link: {
    fontSize: 13,
    fontWeight: 600,
    color: T.textAccent,
    textDecoration: 'none',
  } as React.CSSProperties,

  pie: {
    fontSize: 11.5,
    color: T.textFaint,
    textAlign: 'center' as const,
  },
}