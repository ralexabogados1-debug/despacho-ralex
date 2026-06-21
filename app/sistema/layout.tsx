'use client'

import React, { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const T = {
  bg:          '#070b14',
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
} as const

type Rol = 'admin' | 'abogado' | 'asistente'

interface Sesion {
  nombre:    string
  iniciales: string
  rol:       Rol
}

const SesionCtx = createContext<Sesion>({ nombre: '', iniciales: '', rol: 'asistente' })
export const useSesion = () => useContext(SesionCtx)

interface NavItem {
  icon:       React.ReactNode
  label:      string
  path:       string
  seccion?:   string
  soloRoles?: Rol[]
}

const MENU: NavItem[] = [
  { icon: <IconDashboard />, label: 'Dashboard',    path: '/sistema/dashboard',          seccion: 'Principal' },
  { icon: <IconScale />,     label: 'Exp. Civiles', path: '/sistema/expedientes/civil',  seccion: 'Principal' },
  { icon: <IconFolder />,    label: 'Exp. Penales', path: '/sistema/expedientes/penal',  seccion: 'Principal' },
  { icon: <IconGavel />,     label: 'Amparos',      path: '/sistema/expedientes/amparo', seccion: 'Principal' },
  { icon: <IconCheck />,     label: 'Tareas',       path: '/sistema/tareas',             seccion: 'Gestión' },
  { icon: <IconCalendar />,  label: 'Agenda',       path: '/sistema/agenda',             seccion: 'Gestión' },
  {
    icon:      <IconUsers />,
    label:     'Usuarios',
    path:      '/sistema/usuarios',
    seccion:   'Administración',
    soloRoles: ['admin'],
  },
]

const BREADCRUMB: Record<string, string> = {
  '/sistema/dashboard':          'Dashboard',
  '/sistema/expedientes/civil':  'Expedientes Civiles',
  '/sistema/expedientes/penal':  'Expedientes Penales',
  '/sistema/expedientes/amparo': 'Amparos',
  '/sistema/tareas':             'Tareas',
  '/sistema/agenda':             'Agenda',
  '/sistema/perfil':             'Mi perfil',
  '/sistema/usuarios':           'Usuarios',
}

export default function SistemaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [sesion, setSesion]               = useState<Sesion>({ nombre: '', iniciales: '', rol: 'asistente' })
  const [cargando, setCargando]           = useState(true)
  const [expandido, setExpandido]         = useState(true)
  const [hovered, setHovered]             = useState<string | null>(null)
  const [menuMobile, setMenuMobile]       = useState(false)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)
  const [isMobile, setIsMobile]           = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 769)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const cargarUsuario = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const nombre    = user.user_metadata?.nombre_completo ?? user.email ?? 'Usuario'
        const iniciales = nombre.split(' ').map((p: string) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
        const rolRaw    = (user.user_metadata?.rol ?? 'asistente') as string
        const rol       = rolRaw.toLowerCase() as Rol
        setSesion({ nombre, iniciales, rol })
      } finally {
        setCargando(false)
      }
    }
    cargarUsuario()
  }, [supabase])

  const handleCerrarSesion = async () => {
    setCerrandoSesion(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const paginaActual = Object.entries(BREADCRUMB)
    .filter(([ruta]) => pathname === ruta || pathname?.startsWith(ruta + '/'))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'Sistema'

  const itemsVisibles = MENU.filter(
    (item) => !item.soloRoles || item.soloRoles.includes(sesion.rol)
  )

  const secciones = itemsVisibles.reduce<{ label: string; items: NavItem[] }[]>(
    (acc, item) => {
      const sec   = item.seccion ?? ''
      const grupo = acc.find((g) => g.label === sec)
      if (grupo) grupo.items.push(item)
      else acc.push({ label: sec, items: [item] })
      return acc
    },
    []
  )

  if (cargando) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const SidebarContent = (
    <>
      <div style={css.logoRow}>
        <div style={css.logoMark}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>JL</span>
        </div>
        <span style={{ ...css.fadeText(expandido || isMobile), fontSize: 13, fontWeight: 600, color: T.textPrimary, letterSpacing: '-0.3px' }}>
          Jurídico Legal
        </span>
      </div>

      <nav style={css.navArea}>
        {secciones.map(({ label, items }) => (
          <div key={label}>
            {label && (
              <span style={{ ...css.sectionLabel, ...css.fadeText(expandido || isMobile) }}>
                {label}
              </span>
            )}
            {items.map((item) => {
              const activo  = pathname === item.path || pathname?.startsWith(`${item.path}/`)
              const hover   = hovered === item.path
              const esAdmin = item.soloRoles?.length === 1 && item.soloRoles[0] === 'admin'

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  title={(!expandido && !isMobile) ? item.label : undefined}
                  onMouseEnter={() => setHovered(item.path)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setMenuMobile(false)}
                  style={{
                    ...css.navItem,
                    background: activo
                      ? T.accentAlpha
                      : hover
                      ? 'rgba(255,255,255,0.04)'
                      : 'transparent',
                  }}
                >
                  {activo && <span style={css.activeBar} />}
                  <span style={{
                    ...css.iconWrap,
                    color: activo ? T.textAccent : hover ? 'rgba(255,255,255,0.7)' : T.textMuted,
                  }}>
                    {item.icon}
                  </span>
                  <span style={{
                    ...css.navLabel,
                    ...css.fadeText(expandido || isMobile),
                    color:      activo ? T.textPrimary : hover ? 'rgba(255,255,255,0.75)' : T.textMuted,
                    fontWeight: activo ? 500 : 400,
                  }}>
                    {item.label}
                  </span>
                  {esAdmin && (expandido || isMobile) && <span style={css.adminBadge}>ADMIN</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={css.sidebarBottom}>
        <Link href="/sistema/perfil" style={css.sidebarFooter} title="Ver mi perfil">
          <div style={css.avatarWrap}>
            <div style={{
              ...css.avatar,
              ...(pathname === '/sistema/perfil'
                ? { borderColor: T.accent, boxShadow: `0 0 0 2px ${T.accentAlpha}` }
                : {}),
            }}>
              {sesion.iniciales}
            </div>
            {sesion.rol === 'admin' && <span style={css.crown}>👑</span>}
          </div>
          <div style={{ ...css.fadeText(expandido || isMobile), overflow: 'hidden', minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sesion.nombre}
            </div>
            <div style={{ fontSize: 11, color: T.textFaint, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
              {sesion.rol} · Ver perfil
            </div>
          </div>
        </Link>

        <button
          onClick={handleCerrarSesion}
          disabled={cerrandoSesion}
          title="Cerrar sesión"
          style={{
            ...css.btnLogout,
            justifyContent: (expandido || isMobile) ? 'flex-start' : 'center',
          }}
        >
          <span style={{ ...css.iconWrap, color: T.red, flexShrink: 0 }}>
            <IconLogout />
          </span>
          <span style={{ ...css.fadeText(expandido || isMobile), fontSize: 13, color: T.red, whiteSpace: 'nowrap' }}>
            {cerrandoSesion ? 'Cerrando...' : 'Cerrar sesión'}
          </span>
        </button>
      </div>
    </>
  )

  return (
    <SesionCtx.Provider value={sesion}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }

        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(58,95,184,0.25) transparent;
        }
        *::-webkit-scrollbar { width: 5px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb {
          background: rgba(58,95,184,0.25);
          border-radius: 3px;
        }
        *::-webkit-scrollbar-thumb:hover {
          background: rgba(58,95,184,0.45);
        }

        /* ── RESPONSIVO ── */
        @media (max-width: 768px) {
          .sidebar-desktop  { display: none !important; }
          .topbar-hamburger { display: flex !important; }
          .topbar-breadcrumb-sistema { display: none !important; }
          .topbar-rol-badge { display: none !important; }
          .footer-links { display: none !important; }
        }
        @media (min-width: 769px) {
          .sidebar-mobile-overlay { display: none !important; }
          .topbar-hamburger { display: none !important; }
        }

        .btn-logout-hover:hover {
          background: rgba(179,67,79,0.08) !important;
        }
        .nav-footer-link:hover {
          background: rgba(255,255,255,0.04) !important;
        }
      `}</style>

      <div style={css.shell}>

        {/* ── SIDEBAR DESKTOP ── */}
        <div
          className="sidebar-desktop"
          style={{
            position:   'relative',
            flexShrink: 0,
            height:     '100%',
            display:    'flex',
            width:      expandido ? 220 : 64,
            transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <aside style={{ ...css.sidebar, width: expandido ? 220 : 64 }}>
            {SidebarContent}
          </aside>

          <button
            onClick={() => setExpandido(!expandido)}
            style={css.toggleBtn}
            aria-label={expandido ? 'Colapsar' : 'Expandir'}
          >
            <span style={css.toggleBtnPanel} />
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{
                transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
                transform:  expandido ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
            >
              <path d="M6 2L3 5l3 3" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* ── SIDEBAR MOBILE (overlay) ── */}
        {menuMobile && (
          <div
            className="sidebar-mobile-overlay"
            style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}
          >
            <div
              onClick={() => setMenuMobile(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }}
            />
            <aside style={{ ...css.sidebar, width: 260, position: 'relative', zIndex: 201, height: '100%' }}>
              {SidebarContent}
            </aside>
          </div>
        )}

        {/* ── ÁREA DERECHA ── */}
        <div style={css.rightArea}>

          {/* TOPBAR */}
          <header style={css.topbar}>

            {/* Hamburguesa — solo mobile */}
            <button
              className="topbar-hamburger"
              onClick={() => setMenuMobile(true)}
              style={{ display: 'none', ...css.hamburger }}
              aria-label="Abrir menú"
            >
              <span style={css.hamburgerLine} />
              <span style={css.hamburgerLine} />
              <span style={css.hamburgerLine} />
            </button>

            {/* Breadcrumb */}
            <div style={css.breadcrumb}>
              <span className="topbar-breadcrumb-sistema" style={{ color: T.textFaint }}>Sistema</span>
              <svg className="topbar-breadcrumb-sistema" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 2l4 4-4 4" stroke={T.textFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ color: T.textMuted, fontWeight: 500, fontSize: 13 }}>{paginaActual}</span>
            </div>

            {/* Badge de rol — oculto en mobile */}
            <div style={css.topbarActions}>
              <div
                className="topbar-rol-badge"
                style={{
                  ...css.rolBadge,
                  ...(sesion.rol === 'admin'
                    ? { background: T.goldAlpha, border: `0.5px solid rgba(212,175,55,0.22)`, color: T.gold }
                    : { background: T.accentAlpha, border: `0.5px solid rgba(58,95,184,0.22)`, color: T.textAccent }),
                }}
              >
                <span style={{ textTransform: 'capitalize' }}>{sesion.rol}</span>
              </div>
            </div>
          </header>

          {/* CONTENIDO */}
          <main style={css.main}>
            {children}
          </main>

          {/* FOOTER */}
          <footer style={css.footerGlobal}>
            <span style={{ color: T.textFaint, fontSize: 12 }}>
              © {new Date().getFullYear()} Jurídico Legal
            </span>
            <div className="footer-links" style={{ display: 'flex', gap: 16 }}>
              <Link href="/sistema/perfil" style={css.footerLink}>Mi perfil</Link>
              <Link href="/sistema/agenda" style={css.footerLink}>Agenda</Link>
              <Link href="/sistema/tareas" style={css.footerLink}>Tareas</Link>
            </div>
          </footer>
        </div>

      </div>
    </SesionCtx.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
const css = {
  shell: {
    display:    'flex',
    height:     '100vh',
    width:      '100%',
    overflow:   'hidden',
    background: T.bg,
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,

  sidebar: {
    background:    T.surface,
    borderRight:   `0.5px solid ${T.border}`,
    display:       'flex',
    flexDirection: 'column' as const,
    padding:       '20px 0',
    height:        '100%',
    boxSizing:     'border-box' as const,
    zIndex:        90,
    transition:    'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow:      'hidden',
    flexShrink:    0,
  },

  toggleBtn: {
    position:       'absolute' as const,
    top:            18,
    right:          -22,
    width:          22,
    height:         32,
    borderRadius:   '0 8px 8px 0',
    background:     '#0f1830',
    border:         `1px solid rgba(58,95,184,0.35)`,
    borderLeft:     'none',
    boxShadow:      '3px 0 12px rgba(0,0,0,0.4)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    cursor:         'pointer',
    zIndex:         100,
    padding:        0,
    gap:            2,
  },

  toggleBtnPanel: {
    display:      'block' as const,
    width:        3,
    height:       18,
    borderRadius: 2,
    background:   'rgba(58,95,184,0.5)',
    flexShrink:   0,
  } as React.CSSProperties,

  logoRow: {
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    padding:      '4px 16px 18px',
    borderBottom: `0.5px solid ${T.border}`,
    marginBottom: 10,
    flexShrink:   0,
  } as React.CSSProperties,

  logoMark: {
    width:          32,
    height:         32,
    borderRadius:   8,
    background:     '#0f1830',
    border:         `0.5px solid rgba(58,95,184,0.35)`,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  } as React.CSSProperties,

  navArea: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column' as const,
    padding:       '0 10px',
    overflowY:     'auto' as const,
  },

  sectionLabel: {
    fontSize:      10,
    fontWeight:    500,
    letterSpacing: '0.08em',
    color:         T.textFaint,
    textTransform: 'uppercase' as const,
    padding:       '12px 8px 4px',
    display:       'block',
    whiteSpace:    'nowrap' as const,
  },

  navItem: {
    display:        'flex',
    alignItems:     'center',
    gap:            10,
    padding:        '9px 8px',
    borderRadius:   8,
    cursor:         'pointer',
    textDecoration: 'none',
    position:       'relative' as const,
    marginBottom:   1,
    transition:     'background 0.15s',
    overflow:       'hidden',
  } as React.CSSProperties,

  activeBar: {
    position:     'absolute' as const,
    left:         0,
    top:          '50%',
    transform:    'translateY(-50%)',
    width:        3,
    height:       18,
    background:   T.accent,
    borderRadius: '0 3px 3px 0',
  },

  iconWrap: {
    width:          20,
    height:         20,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    transition:     'color 0.15s',
  } as React.CSSProperties,

  navLabel: {
    fontSize:      13,
    whiteSpace:    'nowrap' as const,
    transition:    'color 0.15s, opacity 0.18s',
    letterSpacing: '-0.1px',
  } as React.CSSProperties,

  adminBadge: {
    marginLeft:    'auto',
    fontSize:      9,
    fontWeight:    600,
    color:         `${T.gold}cc`,
    background:    T.goldAlpha,
    border:        `0.5px solid rgba(212,175,55,0.22)`,
    borderRadius:  4,
    padding:       '1px 5px',
    letterSpacing: '0.04em',
    flexShrink:    0,
  } as React.CSSProperties,

  sidebarBottom: {
    marginTop:  'auto',
    borderTop:  `0.5px solid ${T.border}`,
    flexShrink: 0,
  } as React.CSSProperties,

  sidebarFooter: {
    padding:        '12px 14px',
    display:        'flex',
    alignItems:     'center',
    gap:            10,
    textDecoration: 'none',
    overflow:       'hidden',
    borderBottom:   `0.5px solid ${T.border}`,
  } as React.CSSProperties,

  avatarWrap: {
    position:   'relative' as const,
    flexShrink: 0,
  },

  avatar: {
    width:          32,
    height:         32,
    borderRadius:   '50%',
    background:     '#0f1830',
    border:         `1.5px solid rgba(58,95,184,0.35)`,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       11,
    fontWeight:     600,
    color:          '#a0b4e8',
    transition:     'border-color 0.15s, box-shadow 0.15s',
  } as React.CSSProperties,

  crown: {
    position: 'absolute' as const,
    top:      -7,
    right:    -5,
    fontSize: 10,
  },

  btnLogout: {
    width:       '100%',
    display:     'flex',
    alignItems:  'center',
    gap:         10,
    padding:     '10px 14px',
    background:  'transparent',
    border:      'none',
    borderRadius: 0,
    cursor:      'pointer',
    transition:  'background 0.15s',
    fontFamily:  'inherit',
    overflow:    'hidden',
  } as React.CSSProperties,

  rightArea: {
    flex:          1,
    minWidth:      0,
    display:       'flex',
    flexDirection: 'column' as const,
    height:        '100vh',
    overflow:      'hidden',
  },

  topbar: {
    height:       52,
    background:   T.surface,
    borderBottom: `0.5px solid ${T.border}`,
    display:      'flex',
    alignItems:   'center',
    padding:      '0 16px',
    gap:          10,
    zIndex:       80,
    flexShrink:   0,
  },

  breadcrumb: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    fontSize:   12.5,
    flex:       1,
    minWidth:   0,
    overflow:   'hidden',
  } as React.CSSProperties,

  topbarActions: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    flexShrink: 0,
  } as React.CSSProperties,

  rolBadge: {
    display:       'flex',
    alignItems:    'center',
    fontSize:      11,
    fontWeight:    600,
    padding:       '4px 10px',
    borderRadius:  20,
    letterSpacing: '0.02em',
    whiteSpace:    'nowrap' as const,
  } as React.CSSProperties,

  hamburger: {
    flexDirection: 'column' as const,
    gap:           5,
    background:    'transparent',
    border:        'none',
    cursor:        'pointer',
    padding:       6,
    borderRadius:  6,
    flexShrink:    0,
  },

  hamburgerLine: {
    display:      'block' as const,
    width:        20,
    height:       2,
    borderRadius: 2,
    background:   T.textMuted,
  },

  main: {
    flex:       1,
    background: T.bg,
    minWidth:   0,
    width:      '100%',
    boxSizing:  'border-box' as const,
    overflowY:  'auto' as const,
    overflowX:  'hidden' as const,
  },

  footerGlobal: {
    borderTop:      `0.5px solid ${T.border}`,
    background:     T.surface,
    padding:        '12px 20px',
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    flexWrap:       'wrap' as const,
    gap:            8,
    flexShrink:     0,
  },

  footerLink: {
    fontSize:       12,
    color:          T.textFaint,
    textDecoration: 'none',
  } as React.CSSProperties,

  fadeText: (visible: boolean): React.CSSProperties => ({
    opacity:    visible ? 1 : 0,
    width:      visible ? undefined : 0,
    overflow:   'hidden',
    transition: 'opacity 0.18s, width 0.28s cubic-bezier(0.4,0,0.2,1)',
    flexShrink: 0,
  }),
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔷 ICONOS SVG
// ─────────────────────────────────────────────────────────────────────────────
function IconDashboard() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function IconScale() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 6l9-3 9 3M6 12l-3 6h6l-3-6zm12 0l-3 6h6l-3-6z" />
    </svg>
  )
}
function IconFolder() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L11 7h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  )
}
function IconGavel() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 13-8.5 8.5a2.121 2.121 0 1 1-3-3L11 10" />
      <path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="16" height="16" rx="2" /><path d="m9 12 2 2 4-4" />
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function IconUsers() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" /><path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      <circle cx="17" cy="7" r="3" /><path d="M15 20c0-3 1.5-5.5 5-6" />
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}