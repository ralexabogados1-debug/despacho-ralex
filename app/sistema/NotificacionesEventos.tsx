'use client'

import React, { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useTema } from './layout'

const T = {
  surface:     '#0b1220',
  border:      'rgba(255,255,255,0.06)',
  gold:        '#d4af37',
  goldAlpha:   'rgba(212,175,55,0.10)',
  red:         '#b3434f',
  redAlpha:    'rgba(179,67,79,0.10)',
  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted:   'rgba(255,255,255,0.40)',
}

const T_LIGHT = {
  surface:     '#ffffff',
  border:      'rgba(0,0,0,0.08)',
  gold:        '#b8860b',
  goldAlpha:   'rgba(184,134,11,0.10)',
  red:         '#dc2626',
  redAlpha:    'rgba(220,38,38,0.08)',
  textPrimary: 'rgba(0,0,0,0.85)',
  textMuted:   'rgba(0,0,0,0.45)',
}

interface EventoDb {
  id: number
  titulo: string
  fecha_hora: string 
}

interface AlertaActiva {
  id: number
  titulo: string
  mensaje: string
  urgente: boolean
}

// ── ✨ Verificación de conectividad REAL, no solo navigator.onLine ──
// navigator.onLine solo indica si hay una interfaz de red "activa" (WiFi
// conectado o radio de datos encendido), NO si hay internet de verdad.
// Con datos móviles activados pero sin MB/saldo, navigator.onLine sigue
// devolviendo true, por eso hacía falta este ping real con timeout corto.
async function hayConexionReal(timeoutMs = 2500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
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

export default function NotificacionesEventos() {
  const { oscuro } = useTema()
  const colores = oscuro ? T : T_LIGHT
  const [alertas, setAlertas] = useState<AlertaActiva[]>([])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function checarEventosProximos() {
      try {
        // ── ✨ Si no hay conexión real, ni siquiera intentamos tocar Supabase
        const conectado = await hayConexionReal()
        if (!conectado) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: usuarioDb, error: userError } = await supabase
          .from('usuarios')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (userError || !usuarioDb) return
        const usuarioIntId = usuarioDb.id

        const { data: eventos, error: eventosError } = await supabase
          .from('eventos')
          .select('id, titulo, fecha_hora')
          .eq('usuario_id', usuarioIntId)
          .gte('fecha_hora', new Date().toISOString())
          .order('fecha_hora', { ascending: true })
          .limit(10)

        if (eventosError || !eventos) return

        const vistos = JSON.parse(localStorage.getItem('alertas_vistas') || '[]') as number[]
        const nuevasAlertas: AlertaActiva[] = []

        eventos.forEach((ev: EventoDb) => {
          if (vistos.includes(ev.id)) return
          if (alertas.some(a => a.id === ev.id)) return

          const limite = new Date(ev.fecha_hora).getTime()
          const ahora = Date.now()
          const diferenciaMs = limite - ahora
          const horasRestantes = diferenciaMs / (1000 * 60 * 60)

          if (horasRestantes > 0 && horasRestantes <= 2) {
            const minutos = Math.round(horasRestantes * 60)
            nuevasAlertas.push({
              id: ev.id,
              titulo: ev.titulo,
              mensaje: `¡Urgente! Inicia en ${minutos} minutos.`,
              urgente: true
            })
          } 
          else if (horasRestantes > 2 && horasRestantes <= 24) {
            const horas = Math.round(horasRestantes)
            nuevasAlertas.push({
              id: ev.id,
              titulo: ev.titulo,
              mensaje: `Faltan aproximadamente ${horas} horas para el evento.`,
              urgente: false
            })
          }
        })

        if (nuevasAlertas.length > 0) {
          setAlertas(prev => [...prev, ...nuevasAlertas])
        }
      } catch (err) {
        console.error('Error al procesar notificaciones:', err)
      }
    }

    checarEventosProximos()
    const interval = setInterval(checarEventosProximos, 180000)

    return () => clearInterval(interval)
  }, [alertas, supabase])

  const descartarAlerta = (id: number) => {
    setAlertas(prev => prev.filter(a => a.id !== id))
    const vistos = JSON.parse(localStorage.getItem('alertas_vistas') || '[]') as number[]
    if (!vistos.includes(id)) {
      vistos.push(id)
      localStorage.setItem('alertas_vistas', JSON.stringify(vistos))
    }
  }

  if (alertas.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      right: 24,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      maxWidth: 360,
      width: 'calc(100% - 48px)',
      pointerEvents: 'none'
    }}>
      {alertas.map((alerta) => {
        const colorAlerta = alerta.urgente ? colores.red : colores.gold

        return (
          <div
            key={alerta.id}
            style={{
              pointerEvents: 'auto',
              background: colores.surface,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: colorAlerta,
              borderRadius: 10,
              padding: '14px 14px 14px 16px',
              boxShadow: oscuro ? '0 10px 25px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.08)',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              position: 'relative',
              overflow: 'hidden',
              animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: colorAlerta
            }} />

            <div style={{ color: colorAlerta, marginTop: 2, flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: colores.textPrimary,
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {alerta.titulo}
              </h4>
              <p style={{
                margin: '3px 0 0',
                fontSize: 12,
                color: colores.textMuted,
                lineHeight: 1.4
              }}>
                {alerta.mensaje}
              </p>
            </div>

            <button
              onClick={() => descartarAlerta(alerta.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: colores.textMuted,
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )
      })}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}