'use client'

// components/BannerOffline.tsx
//
// Toast compartido de estado de conexion. Reemplaza los banners inline
// que cada modulo (Civil, Penal, Amparo, Calendario) traia con su propio
// estilo y que se quedaban fijos en pantalla mientras durara el modo
// offline. Este componente:
//
//   1. Se ve IGUAL en todos los modulos (no depende del tema claro/oscuro
//      de la pagina, como cualquier toast).
//   2. Aparece cuando `esOffline` pasa a true, y se desvanece solo tras
//      unos segundos (no hay que cerrarlo a mano).
//   3. Cuando `esOffline` vuelve a false (se recupero la conexion),
//      muestra un aviso breve de confirmacion y tambien se desvanece solo
//      -- pero SOLO si el aviso de "sin conexion" llego a mostrarse antes.
//      Esto evita el falso "Conexion restablecida" que aparecia al cargar
//      la pagina: varios hooks (useTablaLocal y derivados) reportan
//      `isOnline = false` por una fraccion de segundo mientras verifican
//      la conexion real, antes de establecerlo en `true`. Sin este
//      resguardo, ese parpadeo inicial se interpretaba como una
//      reconexion aunque el usuario nunca estuvo realmente offline.
//
// Uso (identico en cualquier page.tsx):
//   <BannerOffline esOffline={esOffline} />

import { useEffect, useRef, useState } from 'react'

const DURACION_OFFLINE_MS = 6000
const DURACION_ONLINE_MS = 3000

type Estado = { tipo: 'offline' | 'online'; texto: string } | null

export default function BannerOffline({ esOffline }: { esOffline: boolean }) {
  const [estado, setEstado] = useState<Estado>(null)
  const [visible, setVisible] = useState(false)
  const primerRender = useRef(true)

  // Solo llega a `true` cuando el banner de "sin conexion" realmente se
  // mostro en pantalla. El aviso de "Conexion restablecida" depende de
  // esta bandera, no solo de que `esOffline` haya cambiado a false.
  const seMostroOffline = useRef(false)

  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      if (esOffline) {
        seMostroOffline.current = true
        activar('offline')
      }
      return
    }

    if (esOffline) {
      seMostroOffline.current = true
      activar('offline')
    } else if (seMostroOffline.current) {
      seMostroOffline.current = false
      activar('online')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esOffline])

  function activar(tipo: 'offline' | 'online') {
    setEstado({
      tipo,
      texto: tipo === 'offline' ? 'Sin conexión · datos guardados localmente' : 'Conexión restablecida',
    })
    setVisible(true)
  }

  useEffect(() => {
    if (!visible) return
    const duracion = estado?.tipo === 'offline' ? DURACION_OFFLINE_MS : DURACION_ONLINE_MS
    const t = setTimeout(() => setVisible(false), duracion)
    return () => clearTimeout(t)
  }, [visible, estado])

  if (!estado) return null

  const esOfflineMsg = estado.tipo === 'offline'
  const color = esOfflineMsg ? '#e0a930' : '#3ecf8e'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 14,
        left: '50%',
        transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, -10px)',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: 'rgba(17,22,34,0.72)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: 999,
        padding: '8px 14px 8px 10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.15)',
        maxWidth: '92vw',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
          boxShadow: `0 0 0 3px ${color}22`,
          animation: esOfflineMsg ? 'pulso-offline 1.8s ease-in-out infinite' : 'none',
        }}
      />
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          letterSpacing: '-0.1px',
          color: 'rgba(255,255,255,0.82)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {estado.texto}
      </span>

      <style>{`
        @keyframes pulso-offline {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}