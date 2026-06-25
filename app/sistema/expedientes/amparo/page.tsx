import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClienteAmparos from './cliente'

export default async function AmparosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Obtener ID de la materia Amparo
  const { data: materiaAmparo } = await supabase
    .from('materias')
    .select('id')
    .eq('nombre', 'Amparo')
    .single()

  // Cargar Juzgados de Distrito vinculados a Amparo
  const { data: juzgadosDistrito } = await supabase
    .from('juzgados')
    .select('id, nombre, ciudad')
    .eq('materia_id', materiaAmparo?.id ?? -1)

  // Cargar plantilla de Abogados
  const { data: abogados } = await supabase
    .from('usuarios')
    .select('id, nombre_completo')
    .eq('rol', 'Abogado')
    .eq('activo', true)

  // Consultar todos los juicios de amparo cruzando la tabla intermedia e hija
  const { data: expedientesAmparo } = await supabase
    .from('expedientes')
    .select(`
      id, numero_expediente, estado, fecha_inicio, descripcion,
      clientes ( nombre_completo ),
      juzgados ( nombre, ciudad ),
      tareas ( id, fecha_vencimiento, completada ),
      expedientes_amparo (
        tipo_amparo, autoridad_responsable, acto_reclamado, tercero_interesado
      )
    `)
    .eq('materia_id', materiaAmparo?.id ?? -1)
    .order('created_at', { ascending: false })

  // Normalizar antes de pasar al client component
  const amparosNormalizados = (expedientesAmparo ?? []).map((exp: any) => ({
    id: exp.id,
    numero_expediente: exp.numero_expediente,
    estado: exp.estado,
    fecha_inicio: exp.fecha_inicio,
    descripcion: exp.descripcion,
    clientes: exp.clientes ? { nombre_completo: exp.clientes.nombre_completo } : null,
    juzgados: exp.juzgados ? { nombre: exp.juzgados.nombre, ciudad: exp.juzgados.ciudad } : null,
    tareas: (exp.tareas ?? []).map((t: any) => ({
      id: t.id,
      fecha_vencimiento: t.fecha_vencimiento,
      completada: t.completada,
    })),
    expedientes_amparo: Array.isArray(exp.expedientes_amparo)
      ? exp.expedientes_amparo.map((a: any) => ({
          tipo_amparo: a.tipo_amparo,
          autoridad_responsable: a.autoridad_responsable,
          acto_reclamado: a.acto_reclamado,
          tercero_interesado: a.tercero_interesado,
        }))
      : exp.expedientes_amparo
        ? {
            tipo_amparo: exp.expedientes_amparo.tipo_amparo,
            autoridad_responsable: exp.expedientes_amparo.autoridad_responsable,
            acto_reclamado: exp.expedientes_amparo.acto_reclamado,
            tercero_interesado: exp.expedientes_amparo.tercero_interesado,
          }
        : null,
  }))

  return (
    // ✅ Mismo contenedor que Civil y Penal para igualar el espaciado
    <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(20px, 5vw, 40px)', width: '100%' }}>
      <ClienteAmparos
        juzgados={juzgadosDistrito ?? []}
        abogados={abogados ?? []}
        amparos={amparosNormalizados}
      />
    </div>
  )
}