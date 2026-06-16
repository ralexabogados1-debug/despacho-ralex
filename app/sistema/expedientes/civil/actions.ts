'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearExpedienteCivilFamiliar(formData: FormData) {
  const supabase = await createClient()

  // 1. Obtener usuario e ID de perfil
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  // 2. Crear o asociar Cliente
  const { data: cliente, error: errCliente } = await supabase
    .from('clientes')
    .insert({ nombre_completo: formData.get('cliente_nombre') as string })
    .select('id')
    .single()

  if (errCliente || !cliente) return { error: 'Error al crear cliente' }

  // 3. Insertar Expediente Base
  const { data: expediente, error: errExp } = await supabase
    .from('expedientes')
    .insert({
      numero_expediente: formData.get('numero_expediente') as string,
      fecha_inicio: (formData.get('fecha_inicio') as string) || null,
      materia_id: Number(formData.get('materia_id')), // ID de Civil o Familiar
      tipo_juicio: formData.get('tipo_juicio') as string, // Ej: 'Divorcio voluntario'
      cliente_id: cliente.id,
      juzgado_id: Number(formData.get('juzgado_id')) || null,
      caracter_cliente: formData.get('rol_cliente') as string,
      contraparte: formData.get('contraparte') as string,
      ciudad: formData.get('ciudad') as string,
      descripcion: formData.get('descripcion') as string,
      creado_por: perfil?.id ?? null,
      estado: formData.get('estado') as string || 'Activo',
    })
    .select('id')
    .single()

  if (errExp || !expediente) return { error: 'Error al crear expediente' }

  // 4. Asignar Abogado Responsable
  const abogadoId = Number(formData.get('abogado_id')) || perfil?.id
  if (abogadoId) {
    await supabase.from('expediente_abogados').insert({
      expediente_id: expediente.id,
      usuario_id: abogadoId,
      es_responsable: true,
    })
  }

  // 5. Manejo del Término Legal (Insertar en Tabla Tareas)
  const fechaLimite = formData.get('fecha_limite_termino') as string
  if (fechaLimite) {
    const plazoOtorga = formData.get('plazo_otorgado') as string // Ej: '9 días hábiles'
    await supabase.from('tareas').insert({
      expediente_id: expediente.id,
      asignado_a_usuario_id: abogadoId,
      descripcion: `Vencimiento de término: ${plazoOtorga}`,
      fecha_vencimiento: fechaLimite,
      completada: false
    })
  }

  revalidatePath('/expedientes/civil-familiar')
  return { success: true }
}