// app/calendario/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearEventoRapido(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No se encontró una sesión activa.' }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  const tipo = formData.get('tipo_evento') as string       
  const descripcion = formData.get('descripcion') as string
  const fechaHora = formData.get('fecha_hora') as string // Recibe "YYYY-MM-DDTHH:MM" del input
  
  const expRaw = formData.get('expediente_id')
  const expedienteId = expRaw && expRaw !== "" ? Number(expRaw) : null

  const { error } = await supabase
    .from('eventos')
    .insert({
      titulo: descripcion,
      tipo_evento: tipo,
      fecha_hora: fechaHora ? fechaHora : null, // Mapeo directo al timestamp de tu BD
      expediente_id: expedienteId,
      usuario_id: perfil?.id ?? null 
    })

  if (error) {
    console.error('⚠️ Supabase Error:', error.message)
    return { error: `Error de Base de Datos: ${error.message}` }
  }

  revalidatePath('/calendario')
  return { success: true }
}
// Añadir al final de app/calendario/actions.ts

export async function actualizarEvento(id: number, formData: FormData) {
  const supabase = await createClient()

  // Validar sesión
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const tipo = formData.get('tipo_evento') as string       
  const descripcion = formData.get('descripcion') as string
  const fechaHora = formData.get('fecha_hora') as string 
  
  const expRaw = formData.get('expediente_id')
  const expedienteId = expRaw && expRaw !== "" ? Number(expRaw) : null

  const { error } = await supabase
    .from('eventos')
    .update({
      titulo: descripcion,
      tipo_evento: tipo,
      fecha_hora: fechaHora ? fechaHora : null,
      expediente_id: expedienteId
    })
    .eq('id', id)

  if (error) return { error: `Error al actualizar: ${error.message}` }

  revalidatePath('/calendario')
  return { success: true }
}

export async function eliminarEvento(id: number) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('eventos')
    .delete()
    .eq('id', id)

  if (error) return { error: `Error al eliminar: ${error.message}` }

  revalidatePath('/calendario')
  return { success: true }
}