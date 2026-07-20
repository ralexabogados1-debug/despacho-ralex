let ultimaVerificacion: { resultado: boolean; timestamp: number } | null = null
const CACHE_MS = 8000

async function intentarPing(timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    await fetch('/api/ping', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeout)
    return true
  } catch {
    return false
  }
}

export async function hayConexionReal(timeoutMs = 2500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    ultimaVerificacion = { resultado: false, timestamp: Date.now() }
    return false
  }

  if (
    ultimaVerificacion &&
    Date.now() - ultimaVerificacion.timestamp < CACHE_MS
  ) {
    return ultimaVerificacion.resultado
  }

  const resultado = await Promise.race([
    intentarPing(timeoutMs),
    new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), timeoutMs + 300)
    ),
  ])

  ultimaVerificacion = { resultado, timestamp: Date.now() }
  return resultado
}