import { resetDb } from '@/lib/localDb'

const SESSION_KEY = 'juridico-session'
const CREDS_KEY   = 'juridico-creds'
const USER_KEY    = 'juridico-current-user'

export interface SesionLocal {
  id:         string
  email:      string
  nombre:     string
  rol:        string
  iniciales:  string
  activo:     boolean
  expires_at: number
}

interface Perfil {
  id:        string
  nombre:    string
  rol:       string
  iniciales: string
}

const UN_ANO_MS = 1000 * 60 * 60 * 24 * 365

export function guardarSesionLocal(sesion: SesionLocal) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sesion))
  localStorage.setItem(USER_KEY, sesion.id)
}

export async function guardarCredsLocal(
  email:    string,
  password: string,
  perfil?:  Perfil
) {
  const { hash } = await import('bcryptjs')
  const hashed = await hash(password, 10)
  localStorage.setItem(CREDS_KEY, JSON.stringify({ email, hash: hashed, perfil }))
}

export function leerSesionLocal(): SesionLocal | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SesionLocal
  } catch {
    return null
  }
}

export async function validarCredsLocal(email: string, password: string): Promise<boolean> {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    if (!raw) return false
    const { email: savedEmail, hash: savedHash } = JSON.parse(raw)
    if (savedEmail !== email) return false
    const { compare } = await import('bcryptjs')
    return await compare(password, savedHash)
  } catch {
    return false
  }
}

export function renovarSesion() {
  const sesion = leerSesionLocal()
  if (!sesion) return
  guardarSesionLocal({ ...sesion, expires_at: Date.now() + UN_ANO_MS })
}

export function borrarSesionLocal() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(USER_KEY)
  resetDb()
}