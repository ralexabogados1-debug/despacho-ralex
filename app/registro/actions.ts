'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function registrar(formData: FormData) {
  const supabase = await createClient()

  const nombre = formData.get('nombre') as string
  const apellidos = formData.get('apellidos') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const nombre_completo = `${nombre} ${apellidos}`.trim()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre_completo: nombre_completo,
        rol: 'Abogado',
      },
    },
  })

  if (error) {
    redirect('/registro?error=' + encodeURIComponent(error.message))
  }

  redirect('/login?registrado=1')
}