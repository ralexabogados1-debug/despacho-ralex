// app/perfil/actions.ts
// Ajusta la ruta del import de createClient si tu carpeta real es distinta (ej. app/mi-perfil/actions.ts)
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function actualizarPerfilUsuario(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No se encontró una sesión activa.' }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!perfil) return { error: 'No se encontró el perfil del usuario.' }

  const nombreCompleto = (formData.get('nombre_completo') as string)?.trim()

  if (!nombreCompleto) {
    return { error: 'El nombre completo es obligatorio.' }
  }

// Nota: solo se actualiza nombre_completo por ahora.
  // Cuando agreguemos las columnas telefono/direccion a la tabla "usuarios",
  // añadimos aquí sus campos correspondientes al objeto de update.
  const { data, error } = await supabase
    .from('usuarios')
    .update({
      nombre_completo: nombreCompleto,
    })
    .eq('id', perfil.id)
    .select()

  if (error) {
    console.error('⚠️ Supabase Error:', error.message)
    return { error: `Error al guardar: ${error.message}` }
  }

  if (!data || data.length === 0) {
    return { error: 'No se pudo actualizar el perfil (revisa políticas RLS).' }
  }

  revalidatePath('/sistema/perfil')
  return { success: true }
}