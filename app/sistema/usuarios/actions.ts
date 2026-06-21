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

  const { error } = await supabase
    .from('usuarios')
    .update({ activo: nuevoEstado })
    .eq('id', usuarioId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/sistema/usuarios')
  return { success: true }
}