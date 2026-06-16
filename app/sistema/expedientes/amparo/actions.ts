// app/expedientes/amparo/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearExpedienteAmparo(formData: FormData) {
  const supabase = await createClient()

  // 1. Validar Sesión
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  // ID de la materia Amparo
  const { data: materiaAmparo } = await supabase
    .from('materias')
    .select('id')
    .eq('nombre', 'Amparo')
    .single()

  // 2. Insertar o buscar Quejoso (Cliente)
  const { data: cliente, error: errCliente } = await supabase
    .from('clientes')
    .insert({ nombre_completo: formData.get('quejoso_nombre') as string })
    .select('id')
    .single()

  if (errCliente || !cliente) return { error: 'Error al registrar el Quejoso: ' + errCliente?.message }

  // 3. Insertar Expediente Base
  const { data: expediente, error: errExp } = await supabase
    .from('expedientes')
    .insert({
      numero_expediente: formData.get('numero_expediente') as string,
      fecha_inicio: (formData.get('fecha_presentacion') as string) || null, // Fecha de presentación
      materia_id: materiaAmparo?.id,
      cliente_id: cliente.id,
      juzgado_id: Number(formData.get('juzgado_id')) || null, // Juzgado de Distrito
      creado_por: perfil?.id ?? null,
      estado: (formData.get('estado') as string) || 'Activo',
      descripcion: (formData.get('descripcion') as string) || null,
    })
    .select('id')
    .single()

  if (errExp || !expediente) return { error: 'Error al crear expediente base: ' + errExp?.message }

  // 4. Insertar Datos Específicos del Amparo (Tabla Hija)
  const { error: errAmparo } = await supabase
    .from('expedientes_amparo')
    .insert({
      expediente_id: expediente.id,
      tipo_amparo: formData.get('tipo_amparo') as string, // Directo / Indirecto
      autoridad_responsable: formData.get('autoridad_responsable') as string,
      acto_reclamado: formData.get('acto_reclamado') as string,
      tercero_interesado: (formData.get('tercero_interesado') as string) || null,
    })

  if (errAmparo) return { error: 'Error al registrar las particularidades del Amparo: ' + errAmparo.message }

  // 5. Asignar Abogado Responsable
  const abogadoId = Number(formData.get('abogado_id')) || perfil?.id
  if (abogadoId) {
    await supabase.from('expediente_abogados').insert({
      expediente_id: expediente.id,
      usuario_id: abogadoId,
      es_responsable: true,
    })
  }

  // 6. Próximo Término (Si se selecciona, se guarda en la tabla tareas para la agenda unificada)
  const proximoTermino = formData.get('proximo_termino') as string
  if (proximoTermino) {
    await supabase.from('tareas').insert({
      expediente_id: expediente.id,
      asignado_a_usuario_id: abogadoId,
      descripcion: `Término fatal del juicio de amparo`,
      fecha_vencimiento: proximoTermino,
      completada: false,
    })
  }

  revalidatePath('/expedientes/amparo')
  return { success: true }
}