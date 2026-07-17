'use client'

import { useArranque } from '@/hooks/useArranque'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { leerSesionLocal } from '@/lib/authLocal'
import { query } from '@/lib/dbHelpers'
import UsuariosCliente from './cliente'

interface Metricas { totalAbogados: number; totalActivos: number; totalInactivos: number }

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 Helper: getUser con timeout — nunca lanza error (mismo patrón que los
// demás módulos: Dashboard/Civil/Penal/Amparo/Calendario/Perfil/Tareas)
// ─────────────────────────────────────────────────────────────────────────────
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

function calcularMetricas(usuarios: any[]): Metricas {
  const totalAbogados = usuarios.length
  const totalActivos = usuarios.filter((u) => u.activo === true || u.activo === 1).length
  const totalInactivos = totalAbogados - totalActivos
  return { totalAbogados, totalActivos, totalInactivos }
}

// ─────────────────────────────────────────────────────────────────────────────
// 📦 Carga local desde SQLite — misma forma que Supabase devuelve
// ─────────────────────────────────────────────────────────────────────────────
async function cargarUsuariosLocales() {
  const usuarios = await query<any>(
    `SELECT * FROM usuarios ORDER BY nombre_completo ASC`
  ).catch(() => [] as any[])
  return usuarios
}

export default function UsuariosPage() {
    const arranqueListo = useArranque()
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [usuarios, setUsuarios] = useState<any[]>([])
  const [metricas, setMetricas] = useState<Metricas>({ totalAbogados: 0, totalActivos: 0, totalInactivos: 0 })
  const [loading, setLoading] = useState(true)
  const [esOffline, setEsOffline] = useState(false)
  const [accesoDenegado, setAccesoDenegado] = useState(false)

  useEffect(() => {
    if (!arranqueListo) return
    const cargar = async () => {
      const sesionLocal = leerSesionLocal()
      const cacheValido = sesionLocal && sesionLocal.expires_at > Date.now()

      const usarDatosLocales = async () => {
        // El rol offline viene de la sesión local, no de una consulta —
        // no podemos verificar contra Postgres si no hay red.
        const esAdminLocal = sesionLocal?.rol?.toLowerCase() === 'admin'
        if (!esAdminLocal) {
          setAccesoDenegado(true)
          setLoading(false)
          return
        }
        try {
          const locales = await cargarUsuariosLocales()
          setUsuarios(locales)
          setMetricas(calcularMetricas(locales))
        } catch (e) {
          console.error('SQLite error (usuarios):', e)
        }
        setEsOffline(true)
        setLoading(false)
      }

      // 🔧 Si el navegador ya sabe que no hay conexión, ni intentamos el
      // fetch a Supabase — evita el error de red innecesario y el ruido en
      // consola (Failed to fetch / ERR_INTERNET_DISCONNECTED) cuando está
      // completamente offline.
      const authUser = navigator.onLine
        ? await getUserConTimeout(supabase)
        : null

      if (!authUser) {
        if (!cacheValido) {
          router.push('/login')
          return
        }
        await usarDatosLocales()
        return
      }

      try {
        // Solo administradores
        const { data: miPerfil, error: errPerfil } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('auth_id', authUser.id)
          .single()
        if (errPerfil) console.error('🔴 Error verificando rol:', errPerfil)

        if (!miPerfil || miPerfil.rol !== 'admin') {
          router.push('/sistema/dashboard')
          return
        }

        const { data: listaUsuarios, error: errLista } = await supabase
          .from('usuarios')
          .select('*')
          .order('nombre_completo', { ascending: true })
        if (errLista) console.error('🔴 Error cargando usuarios:', errLista)

        const lista = listaUsuarios ?? []
        setUsuarios(lista)
        setMetricas(calcularMetricas(lista))
        setLoading(false)

      } catch (e) {
        console.error('Usuarios error:', e)
        if (cacheValido) {
          await usarDatosLocales()
        } else {
          router.push('/login')
        }
      }
    }

    cargar()
  }, [supabase, router, arranqueListo])

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #3a5fb8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Offline y sin rol admin en la sesión local: no mostramos la pantalla,
  // igual que el redirect('/sistema/dashboard') del Server Component original.
  if (accesoDenegado) {
    router.push('/sistema/dashboard')
    return null
  }

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 40px)', maxWidth: 1400, margin: '0 auto' }}>
      {esOffline && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(58,95,184,0.08)', border: '0.5px solid rgba(58,95,184,0.25)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 15 }}>📡</span>
          <span style={{ fontSize: 13, color: '#3a5fb8' }}>
            Modo sin conexión — mostrando datos guardados localmente. Activar/suspender usuarios
            requiere conexión.
          </span>
        </div>
      )}
      <UsuariosCliente
        usuariosIniciales={usuarios}
        metricas={metricas}
      />
    </div>
  )
}