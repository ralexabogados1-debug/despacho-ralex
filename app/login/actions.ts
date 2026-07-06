'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function iniciarSesion(formData: FormData) {
  const email    = formData.get('email')    as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('id, activo, rol, nombre_completo')
    .eq('auth_id', data.user.id)
    .single()

  if (!perfil || perfil.activo !== true) {
    await supabase.auth.signOut()
    redirect('/login?error=' + encodeURIComponent('Tu cuenta está pendiente de aprobación.'))
  }

  // Pasar datos al cliente para cachear — via search params codificados
  const nombre    = perfil.nombre_completo ?? data.user.email ?? 'Usuario'
  const iniciales = nombre.split(' ').map((p: string) => p[0] ?? '').join('').slice(0, 2).toUpperCase()

  const sesionParam = encodeURIComponent(JSON.stringify({
    id:         data.user.id,
    email,
    nombre,
    rol:        perfil.rol ?? 'asistente',
    iniciales,
    activo:     true,
    expires_at: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 días
  }))

  // Redirigir con datos de sesión y flag para guardar creds
  redirect(`/sistema/dashboard?_session=${sesionParam}&_saveEmail=${encodeURIComponent(email)}`)
}