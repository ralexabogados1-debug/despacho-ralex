'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function iniciarSesion(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // ── Validar que la cuenta esté activa ──────────────────────────────────
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('activo')
    .eq('auth_id', data.user.id)
    .single()

  if (!perfil || perfil.activo !== true) {
    // Cerramos la sesión recién creada: no puede quedarse logueado
    await supabase.auth.signOut()
    redirect(
      '/login?error=' +
      encodeURIComponent('Tu cuenta está pendiente de aprobación por un administrador.')
    )
  }

  redirect('/sistema/dashboard')
}