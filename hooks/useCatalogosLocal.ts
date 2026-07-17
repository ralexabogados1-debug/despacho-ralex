import { useEffect, useState } from 'react'
import { queryCatalogosLocal } from '@/lib/dbHelpers'
import { syncConSupabase } from '@/lib/sync'

export function useCatalogosLocal() {
  const [clientes, setClientes]       = useState<any[]>([])
  const [jueces, setJueces]           = useState<any[]>([])
  const [ministerios, setMinisterios] = useState<any[]>([])
  const [isOnline, setIsOnline]       = useState(true)
  const [syncing, setSyncing]         = useState(false)

  useEffect(() => {
  setIsOnline(navigator.onLine)
  // ❌ quita: setMontado(true)
  if (navigator.onLine) doSync()
  else cargar()

  let offlineTimer: ReturnType<typeof setTimeout> | null = null

  const on = () => {
    if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null }
    setIsOnline(true)
    doSync()
  }
  const off = () => {
    offlineTimer = setTimeout(() => setIsOnline(false), 3000)
  }

  window.addEventListener('online',  on)
  window.addEventListener('offline', off)
  return () => {
    window.removeEventListener('online',  on)
    window.removeEventListener('offline', off)
    if (offlineTimer) clearTimeout(offlineTimer)
  }
}, [])

  async function cargar() {
    const { clientes, jueces, ministerios } = await queryCatalogosLocal()
    setClientes(clientes)
    setJueces(jueces)
    setMinisterios(ministerios)
  }

  async function doSync() {
    setSyncing(true)
    await syncConSupabase()
    await cargar()
    setSyncing(false)
  }

  return { clientes, jueces, ministerios, isOnline, syncing, sincronizar: doSync }
}