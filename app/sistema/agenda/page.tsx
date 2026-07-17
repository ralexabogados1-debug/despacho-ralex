'use client'

import { useArranque } from '@/hooks/useArranque'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { leerSesionLocal } from '@/lib/authLocal'
import { queryEventosLocal, query } from '@/lib/dbHelpers'
import { mapearEventosCrudos, type EventoUI } from '@/lib/eventosUtils'
import BannerOffline from '@/components/BannerOffline'
import CalendarioCliente from './cliente'

interface ExpedienteOpcion {
  id: number
  numero_expediente: string
}

// ─────────────────────────────────────────────────────────────────────────
// 🔑 Helper: getUser con timeout — nunca lanza error (mismo patrón que
// dashboard/civil/amparo)
// ─────────────────────────────────────────────────────────────────────────
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

export default function CalendarioPage() {
  const arranqueListo = useArranque() // 🆕
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [eventos, setEventos] = useState<EventoUI[]>([])
  const [expedientes, setExpedientes] = useState<ExpedienteOpcion[]>([])
  const [loading, setLoading] = useState(true)
  const [esOffline, setEsOffline] = useState(false)

  useEffect(() => {
    if (!arranqueListo) return 
    const cargar = async () => {
      const sesionLocal = leerSesionLocal()
      const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()

      const usarDatosLocales = async () => {
        try {
          const [eventosLocales, expedientesLocales] = await Promise.all([
            queryEventosLocal(),
            query<ExpedienteOpcion>(
              `SELECT id, numero_expediente FROM expedientes ORDER BY numero_expediente ASC`
            ),
          ])
          setEventos(mapearEventosCrudos(eventosLocales))
          setExpedientes(expedientesLocales)
        } catch (e) {
          console.error('SQLite error (calendario):', e)
        }
        setEsOffline(true)
        setLoading(false)
      }

      // 🔧 Si el navegador ya sabe que no hay conexión, ni intentamos el
      // fetch a Supabase — evita el error de red innecesario y el ruido en
      // consola (Failed to fetch / ERR_INTERNET_DISCONNECTED) cuando está
      // completamente offline.
      const user = navigator.onLine
        ? await getUserConTimeout(supabase)
        : null

      if (!user) {
        if (!cacheValido) {
          router.push('/login')
          return
        }
        await usarDatosLocales()
        return
      }

      try {
        const { data: expedientesData, error: errorExp } = await supabase
          .from('expedientes')
          .select('id, numero_expediente')
        // 🔴 IMPORTANTE: loguear SIEMPRE el error de cada fetch — nunca
        // silenciarlo con ?? [], o un fallo de RLS se vuelve indistinguible
        // de "no hay datos" (ver Arquitectura_Offline sección 12.5).
        if (errorExp) console.error('🔴 Error cargando expedientes:', errorExp)

        const { data: eventosData, error: errorEv } = await supabase
          .from('eventos')
          .select(`id, titulo, fecha_hora, tipo_evento, expedientes ( numero_expediente )`)
        if (errorEv) console.error('🔴 Error cargando eventos:', errorEv)

        setExpedientes(expedientesData ?? [])
        setEventos(mapearEventosCrudos(eventosData as any))
        setLoading(false)
      } catch (e) {
        console.error('Calendario error:', e)
        if (cacheValido) await usarDatosLocales()
        else router.push('/login')
      }
    }

    cargar()
  }, [supabase, router, arranqueListo])

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Cargando calendario…
      </div>
    )
  }

  return (
    <div>
      <BannerOffline esOffline={esOffline} />
      <CalendarioCliente eventosIniciales={eventos} expedientes={expedientes} />
    </div>
  )
}