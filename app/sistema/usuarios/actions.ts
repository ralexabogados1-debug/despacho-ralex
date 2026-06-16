// app/usuarios/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Cambiar el estado del switch (Activo / Inactivo)
export async function cambiarEstadoUsuario(id: number, estadoActual: boolean) {
  const supabase = await createClient()

  // Seguridad: Verificar sesión y rol de Administrador
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado.' }
  
  const { data: adminCheck } = await supabase.from('usuarios').select('rol').eq('auth_id', user.id).single()
  if (adminCheck?.rol !== 'Administrador') return { error: 'Acceso exclusivo para administradores.' }

  const { error } = await supabase
    .from('usuarios')
    .update({ activo: !estadoActual })
    .eq('id', id)

  if (error) return { error: error.message }

  // 💡 Corrección: Revalidamos ambas rutas para que el cambio impacte en todo el despacho en tiempo real
  revalidatePath('/usuarios')
  revalidatePath(`/perfil/${id}`) 
  
  return { success: true }
}

// 2. Crear un nuevo usuario administrativo o colaborador
export async function crearUsuario(formData: FormData) {
  const supabase = await createClient()

  // 💡 Corrección de Seguridad: Añadimos validación para que un colaborador no pueda crear cuentas clonadas
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado.' }
  
  const { data: adminCheck } = await supabase.from('usuarios').select('rol').eq('auth_id', user.id).single()
  if (adminCheck?.rol !== 'Administrador') return { error: 'Acceso denegado. Solo administradores.' }

  const nombre = formData.get('nombre') as string
  const email = formData.get('email') as string
  const rol = formData.get('rol') as string // 'Administrador' | 'Colaborador'

  const { error } = await supabase
    .from('usuarios')
    .insert({
      nombre_completo: nombre,
      email: email,
      rol: rol,
      activo: true
    })

  if (error) return { error: `Error al crear: ${error.message}` }

  revalidatePath('/usuarios')
  return { success: true }
}