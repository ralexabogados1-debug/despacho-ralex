// app/tareas/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TableroTareasCliente from './cliente'

export default async function TareasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioActual } = await supabase
    .from('usuarios')
    .select('id, nombre_completo')
    .eq('auth_id', user.id)
    .single()

  const { data: expedientesRaw } = await supabase
    .from('expedientes')
    .select('id, numero_expediente, materias ( nombre )')

  const { data: abogados } = await supabase
    .from('usuarios')
    .select('id, nombre_completo')
    .eq('rol', 'Abogado')
    .eq('activo', true)

  const { data: tareasRaw } = await supabase
    .from('tareas')
    .select(`
      id, descripcion, fecha_vencimiento, completada, estado_kanban, asignado_a_usuario_id,
      usuarios ( nombre_completo ),
      expedientes (
        numero_expediente,
        materias ( nombre )
      )
    `)
    .order('fecha_vencimiento', { ascending: true })

  // Normalizar para evitar referencias circulares en el RSC payload
  const tareas = (tareasRaw ?? []).map((t: any) => ({
    id:                    t.id,
    descripcion:           t.descripcion,
    fecha_vencimiento:     t.fecha_vencimiento,
    completada:            t.completada,
    estado_kanban:         t.estado_kanban,
    asignado_a_usuario_id: t.asignado_a_usuario_id,
    usuarios:    t.usuarios    ? { nombre_completo: t.usuarios.nombre_completo } : null,
    expedientes: t.expedientes ? {
      numero_expediente: t.expedientes.numero_expediente,
      materias: t.expedientes.materias ? { nombre: t.expedientes.materias.nombre } : null,
    } : null,
  }))

  const expedientes = (expedientesRaw ?? []).map((e: any) => ({
    id:                e.id,
    numero_expediente: e.numero_expediente,
    materias: e.materias ? { nombre: e.materias.nombre } : null,
  }))

  return (
    <div style={{ padding: 'clamp(20px, 5vw, 40px) clamp(20px, 5vw, 40px)', maxWidth: 1400 }}>
      <TableroTareasCliente
        tareasInit={tareas}
        expedientes={expedientes}
        abogados={abogados ?? []}
        usuarioActualId={usuarioActual?.id ?? 0}
      />
    </div>
  )
}