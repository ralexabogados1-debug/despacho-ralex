import { useEffect, useState } from 'react'

/**
 * Espera 500ms antes de señalar que el arranque está listo.
 * Esto da tiempo a navigator.onLine de estabilizarse tras
 * reabrir la app desde segundo plano o tras matarla.
 */
export function useArranque() {
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setListo(true), 500)
    return () => clearTimeout(t)
  }, [])

  return listo
}