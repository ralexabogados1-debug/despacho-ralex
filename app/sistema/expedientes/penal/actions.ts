'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearCausaPenal(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  // Id de la materia Penal
  const { data: materiaPenal } = await supabase
    .from('materias')
    .select('id')
    .eq('nombre', 'Penal')
    .single()

  // 1. Cliente
  const { data: cliente, error: errCliente } = await supabase
    .from('clientes')
    .insert({ nombre_completo: formData.get('cliente_nombre') as string })
    .select('id')
    .single()

  if (errCliente || !cliente) return { error: 'Error al crear cliente: ' + errCliente?.message }

  // 2. Expediente base
  const { data: expediente, error: errExp } = await supabase
    .from('expedientes')
    .insert({
      numero_expediente: formData.get('numero_causa') as string,
      fecha_inicio: (formData.get('fecha_inicio') as string) || null,
      materia_id: materiaPenal?.id,
      cliente_id: cliente.id,
      juez_id: Number(formData.get('juez_id')) || null,
      caracter_cliente: (formData.get('rol_cliente') as string) || null,
      contraparte: (formData.get('contraparte') as string) || null,
      descripcion: (formData.get('descripcion') as string) || null,
      creado_por: perfil?.id ?? null,
      estado: (formData.get('estado') as string) || 'Activo',
    })
    .select('id')
    .single()

  if (errExp || !expediente) return { error: 'Error al crear expediente: ' + errExp?.message }

  // 3. Datos penales (tabla hija)
  const { error: errPenal } = await supabase.from('expedientes_penales').insert({
    expediente_id: expediente.id,
    ministerio_publico_id: Number(formData.get('mp_id')) || null,
    numero_causa_penal: (formData.get('numero_causa') as string) || null,
    numero_carpeta_investigacion: (formData.get('numero_carpeta') as string) || null,
    delito: (formData.get('delito') as string) || null,
    estadio_procesal: (formData.get('etapa_procesal') as string) || null,
    rol_abogado: (formData.get('rol_abogado') as string) || null,
  })

  if (errPenal) return { error: 'Error al crear datos penales: ' + errPenal.message }

  // 4. Abogado responsable
  const abogadoId = Number(formData.get('abogado_id')) || perfil?.id
  if (abogadoId) {
    await supabase.from('expediente_abogados').insert({
      expediente_id: expediente.id,
      usuario_id: abogadoId,
      es_responsable: true,
    })
  }

  // NOTA: "Próxima Audiencia" y "Tipo de Audiencia" se conectarán con la agenda.

  revalidatePath('/expedientes/penal')
  return { success: true }
}