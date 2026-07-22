'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Activa o suspende la cuenta de un usuario.
 * Solo debe ser invocado desde la página de usuarios, que ya
 * está protegida para administradores en el Server Component.
 */
export async function cambiarEstadoUsuario(usuarioId: number, nuevoEstado: boolean) {
  const supabase = await createClient()

  // Verificación de seguridad adicional: confirmar que quien llama es admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: miPerfil } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('auth_id', user.id)
    .single()

  if (!miPerfil || miPerfil.rol?.toLowerCase() !== 'admin') {
    return { error: 'No tienes permisos para realizar esta acción' }
  }

  const { data, error } = await supabase
  .from('usuarios')
  .update({ activo: nuevoEstado })
  .eq('id', usuarioId)
  .select()

if (error) {
  return { error: error.message }
}

// 🔧 Si RLS bloquea el update, Postgres no regresa error — solo 0 filas.
if (!data || data.length === 0) {
  return { error: 'No se pudo actualizar (posible bloqueo de RLS en la tabla usuarios).' }
}

revalidatePath('/sistema/usuarios')
return { success: true }
}