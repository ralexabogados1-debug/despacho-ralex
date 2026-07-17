'use client'

import { useArranque } from '@/hooks/useArranque'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useTema } from '@/app/sistema/layout'
import { leerSesionLocal } from '@/lib/authLocal'
import { query } from '@/lib/dbHelpers'
import { syncConSupabase } from '@/lib/sync'
import BannerOffline from '@/components/BannerOffline'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS OSCUROS
// ─────────────────────────────────────────────────────────────────────────────
const T_DARK = {
  surface: '#0b1220',
  border: 'rgba(255,255,255,0.06)',
  accent: '#3a5fb8',
  accentAlpha: 'rgba(58,95,184,0.12)',
  gold: '#d4af37',
  goldAlpha: 'rgba(212,175,55,0.10)',
  green: '#4ade80',
  greenAlpha: 'rgba(74,222,128,0.08)',
  red: '#b3434f',
  redAlpha: 'rgba(179,67,79,0.10)',
  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted: 'rgba(255,255,255,0.40)',
  textFaint: 'rgba(255,255,255,0.22)',
  textAccent: '#8fa8e0',
  bg: '#070b14',
  cabeceraBg: '#080b14',
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS CLAROS
// ─────────────────────────────────────────────────────────────────────────────
const T_LIGHT = {
  surface: '#ffffff',
  border: 'rgba(0,0,0,0.08)',
  accent: '#2b5fb0',
  accentAlpha: 'rgba(43,95,176,0.08)',
  gold: '#b8860b',
  goldAlpha: 'rgba(184,134,11,0.08)',
  green: '#16a34a',
  greenAlpha: 'rgba(22,163,74,0.06)',
  red: '#dc2626',
  redAlpha: 'rgba(220,38,38,0.06)',
  textPrimary: 'rgba(0,0,0,0.85)',
  textMuted: 'rgba(0,0,0,0.50)',
  textFaint: 'rgba(0,0,0,0.30)',
  textAccent: '#1e3a8a',
  bg: '#f5f7fa',
  cabeceraBg: '#f9fafb',
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 Helper: getUser con timeout — nunca lanza error (igual que el layout)
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
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 📦 QUERIES LOCALES (CON LOGS DE DIAGNÓSTICO TEMPORALES)
// ─────────────────────────────────────────────────────────────────────────────
async function cargarDatosLocales() {
  // 🔍 DIAGNÓSTICO 1: ¿Cuántas filas hay en total en la tabla local `expedientes`?
  const todos = await query<any>(`SELECT id, numero_expediente, cliente_id, materia_id FROM expedientes`)
  console.log('🔵 [DIAGNÓSTICO] Todos los expedientes en SQLite LOCAL:', todos)

  // 🔍 DIAGNÓSTICO 2: ¿Existe el expediente id=7 específicamente en local?
  const exp7 = await query<any>(`SELECT * FROM expedientes WHERE id = 7`)
  console.log('🔵 [DIAGNÓSTICO] Expediente id=7 en SQLite LOCAL:', exp7)

  // 🔍 DIAGNÓSTICO 3: ¿Qué hay en expedientes_civiles local?
  const civilesLocal = await query<any>(`SELECT * FROM expedientes_civiles`)
  console.log('🔵 [DIAGNÓSTICO] Filas en expedientes_civiles LOCAL:', civilesLocal)

  // ✅ Conteo de Civil/Familiar usando expedientes_civiles (funciona para ambos)
  const [{ total: cCF }] = await query<{ total: number }>(`
    SELECT COUNT(*) as total
    FROM expedientes e
    INNER JOIN expedientes_civiles ec ON ec.expediente_id = e.id
    WHERE e.cliente_id IS NOT NULL
  `)

  // --- conteo Penal ---
  const [{ total: cP }] = await query<{ total: number }>(`
    SELECT COUNT(*) as total FROM expedientes_penales
  `)

  // --- conteo Amparo ---
  const [{ total: cA }] = await query<{ total: number }>(`
    SELECT COUNT(*) as total FROM expedientes_amparo
  `)

  // --- últimos 5 expedientes (sin cambios) ---
  const rows = await query<any>(`
    SELECT
      e.id,
      e.numero_expediente,
      e.created_at,
      e.contraparte,
      c.nombre_completo AS cliente_nombre,
      CASE
        WHEN ep.expediente_id IS NOT NULL THEN 'Penal'
        WHEN ea.expediente_id IS NOT NULL THEN 'Amparo'
        ELSE 'Civil'
      END AS materia_nombre
    FROM expedientes e
    LEFT JOIN clientes            c  ON c.id             = e.cliente_id
    LEFT JOIN expedientes_penales ep ON ep.expediente_id = e.id
    LEFT JOIN expedientes_amparo  ea ON ea.expediente_id = e.id
    WHERE e.cliente_id IS NOT NULL
    ORDER BY e.created_at DESC
    LIMIT 5
  `)

  const recientes = rows.map((r: any) => ({
    id:                r.id,
    numero_expediente: r.numero_expediente,
    created_at:        r.created_at,
    contraparte:       r.contraparte,
    clientes:          { nombre_completo: r.cliente_nombre ?? null },
    materias:          { nombre: r.materia_nombre ?? null },
  }))

  console.log('🔵 [DIAGNÓSTICO] Conteos finales:', { cCF, cP, cA })

  return {
    cCF:  Number(cCF ?? 0),
    cP:   Number(cP ?? 0),
    cA:   Number(cA ?? 0),
    recientes,
  }
}

export default function DashboardPage() {
  const arranqueListo = useArranque()
  const { oscuro } = useTema()
  const T = oscuro ? T_DARK : T_LIGHT
  const styles = useMemo(() => getStyles(T), [T])

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [perfil, setPerfil]                         = useState<any>(null)
  const [countCivilFamiliar, setCountCivilFamiliar] = useState(0)
  const [countPenal, setCountPenal]                 = useState(0)
  const [countAmparo, setCountAmparo]               = useState(0)
  const [recientes, setRecientes]                   = useState<any[]>([])
  const [loading, setLoading]                       = useState(true)
  const [esOffline, setEsOffline]                   = useState(false)

  useEffect(() => {
  if (!arranqueListo) return  // ← useArranque ya esperó 500ms
  const cargar = async () => {
    const sesionLocal = leerSesionLocal()
    const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()

    const usarDatosLocales = async (perfilBase: any) => {
      setPerfil(perfilBase)
      try {
        const local = await cargarDatosLocales()
        setCountCivilFamiliar(local.cCF)
        setCountPenal(local.cP)
        setCountAmparo(local.cA)
        setRecientes(local.recientes)
      } catch (sqlErr) {
        console.error('🔴 SQLite error:', sqlErr)
      }
      setEsOffline(true)
      setLoading(false)
    }

    const user = navigator.onLine
      ? await getUserConTimeout(supabase)
      : null

    if (!user) {
      if (!cacheValido) {
        router.push('/login')
        return
      }
      await usarDatosLocales({
        nombre_completo: sesionLocal!.nombre,
        rol:             sesionLocal!.rol,
        email:           sesionLocal!.email,
      })
      return
    }

    if (navigator.onLine) {
      try {
        await syncConSupabase()
      } catch (syncErr) {
        console.warn('🟡 Fallo intermedio en motor de sync:', syncErr)
      }
    }

    try {
      const { data: perfilData } = await supabase
        .from('usuarios')
        .select('nombre_completo, rol, email')
        .eq('auth_id', user.id)
        .single()

      setPerfil(perfilData)

      const local = await cargarDatosLocales()
      setCountCivilFamiliar(local.cCF)
      setCountPenal(local.cP)
      setCountAmparo(local.cA)
      setRecientes(local.recientes)
      setEsOffline(!navigator.onLine)
      setLoading(false)

    } catch (e) {
      console.error('🔴 Dashboard error:', e)
      if (cacheValido) {
        await usarDatosLocales({
          nombre_completo: sesionLocal!.nombre,
          rol:             sesionLocal!.rol,
          email:           sesionLocal!.email,
        })
      } else {
        router.push('/login')
      }
    }
  }

  cargar()
}, [supabase, router, arranqueListo])

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const totalExpedientes = countCivilFamiliar + countPenal + countAmparo
  const hoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const nombreCorto = perfil?.nombre_completo?.split(' ')[0] ?? 'Usuario'

  return (
    <div style={styles.content}>
      <style>{`
        @media (max-width: 640px) {
          .dash-col-ocultar { display: none !important; }
          .dash-tabla-fila { grid-template-columns: 1fr 90px !important; }
        }
        @media (min-width: 641px) and (max-width: 860px) {
          .dash-col-fecha { display: none !important; }
          .dash-tabla-fila { grid-template-columns: 1.4fr 1fr 1fr 90px !important; }
        }
      `}</style>

      <BannerOffline esOffline={esOffline} />

      <div>
        <h1 style={styles.heading}>
          Bienvenido, <span style={{ color: T.textAccent }}>{nombreCorto}</span>
        </h1>
        <p style={styles.subheading}>
          <span style={styles.calDot} />
          {hoy.charAt(0).toUpperCase() + hoy.slice(1)}
        </p>
      </div>

      <div style={styles.resumenBanner}>
        <span style={{ color: T.textMuted, fontSize: 13 }}>
          Total de expedientes en sistema:&nbsp;
          <strong style={{ color: T.textPrimary }}>{totalExpedientes}</strong>
        </span>
        <span style={styles.dividerV} />
        <span style={{ color: T.textMuted, fontSize: 13 }}>
          Activo como&nbsp;<strong style={{ color: T.textAccent, textTransform: 'capitalize' }}>{perfil?.rol ?? '—'}</strong>
        </span>
      </div>

      <div style={styles.statsGrid}>
        <StatCard label="Civil / Familiar"  value={countCivilFamiliar} icon={<IconScale />}  color={T.accent} colorAlpha={T.accentAlpha} href="/sistema/expedientes/civil"   T={T} styles={styles} />
        <StatCard label="Causas Penales"    value={countPenal}         icon={<IconGavel />}  color={T.red}    colorAlpha={T.redAlpha}    href="/sistema/expedientes/penal"   T={T} styles={styles} />
        <StatCard label="Amparos"           value={countAmparo}        icon={<IconShield />} color={T.gold}   colorAlpha={T.goldAlpha}   href="/sistema/expedientes/amparo"  T={T} styles={styles} />
        <StatCard label="Total expedientes" value={totalExpedientes}   icon={<IconFolder />} color={T.green}  colorAlpha={T.greenAlpha}  T={T} styles={styles} />
      </div>

      {recientes.length > 0 && (
        <section>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Expedientes recientes</h2>
            <a href="/sistema/expedientes/civil" style={styles.verTodos}>Ver todos →</a>
          </div>

          <div style={styles.tabla}>
            <div className="dash-tabla-fila" style={{ ...styles.tablaFila, ...styles.tablaCabecera }}>
              <span>Expediente</span>
              <span className="dash-col-ocultar">Cliente</span>
              <span className="dash-col-ocultar">Contraparte</span>
              <span>Materia</span>
              <span className="dash-col-ocultar dash-col-fecha">Fecha</span>
            </div>

            {recientes.map((exp: any) => {
              const href = '/sistema/expedientes/' + (exp.materias?.nombre?.toLowerCase() ?? 'civil') + '/' + exp.id
              return (
                <a
                  key={exp.id}
                  href={href}
                  className="dash-tabla-fila"
                  style={{ ...styles.tablaFila, ...styles.tablaFilaLink }}
                >
                  <span style={{ color: T.textPrimary, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exp.numero_expediente}
                  </span>
                  <span className="dash-col-ocultar" style={{ fontSize: 13, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exp.clientes?.nombre_completo ?? '—'}
                  </span>
                  <span className="dash-col-ocultar" style={{ fontSize: 13, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exp.contraparte ?? '—'}
                  </span>
                  <span>
                    <MateriaChip nombre={exp.materias?.nombre ?? '—'} T={T} />
                  </span>
                  <span className="dash-col-ocultar dash-col-fecha" style={{ fontSize: 12, color: T.textFaint, whiteSpace: 'nowrap' }}>
                    {new Date(exp.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </a>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧩 COMPONENTES INTERNOS
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, colorAlpha, href, T, styles }: any) {
  const inner = (
    <div style={{ ...styles.statCard, borderColor: `${color}33` }}>
      <div style={{ ...styles.statIcon, background: colorAlpha, color }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: T.textPrimary, letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
      </div>
      {href && <div style={{ marginLeft: 'auto', color: T.textFaint, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>→</div>}
    </div>
  )
  return href ? <a href={href} style={{ textDecoration: 'none' }}>{inner}</a> : inner
}

function MateriaChip({ nombre, T }: any) {
  const map: Record<string, { bg: string; color: string }> = {
    Civil:    { bg: T.accentAlpha, color: T.textAccent },
    Familiar: { bg: T.accentAlpha, color: T.textAccent },
    Penal:    { bg: T.redAlpha,    color: T.red },
    Amparo:   { bg: T.goldAlpha,   color: T.gold },
  }
  const style = map[nombre] ?? { bg: T.border, color: T.textMuted }
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: style.bg, color: style.color, whiteSpace: 'nowrap' }}>{nombre}</span>
}

// ─── ESTILOS DINÁMICOS ─────────────────────────────────────────────────────
function getStyles(T: any) {
  return {
    content:       { padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 40px)', display: 'flex', flexDirection: 'column' as const, gap: 28, width: '100%', boxSizing: 'border-box' as const },
    heading:       { fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 700, margin: 0, letterSpacing: '-0.5px', color: T.textPrimary } as React.CSSProperties,
    subheading:    { fontSize: 12, color: T.textFaint, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'capitalize' as const },
    calDot:        { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: T.accent },
    resumenBanner: { display: 'flex', alignItems: 'center', gap: 14, background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: '10px 18px', flexWrap: 'wrap' as const } as React.CSSProperties,
    dividerV:      { display: 'inline-block', width: 1, height: 14, background: T.border },
    statsGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 } as React.CSSProperties,
    statCard:      { background: T.surface, borderWidth: '0.5px', borderStyle: 'solid', borderColor: T.border, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer', minWidth: 0 } as React.CSSProperties,
    statIcon:      { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } as React.CSSProperties,
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' as const } as React.CSSProperties,
    sectionTitle:  { fontSize: 14, fontWeight: 600, color: T.textMuted, margin: 0, letterSpacing: '-0.1px' } as React.CSSProperties,
    verTodos:      { fontSize: 12, color: T.textAccent, textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' as const } as React.CSSProperties,
    tabla:         { background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
    tablaFila:     { display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 100px 110px', padding: '11px 18px', borderBottom: `0.5px solid ${T.border}`, alignItems: 'center', gap: 12 } as React.CSSProperties,
    tablaCabecera: { fontSize: 11, fontWeight: 500, color: T.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: T.cabeceraBg },
    tablaFilaLink: { textDecoration: 'none', color: 'inherit', transition: 'background 0.12s' } as React.CSSProperties,
  }
}

function IconScale()  { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 6l9-3 9 3M6 12l-3 6h6l-3-6zm12 0l-3 6h6l-3-6z"/></svg>) }
function IconGavel()  { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 13-8.5 8.5a2.121 2.121 0 1 1-3-3L11 10"/><path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/></svg>) }
function IconShield() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>) }
function IconFolder() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L11 7h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>) }