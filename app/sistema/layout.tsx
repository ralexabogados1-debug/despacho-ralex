'use client'

import React, { useState, useEffect, createContext, useContext } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { guardarSesionLocal, leerSesionLocal, renovarSesion, borrarSesionLocal } from '@/lib/authLocal'
import { syncConSupabase } from '@/lib/sync'
import NotificacionesEventos from './NotificacionesEventos' // ── 🔔 Importación del componente de alertas

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS OSCUROS
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS CLAROS
// ─────────────────────────────────────────────────────────────────────────────
const T_LIGHT = {
  bg:          '#f5f7fa',
  surface:     '#ffffff',
  border:      'rgba(0,0,0,0.08)',
  accent:      '#3a5fb8',
  accentAlpha: 'rgba(58,95,184,0.08)',
  gold:        '#b8860b',
  goldAlpha:   'rgba(184,134,11,0.10)',
  green:       '#16a34a',
  greenAlpha:  'rgba(22,163,74,0.08)',
  red:         '#dc2626',
  redAlpha:    'rgba(220,38,38,0.08)',
  textPrimary: 'rgba(0,0,0,0.85)',
  textMuted:   'rgba(0,0,0,0.45)',
  textFaint:   'rgba(0,0,0,0.25)',
  textAccent:  '#1e3a8a',
}

// ─────────────────────────────────────────────────────────────────────────────
// 📌 Contexto de tema
// ─────────────────────────────────────────────────────────────────────────────
const TemaCtx = createContext<{
  oscuro: boolean
  toggleTema: () => void
}>({ oscuro: true, toggleTema: () => {} })

export const useTema = () => useContext(TemaCtx)

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

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 Helper: obtener usuario de Supabase con timeout — nunca lanza error
// ─────────────────────────────────────────────────────────────────────────────
async function getUserConTimeout(supabase: ReturnType<typeof createBrowserClient>, ms = 4000) {
  try {
    const resultado = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ])
    if (!resultado || !('data' in resultado)) return null
    return resultado.data.user ?? null
  } catch {
    // Sin internet → Failed to fetch — devolvemos null en lugar de explotar
    return null
  }
}

export default function SistemaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [sesion, setSesion]                 = useState<Sesion>({ nombre: '', iniciales: '', rol: 'asistente' })
  const [cargando, setCargando]             = useState(true)
  const [expandido, setExpandido]           = useState(true)
  const [hovered, setHovered]               = useState<string | null>(null)
  const [menuMobile, setMenuMobile]         = useState(false)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)
  const [isMobile, setIsMobile]             = useState(false)
  const [oscuro, setOscuro]                 = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('tema')
    if (stored === 'claro') {
      setOscuro(false)
    } else if (stored === 'oscuro') {
      setOscuro(true)
    } else {
      const mql = window.matchMedia('(prefers-color-scheme: light)')
      setOscuro(!mql.matches)
      const listener = (e: MediaQueryListEvent) => setOscuro(!e.matches)
      mql.addEventListener('change', listener)
      return () => mql.removeEventListener('change', listener)
    }
  }, [])

  const toggleTema = () => {
    setOscuro(prev => {
      const nuevo = !prev
      localStorage.setItem('tema', nuevo ? 'oscuro' : 'claro')
      return nuevo
    })
  }

  const colores = oscuro ? T : T_LIGHT

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 769)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // 🔐 Limpieza centralizada de sesión — usada tanto por logout manual
  // como por causas externas (token revocado/expirado detectado por Supabase).
  // Borra SOLO la sesión (juridico-session), nunca las credenciales locales
  // (juridico-creds), para que el login offline siga funcionando después.
  // ─────────────────────────────────────────────────────────────────────────
  const manejarLogout = (destino: string = '/login') => {
    borrarSesionLocal()
    window.location.href = destino
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 👂 Listener global: si Supabase reporta SIGNED_OUT por una causa externa
  // (token revocado, sesión expirada del lado del servidor, cierre de sesión
  // desde otro dispositivo, etc.), limpiamos la sesión local automáticamente.
  // Esto es lo que cubre "por alguna causa externa que suele pasar en
  // aplicaciones normales".
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
  const { data: listener } = supabase.auth.onAuthStateChange((event) => {
    console.log('🔐 Auth event:', event)
    if (event === 'SIGNED_OUT') {
      const sesionLocal = leerSesionLocal()
      const hayCache = sesionLocal && sesionLocal.expires_at > Date.now()
      console.log('🔐 SIGNED_OUT detectado — sesionLocal:', sesionLocal, '| hayCache:', hayCache)
      if (!hayCache) {
        manejarLogout('/login')
      }
    }
  })
  return () => listener.subscription.unsubscribe()
}, [supabase])

  useEffect(() => {
    const cargarUsuario = async () => {
  const sesionLocal = leerSesionLocal()
  console.log('🔄 cargarUsuario — sesionLocal:', sesionLocal)
  const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()
  console.log('🔄 cacheValido:', cacheValido)
  // ... resto del código

      if (cacheValido) {
        // Sesión local válida → mostrar UI inmediatamente
        setSesion({
          nombre:    sesionLocal!.nombre,
          iniciales: sesionLocal!.iniciales,
          rol:       sesionLocal!.rol as Rol,
        })
        setCargando(false)

        // ── PASO 2 (background): Verificar y refrescar con Supabase ──────────
        // Si hay internet, actualizamos el token y renovamos sesión silenciosamente.
        // El usuario nunca lo ve — ya está dentro del sistema.
        const refrescarEnBackground = async () => {
          const user = await getUserConTimeout(supabase)
          if (user) {
            const nombre    = user.user_metadata?.nombre_completo ?? user.email ?? sesionLocal!.nombre
            const iniciales = nombre.split(' ').map((p: string) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
            const rol       = (user.user_metadata?.rol ?? sesionLocal!.rol).toLowerCase() as Rol
            // Actualizar UI si hay cambios en el perfil
            setSesion({ nombre, iniciales, rol })
            // Renovar sesión por otro año
            guardarSesionLocal({
              id:         user.id,
              email:      user.email ?? sesionLocal!.email,
              nombre,
              rol,
              iniciales,
              activo:     true,
              expires_at: Date.now() + 1000 * 60 * 60 * 24 * 365,
            })
            // Sync SQLite en background
            syncConSupabase().catch((err) => console.error('Sync error:', err))
          }
          // Si no hay internet → no hacemos nada, el cache ya cargó la UI
          // Nota: si hay internet pero Supabase confirma que el usuario ya
          // no es válido (token revocado, etc.), el listener SIGNED_OUT de
          // arriba se encarga de limpiar la sesión local automáticamente.
        }
        refrescarEnBackground()
        return
      }

      // ── PASO 3: Sin cache → intentar Supabase (primera vez o tras logout) ──
      const user = await getUserConTimeout(supabase)
      if (user) {
        const nombre    = user.user_metadata?.nombre_completo ?? user.email ?? 'Usuario'
        const iniciales = nombre.split(' ').map((p: string) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
        const rol       = (user.user_metadata?.rol ?? 'asistente').toLowerCase() as Rol
        setSesion({ nombre, iniciales, rol })
        guardarSesionLocal({
          id:         user.id,
          email:      user.email ?? '',
          nombre,
          rol,
          iniciales,
          activo:     true,
          expires_at: Date.now() + 1000 * 60 * 60 * 24 * 365,
        })
        setCargando(false)
        syncConSupabase().catch((err) => console.error('Sync error:', err))
        return
      }

      // ── PASO 4: Sin cache y sin Supabase → login ──────────────────────────
      window.location.href = '/login'
    }

    cargarUsuario()
  }, [supabase, router])

  // ─────────────────────────────────────────────────────────────────────────
  // 🚪 Logout manual — el usuario decide salir por su cuenta.
  // 1. Intenta cerrar sesión en Supabase (si hay internet).
  // 2. SIEMPRE borra la sesión local, con o sin internet — es la parte que
  //    faltaba: antes solo se cerraba sesión en Supabase, pero la sesión
  //    local (con expires_at a un año) seguía viva y el cache-first del
  //    PASO 1 te volvía a meter al sistema.
  // 3. Redirige a /login.
  // ─────────────────────────────────────────────────────────────────────────
  const handleCerrarSesion = async () => {
    setCerrandoSesion(true)
    try { await supabase.auth.signOut() } catch { /* sin internet, ignorar */ }
    manejarLogout('/login')
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
      <div style={{ display: 'flex', minHeight: '100vh', background: colores.bg, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${colores.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const styles = getStyles(colores)

  const SidebarContent = (
    <>
      <div style={styles.logoRow}>
        <img
          src="/img/Gemini_Generated_Image_wbbwjpwbbwjpwbbw.png"
          alt="Logo"
          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
        <span style={{ ...styles.fadeText(expandido || isMobile), fontSize: 13, fontWeight: 600, color: colores.textPrimary, letterSpacing: '-0.3px' }}>
          RALEX
        </span>
      </div>

      <nav style={styles.navArea}>
        {secciones.map(({ label, items }) => (
          <div key={label}>
            {label && (
              <span style={{ ...styles.sectionLabel, ...styles.fadeText(expandido || isMobile) }}>
                {label}
              </span>
            )}
            {items.map((item) => {
              const activo  = pathname === item.path || pathname?.startsWith(`${item.path}/`)
              const hover   = hovered === item.path
              const esAdmin = item.soloRoles?.length === 1 && item.soloRoles[0] === 'admin'
              return (
                
                  <a key={item.path}
                  href={item.path}
                  title={(!expandido && !isMobile) ? item.label : undefined}
                  onMouseEnter={() => setHovered(item.path)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setMenuMobile(false)}
                  style={{
                    ...styles.navItem,
                    background: activo
                      ? colores.accentAlpha
                      : hover
                      ? oscuro ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
                      : 'transparent',
                  }}
                >
                  {activo && <span style={styles.activeBar} />}
                  <span style={{ ...styles.iconWrap, color: activo ? colores.textAccent : hover ? (oscuro ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)') : colores.textMuted }}>
                    {item.icon}
                  </span>
                  <span style={{
                    ...styles.navLabel,
                    ...styles.fadeText(expandido || isMobile),
                    color:      activo ? colores.textPrimary : hover ? (oscuro ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)') : colores.textMuted,
                    fontWeight: activo ? 500 : 400,
                  }}>
                    {item.label}
                  </span>
                  {esAdmin && (expandido || isMobile) && <span style={styles.adminBadge}>ADMIN</span>}
                </a>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={styles.sidebarBottom}>
        <a href="/sistema/perfil" style={styles.sidebarFooter} title="Ver mi perfil">
          <div style={styles.avatarWrap}>
            <div style={{
              ...styles.avatar,
              ...(pathname === '/sistema/perfil'
                ? { borderColor: colores.accent, boxShadow: `0 0 0 2px ${colores.accentAlpha}` }
                : {}),
            }}>
              {sesion.iniciales}
            </div>
            {sesion.rol === 'admin' && <span style={styles.crown}>👑</span>}
          </div>
          <div style={{ ...styles.fadeText(expandido || isMobile), overflow: 'hidden', minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: colores.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sesion.nombre}
            </div>
            <div style={{ fontSize: 11, color: colores.textFaint, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
              {sesion.rol} · Ver perfil
            </div>
          </div>
        </a>

        <button
          onClick={handleCerrarSesion}
          disabled={cerrandoSesion}
          title="Cerrar sesión"
          style={{ ...styles.btnLogout, justifyContent: (expandido || isMobile) ? 'flex-start' : 'center' }}
        >
          <span style={{ ...styles.iconWrap, color: colores.red, flexShrink: 0 }}>
            <IconLogout />
          </span>
          <span style={{ ...styles.fadeText(expandido || isMobile), fontSize: 13, color: colores.red, whiteSpace: 'nowrap' }}>
            {cerrandoSesion ? 'Cerrando...' : 'Cerrar sesión'}
          </span>
        </button>
      </div>
    </>
  )

  return (
    <TemaCtx.Provider value={{ oscuro, toggleTema }}>
      <SesionCtx.Provider value={sesion}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg) } }
          * { scrollbar-width: thin; scrollbar-color: ${oscuro ? 'rgba(58,95,184,0.25)' : 'rgba(0,0,0,0.2)'} transparent; }
          *::-webkit-scrollbar { width: 5px; }
          *::-webkit-scrollbar-track { background: transparent; }
          *::-webkit-scrollbar-thumb { background: ${oscuro ? 'rgba(58,95,184,0.25)' : 'rgba(0,0,0,0.15)'}; border-radius: 3px; }
          *::-webkit-scrollbar-thumb:hover { background: ${oscuro ? 'rgba(58,95,184,0.45)' : 'rgba(0,0,0,0.3)'}; }
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
          .btn-logout-hover:hover { background: ${oscuro ? 'rgba(179,67,79,0.08)' : 'rgba(179,67,79,0.06)'} !important; }
          .nav-footer-link:hover { background: ${oscuro ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} !important; }
        `}</style>

        <div style={styles.shell}>

          {/* ── SIDEBAR DESKTOP ── */}
          <div
            className="sidebar-desktop"
            style={{ position: 'relative', flexShrink: 0, height: '100%', display: 'flex', width: expandido ? 220 : 64, transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            <aside style={{ ...styles.sidebar, width: expandido ? 220 : 64 }}>
              {SidebarContent}
            </aside>
            <button onClick={() => setExpandido(!expandido)} style={styles.toggleBtn} aria-label={expandido ? 'Colapsar' : 'Expandir'}>
              <span style={styles.toggleBtnPanel} />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', transform: expandido ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                <path d="M6 2L3 5l3 3" stroke={colores.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* ── SIDEBAR MOBILE ── */}
          {menuMobile && (
            <div className="sidebar-mobile-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
              <div onClick={() => setMenuMobile(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }} />
              <aside style={{ ...styles.sidebar, width: 260, position: 'relative', zIndex: 201, height: '100%' }}>
                {SidebarContent}
              </aside>
            </div>
          )}

          {/* ── ÁREA DERECHA ── */}
          <div style={styles.rightArea}>
            <header style={styles.topbar}>
              <button className="topbar-hamburger" onClick={() => setMenuMobile(true)} style={{ display: 'none', ...styles.hamburger }} aria-label="Abrir menú">
                <span style={styles.hamburgerLine} />
                <span style={styles.hamburgerLine} />
                <span style={styles.hamburgerLine} />
              </button>

              <div style={styles.breadcrumb}>
                <span className="topbar-breadcrumb-sistema" style={{ color: colores.textFaint }}>Sistema</span>
                <svg className="topbar-breadcrumb-sistema" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2l4 4-4 4" stroke={colores.textFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ color: colores.textMuted, fontWeight: 500, fontSize: 13 }}>{paginaActual}</span>
              </div>

              <div style={styles.topbarActions}>
                <button onClick={toggleTema} aria-label="Cambiar tema" style={{ background: 'transparent', border: `0.5px solid ${colores.border}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: colores.textMuted, flexShrink: 0 }}>
                  {oscuro ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </button>
                <div
                  className="topbar-rol-badge"
                  style={{
                    ...styles.rolBadge,
                    ...(sesion.rol === 'admin'
                      ? { background: colores.goldAlpha, border: `0.5px solid ${colores.gold}44`, color: colores.gold }
                      : { background: colores.accentAlpha, border: `0.5px solid ${colores.accent}44`, color: colores.textAccent }),
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{sesion.rol}</span>
                </div>
              </div>
            </header>

            <main style={styles.main}>{children}</main>

            <footer style={styles.footerGlobal}>
              <span style={{ color: colores.textFaint, fontSize: 12 }}>© {new Date().getFullYear()} RALEX</span>
              <div className="footer-links" style={{ display: 'flex', gap: 16 }}>
                <a href="/sistema/perfil" style={styles.footerLink}>Mi perfil</a>
                <a href="/sistema/agenda" style={styles.footerLink}>Agenda</a>
                <a href="/sistema/tareas" style={styles.footerLink}>Tareas</a>
              </div>
            </footer>
          </div>
        </div>

        {/* ── 🔔 NOTIFICACIONES GLOBALES DE VENCIMIENTO ── */}
        <NotificacionesEventos />

      </SesionCtx.Provider>
    </TemaCtx.Provider>
  )
}

const getStyles = (C: typeof T | typeof T_LIGHT) => ({
  shell:          { display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: C.bg, fontFamily: '"Inter", system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  sidebar:        { background: C.surface, borderRight: `0.5px solid ${C.border}`, display: 'flex', flexDirection: 'column' as const, padding: '20px 0', height: '100%', boxSizing: 'border-box' as const, zIndex: 90, transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden', flexShrink: 0 },
  toggleBtn:      { position: 'absolute' as const, top: 18, right: -22, width: 22, height: 32, borderRadius: '0 8px 8px 0', background: C.surface, border: `1px solid ${C.accent}66`, borderLeft: 'none', boxShadow: '3px 0 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 100, padding: 0, gap: 2 },
  toggleBtnPanel: { display: 'block' as const, width: 3, height: 18, borderRadius: 2, background: `${C.accent}88`, flexShrink: 0 } as React.CSSProperties,
  logoRow:        { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px 18px', borderBottom: `0.5px solid ${C.border}`, marginBottom: 10, flexShrink: 0 } as React.CSSProperties,
  navArea:        { flex: 1, display: 'flex', flexDirection: 'column' as const, padding: '0 10px', overflowY: 'auto' as const },
  sectionLabel:   { fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: C.textFaint, textTransform: 'uppercase' as const, padding: '12px 8px 4px', display: 'block', whiteSpace: 'nowrap' as const },
  navItem:        { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 8, cursor: 'pointer', textDecoration: 'none', position: 'relative' as const, marginBottom: 1, transition: 'background 0.15s', overflow: 'hidden' } as React.CSSProperties,
  activeBar:      { position: 'absolute' as const, left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: C.accent, borderRadius: '0 3px 3px 0' },
  iconWrap:       { width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color 0.15s' } as React.CSSProperties,
  navLabel:       { fontSize: 13, whiteSpace: 'nowrap' as const, transition: 'color 0.15s, opacity 0.18s', letterSpacing: '-0.1px' } as React.CSSProperties,
  adminBadge:     { marginLeft: 'auto', fontSize: 9, fontWeight: 600, color: `${C.gold}cc`, background: C.goldAlpha, border: `0.5px solid ${C.gold}44`, borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em', flexShrink: 0 } as React.CSSProperties,
  sidebarBottom:  { marginTop: 'auto', borderTop: `0.5px solid ${C.border}`, flexShrink: 0 } as React.CSSProperties,
  sidebarFooter:  { padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', overflow: 'hidden', borderBottom: `0.5px solid ${C.border}` } as React.CSSProperties,
  avatarWrap:     { position: 'relative' as const, flexShrink: 0 },
  avatar:         { width: 32, height: 32, borderRadius: '50%', background: C.accentAlpha, border: `1.5px solid ${C.accent}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: C.textAccent, transition: 'border-color 0.15s, box-shadow 0.15s' } as React.CSSProperties,
  crown:          { position: 'absolute' as const, top: -7, right: -5, fontSize: 10 },
  btnLogout:      { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', borderRadius: 0, cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'inherit', overflow: 'hidden' } as React.CSSProperties,
  rightArea:      { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, height: '100vh', overflow: 'hidden' },
  topbar:         { height: 52, background: C.surface, borderBottom: `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, zIndex: 80, flexShrink: 0 },
  breadcrumb:     { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, flex: 1, minWidth: 0, overflow: 'hidden' } as React.CSSProperties,
  topbarActions:  { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 } as React.CSSProperties,
  rolBadge:       { display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, letterSpacing: '0.02em', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  hamburger:      { flexDirection: 'column' as const, gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, flexShrink: 0 },
  hamburgerLine:  { display: 'block' as const, width: 20, height: 2, borderRadius: 2, background: C.textMuted },
  main:           { flex: 1, background: C.bg, minWidth: 0, width: '100%', boxSizing: 'border-box' as const, overflowY: 'auto' as const, overflowX: 'hidden' as const },
  footerGlobal:   { borderTop: `0.5px solid ${C.border}`, background: C.surface, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8, flexShrink: 0 },
  footerLink:     { fontSize: 12, color: C.textFaint, textDecoration: 'none' } as React.CSSProperties,
  fadeText:       (visible: boolean): React.CSSProperties => ({ opacity: visible ? 1 : 0, width: visible ? undefined : 0, overflow: 'hidden', transition: 'opacity 0.18s, width 0.28s cubic-bezier(0.4,0,0.2,1)', flexShrink: 0 }),
})

function IconDashboard() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
}
function IconScale() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 6l9-3 9 3M6 12l-3 6h6l-3-6zm12 0l-3 6h6l-3-6z" /></svg>
}
function IconFolder() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L11 7h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>
}
function IconGavel() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 13-8.5 8.5a2.121 2.121 0 1 1-3-3L11 10" /><path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8" /></svg>
}
function IconCheck() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="16" height="16" rx="2" /><path d="m9 12 2 2 4-4" /></svg>
}
function IconCalendar() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
}
function IconUsers() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3" /><path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" /><circle cx="17" cy="7" r="3" /><path d="M15 20c0-3 1.5-5.5 5-6" /></svg>
}
function IconLogout() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
}