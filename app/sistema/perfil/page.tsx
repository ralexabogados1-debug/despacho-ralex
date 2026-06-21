import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PerfilUsuarioCliente from './cliente'

export default async function MiPerfilPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: miPerfil } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_id', authUser.id)
    .single()

  if (!miPerfil) redirect('/login')

  const miId = miPerfil.id

  // Consultar amparos asignados
  const { data: expedientes } = await supabase
    .from('expedientes_amparo')
    .select('*')
    .eq('abogado_responsable_id', miId)

  // Consultar tareas activas
  const { data: tareas } = await supabase
    .from('tareas')
    .select('id')
    .eq('asignado_a_id', miId)
    .eq('estado', 'Por hacer')

  // Consultar audiencias o términos próximos
  const { data: eventos } = await supabase
    .from('eventos_calendario')
    .select('id')
    .eq('expediente_id', miId)

  // Consultar historial
  const { data: actividades } = await supabase
    .from('actividad_reciente')
    .select('*')
    .eq('usuario_id', miId)
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <PerfilUsuarioCliente
      usuario={miPerfil}
      expedientes={expedientes ?? []}
      conteoTareas={tareas?.length ?? 0}
      conteoEventos={eventos?.length ?? 0}
      actividad={actividades ?? []}
    />
  )
}