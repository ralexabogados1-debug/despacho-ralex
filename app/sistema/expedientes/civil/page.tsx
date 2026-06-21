// app/expedientes/civil-familiar/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClienteCivilFamiliar from './cliente'

export default async function CivilFamiliarPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Obtener los IDs de las materias Civil y Familiar
  const { data: materiasDB } = await supabase
    .from('materias')
    .select('id, nombre')
    .in('nombre', ['Civil', 'Familiar'])

  const idsMaterias = materiasDB?.map(m => m.id) ?? []

  // 2. Obtener juzgados correspondientes a Civil y Familiar
  const { data: juzgados } = await supabase
    .from('juzgados')
    .select('id, nombre, ciudad, materia_id')
    .in('materia_id', idsMaterias.length ? idsMaterias : [-1])

  // 3. Obtener abogados para el select de responsable
  const { data: abogados } = await supabase
    .from('usuarios')
    .select('id, nombre_completo')
    .eq('rol', 'Abogado')
    .eq('activo', true)

  // 4. Cargar expedientes con sus relaciones y tareas
  const { data: expedientesRaw } = await supabase
    .from('expedientes')
    .select(`
      id,
      numero_expediente,
      tipo_juicio,
      caracter_cliente,
      contraparte,
      ciudad,
      estado,
      fecha_inicio,
      materia_id,
      clientes ( nombre_completo ),
      juzgados ( nombre, ciudad ),
      tareas ( id, descripcion, fecha_vencimiento, completada )
    `)
    .in('materia_id', idsMaterias.length ? idsMaterias : [-1])
    .order('created_at', { ascending: false })

  // Normalizar para evitar referencias circulares en el RSC payload
  const expedientes = (expedientesRaw ?? []).map((exp: any) => ({
    id:               exp.id,
    numero_expediente: exp.numero_expediente,
    tipo_juicio:      exp.tipo_juicio,
    caracter_cliente: exp.caracter_cliente,
    contraparte:      exp.contraparte,
    ciudad:           exp.ciudad,
    estado:           exp.estado,
    fecha_inicio:     exp.fecha_inicio,
    materia_id:       exp.materia_id,
    clientes:  exp.clientes  ? { nombre_completo: exp.clientes.nombre_completo } : null,
    juzgados:  exp.juzgados  ? { nombre: exp.juzgados.nombre, ciudad: exp.juzgados.ciudad } : null,
    tareas: (exp.tareas ?? []).map((t: any) => ({
      id:               t.id,
      descripcion:      t.descripcion,
      fecha_vencimiento: t.fecha_vencimiento,
      completada:       t.completada,
    })),
  }))

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(20px, 5vw, 40px)', maxWidth: 1200 }}>
      <ClienteCivilFamiliar
        materias={materiasDB ?? []}
        juzgados={juzgados ?? []}
        abogados={abogados ?? []}
        expedientes={expedientes}
      />
    </div>
  )
}