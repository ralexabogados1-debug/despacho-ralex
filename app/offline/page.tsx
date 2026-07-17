'use client'
import { useEffect } from 'react'

export default function OfflinePage() {
  useEffect(() => {
    // Espera 3 segundos y reintenta cargar la página anterior
    const timer = setTimeout(() => {
      window.history.back()
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: 12,
      textAlign: 'center',
      padding: 20,
      background: '#070a11',
      color: 'rgba(255,255,255,0.85)',
    }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Sin conexión</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, maxWidth: 320 }}>
        Cargando desde tu dispositivo…
      </p>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
        Reintentando automáticamente…
      </p>
    </div>
  )
}