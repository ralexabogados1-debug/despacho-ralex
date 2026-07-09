'use client'

// components/BannerOffline.tsx
//
// Toast compartido de estado de conexión. Reemplaza los banners inline
// que cada módulo (Civil, Penal, Amparo, Calendario) traía con su propio
// estilo y que se quedaban fijos en pantalla mientras durara el modo
// offline. Este componente:
//
//   1. Se ve IGUAL en todos los módulos (no depende del tema claro/oscuro
//      de la página, como cualquier toast).
//   2. Aparece cuando `esOffline` pasa a true, y se desvanece solo tras
//      unos segundos (no hay que cerrarlo a mano).
//   3. Cuando `esOffline` vuelve a false (se recuperó la conexión),
//      muestra un aviso breve de confirmación y también se desvanece solo.
//
// Uso (idéntico en cualquier page.tsx):
//   <BannerOffline esOffline={esOffline} />

import { useEffect, useRef, useState } from 'react'

const DURACION_OFFLINE_MS = 6000
const DURACION_ONLINE_MS = 3500

type Estado = { tipo: 'offline' | 'online'; texto: string } | null

export default function BannerOffline({ esOffline }: { esOffline: boolean }) {
  const [estado, setEstado] = useState<Estado>(null)
  const [visible, setVisible] = useState(false)
  const primerRender = useRef(true)

  // Decide qué mensaje mostrar cuando cambia esOffline
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      // En el primer render solo avisamos si ya arrancamos sin conexión;
      // no mostramos "conexión restablecida" sin haber estado offline antes.
      if (esOffline) activar('offline')
      return
    }
    activar(esOffline ? 'offline' : 'online')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esOffline])

  function activar(tipo: 'offline' | 'online') {
    setEstado({
      tipo,
      texto:
        tipo === 'offline'
          ? 'Modo sin conexión — mostrando datos guardados localmente'
          : 'Conexión restablecida — sincronizando…',
    })
    setVisible(true)
  }

  // Temporizador de auto-ocultado, independiente por cada vez que se activa
  useEffect(() => {
    if (!visible) return
    const duracion = estado?.tipo === 'offline' ? DURACION_OFFLINE_MS : DURACION_ONLINE_MS
    const t = setTimeout(() => setVisible(false), duracion)
    return () => clearTimeout(t)
  }, [visible, estado])

  if (!estado) return null

  const esOfflineMsg = estado.tipo === 'offline'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, -16px)',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#0f172a',
        border: `0.5px solid ${esOfflineMsg ? 'rgba(251,191,36,0.35)' : 'rgba(74,222,128,0.35)'}`,
        borderRadius: 10,
        padding: '10px 16px',
        color: esOfflineMsg ? '#fbbf24' : '#4ade80',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
        maxWidth: '92vw',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0 }}>{esOfflineMsg ? '📡' : '✅'}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{estado.texto}</span>
    </div>
  )
}