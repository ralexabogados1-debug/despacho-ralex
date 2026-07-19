/**
 * lib/checkConnection.ts
 *
 * navigator.onLine SOLO indica si el dispositivo tiene una interfaz de red
 * "activa" (WiFi conectado a un router, o radio de datos encendido).
 * NO indica si hay internet real.
 *
 * Por eso, con datos móviles activados pero sin MB/saldo, navigator.onLine
 * sigue devolviendo `true` y la app intenta pegarle a Supabase, se queda
 * colgada o tarda en fallar sin que los guards existentes lo detecten.
 *
 * hayConexionReal() resuelve esto haciendo un HEAD request corto y con
 * timeout contra el propio backend de Supabase antes de decidir si se
 * intenta la llamada real.
 */

let ultimaVerificacion: { resultado: boolean; timestamp: number } | null = null
const CACHE_MS = 8000 // evita pings duplicados si varios componentes montan casi al mismo tiempo

export async function hayConexionReal(timeoutMs = 2500): Promise<boolean> {
  // Filtro rápido: si el dispositivo ni siquiera reporta interfaz activa,
  // no hace falta ni intentar el ping.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    ultimaVerificacion = { resultado: false, timestamp: Date.now() }
    return false
  }

  // Cache corto para no disparar múltiples pings simultáneos
  // (ej. layout.tsx + NotificacionesEventos + page.tsx montando juntos)
  if (
    ultimaVerificacion &&
    Date.now() - ultimaVerificacion.timestamp < CACHE_MS
  ) {
    return ultimaVerificacion.resultado
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeout)
    ultimaVerificacion = { resultado: true, timestamp: Date.now() }
    return true
  } catch {
    ultimaVerificacion = { resultado: false, timestamp: Date.now() }
    return false
  }
}