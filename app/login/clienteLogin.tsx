'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  validarCredsLocal,
  guardarCredsLocal,
  leerSesionLocal,
  guardarSesionLocal,
} from '@/lib/authLocal'

export default function FormularioLogin({
  error,
  registrado,
}: {
  error?: string
  registrado?: string
}) {
  const router = useRouter()
  const [errorLocal, setErrorLocal] = useState<string | null>(null)
  const [cargando, setCargando]     = useState(true) // empieza en true mientras revisa cache

  // ─────────────────────────────────────────────────────────────────────────
  // Al montar: verificar si ya hay sesión guardada → entrar directo
  // Esto es el patrón "stay logged in" — igual que Claude, Mercado Libre, etc.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const sesion = leerSesionLocal()
    if (sesion && sesion.expires_at > Date.now()) {
      // Sesión válida → saltar el login directo al dashboard
      router.replace('/sistema/dashboard')
      return
    }
    // No hay sesión válida → mostrar formulario
    setCargando(false)
  }, [router])

  async function handleSubmit(formData: FormData) {
    setCargando(true)
    setErrorLocal(null)

    const email    = formData.get('email')    as string
    const password = formData.get('password') as string

    // ─── MODO OFFLINE ─────────────────────────────────────────────────────
    if (!navigator.onLine) {
      const valido = await validarCredsLocal(email, password)

      if (valido) {
        const raw    = localStorage.getItem('juridico-creds')
        const parsed = JSON.parse(raw!)
        const perfil = parsed.perfil ?? {}

        const sesionExistente = leerSesionLocal()
        const sesion = sesionExistente ?? {
          id:         perfil.id        ?? 'offline',
          email:      parsed.email,
          nombre:     perfil.nombre    ?? parsed.email,
          rol:        perfil.rol       ?? 'asistente',
          iniciales:  perfil.iniciales ?? parsed.email.slice(0, 2).toUpperCase(),
          activo:     true,
          expires_at: 0,
        }

        // 1 año de sesión
        guardarSesionLocal({ ...sesion, expires_at: Date.now() + 1000 * 60 * 60 * 24 * 365 })
        router.replace('/sistema/dashboard')
      } else {
        setErrorLocal('Sin conexión. Debes iniciar sesión al menos una vez con internet para usar el acceso offline.')
        setCargando(false)
      }
      return
    }

    // ─── MODO ONLINE ──────────────────────────────────────────────────────
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password })

      if (loginError || !data.user) {
        setErrorLocal(loginError?.message || 'Credenciales incorrectas.')
        setCargando(false)
        return
      }

      const user      = data.user
      const nombre    = user.user_metadata?.nombre_completo ?? email
      const iniciales = nombre.split(' ').map((p: string) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
      const rol       = (user.user_metadata?.rol ?? 'asistente').toLowerCase()

      // Guardar creds para uso offline futuro
      await guardarCredsLocal(email, password, { id: user.id, nombre, rol, iniciales })

      // Guardar sesión con 1 año de vigencia — no vuelve a pedir login
      guardarSesionLocal({
        id:         user.id,
        email:      user.email ?? '',
        nombre,
        rol,
        iniciales,
        activo:     true,
        expires_at: Date.now() + 1000 * 60 * 60 * 24 * 365,
      })

      router.replace('/sistema/dashboard')
    } catch {
      setErrorLocal('Error de red. Inténtalo de nuevo.')
      setCargando(false)
    }
  }

  // Mientras verifica el cache → spinner sin formulario
  if (cargando) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
        <div style={{
          width: 22, height: 22,
          border: '2px solid #3a5fb8',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const errorMostrar = errorLocal ?? error

  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      await handleSubmit(formData)
    }}>
      {registrado && (
        <div style={alertaExito}>✓ Cuenta creada. Ya puedes iniciar sesión.</div>
      )}
      {errorMostrar && (
        <div style={alertaError}>{errorMostrar}</div>
      )}

      <div style={campo}>
        <label style={estiloLabel}>Correo electrónico</label>
        <input name="email" type="email" required placeholder="correo@ejemplo.com" style={estiloInput} />
      </div>

      <div style={campo}>
        <label style={estiloLabel}>Contraseña</label>
        <input name="password" type="password" required placeholder="••••••••" style={estiloInput} />
      </div>

      <button type="submit" disabled={cargando} style={btnPrimario}>
        Iniciar sesión
      </button>
    </form>
  )
}

const T = {
  surfaceHigh: '#162236',
  border:      'rgba(255,255,255,0.08)',
  textMuted:   'rgba(255,255,255,0.42)',
  green:       '#4ade80',
  greenAlpha:  'rgba(74,222,128,0.08)',
  red:         '#f87171',
  redAlpha:    'rgba(248,113,113,0.08)',
  accent:      '#3a5fb8',
}

const campo:       React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }
const estiloLabel: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: T.textMuted }
const estiloInput: React.CSSProperties = { width: '100%', padding: '11px 12px', background: T.surfaceHigh, border: `0.5px solid ${T.border}`, borderRadius: 9, color: 'rgba(255,255,255,0.90)', fontSize: 13.5, boxSizing: 'border-box', outline: 'none' }
const btnPrimario: React.CSSProperties = { width: '100%', marginTop: 4, padding: '13px 20px', background: T.accent, color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const alertaExito: React.CSSProperties = { color: T.green, background: T.greenAlpha, border: '0.5px solid rgba(74,222,128,0.20)', padding: '10px 13px', borderRadius: 8, fontSize: 13, marginBottom: 16 }
const alertaError: React.CSSProperties = { color: T.red, background: T.redAlpha, border: '0.5px solid rgba(248,113,113,0.20)', padding: '10px 13px', borderRadius: 8, fontSize: 13, marginBottom: 16 }