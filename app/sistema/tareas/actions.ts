// app/tareas/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Crear una nueva tarea vinculada a un expediente
export async function crearTarea(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const expedienteId = Number(formData.get('expediente_id')) || null
  const asignadoA = Number(formData.get('asignado_a')) || null

  const { error } = await supabase
    .from('tareas')
    .insert({
      descripcion: formData.get('descripcion') as string,
      expediente_id: expedienteId,
      asignado_a_usuario_id: asignadoA,
      fecha_vencimiento: (formData.get('fecha_vencimiento') as string) || null,
      estado_kanban: 'Por Hacer', // Estado inicial por defecto
      completada: false
    })

  if (error) return { error: 'Error al crear la tarea: ' + error.message }

  revalidatePath('/tareas')
  return { success: true }
}

// Actualizar el estado de una tarea (Mover entre columnas del Kanban)
export async function actualizarEstadoTarea(id: number, nuevoEstado: 'Por Hacer' | 'En Progreso' | 'Completada') {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tareas')
    .update({ 
      estado_kanban: nuevoEstado,
      completada: nuevoEstado === 'Completada' 
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/tareas')
  return { success: true }
}

// Eliminar manualmente una tarea (como indica image_816d1a.png en la sección de completadas)
export async function eliminarTarea(id: number) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tareas')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/tareas')
  return { success: true }
}