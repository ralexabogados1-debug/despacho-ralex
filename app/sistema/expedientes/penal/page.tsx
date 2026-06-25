// app/expedientes/penal/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClienteCausasPenales from './cliente'

export default async function CausasPenalesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: materiaPenal } = await supabase
    .from('materias')
    .select('id')
    .eq('nombre', 'Penal')
    .single()

  const { data: juzgadosPenales } = await supabase
    .from('juzgados')
    .select('id')
    .eq('materia_id', materiaPenal?.id ?? -1)

  const idsJuzgadosPenales = juzgadosPenales?.map((j) => j.id) ?? []

  const { data: jueces } = await supabase
    .from('jueces')
    .select('id, nombre')
    .in('juzgado_id', idsJuzgadosPenales.length ? idsJuzgadosPenales : [-1])

  const { data: ministerios } = await supabase
    .from('ministerios_publicos')
    .select('id, nombre_agencia')

  const { data: abogados } = await supabase
    .from('usuarios')
    .select('id, nombre_completo')
    .eq('rol', 'Abogado')
    .eq('activo', true)

  const { data: causasRaw } = await supabase
    .from('expedientes')
    .select(`
      id, numero_expediente, caracter_cliente, estado, fecha_inicio,
      clientes ( nombre_completo ),
      jueces ( nombre ),
      tareas ( id, descripcion, fecha_vencimiento, completada ),
      expedientes_penales (
        numero_carpeta_investigacion, delito, estadio_procesal, rol_abogado,
        ministerios_publicos ( nombre_agencia )
      )
    `)
    .eq('materia_id', materiaPenal?.id ?? -1)
    .order('created_at', { ascending: false })

  // Normalizar para evitar referencias circulares en el RSC payload
  const causas = (causasRaw ?? []).map((c: any) => {
    const penal = Array.isArray(c.expedientes_penales)
      ? c.expedientes_penales[0]
      : c.expedientes_penales

    return {
      id:               c.id,
      numero_expediente: c.numero_expediente,
      caracter_cliente: c.caracter_cliente,
      estado:           c.estado,
      fecha_inicio:     c.fecha_inicio,
      clientes:  c.clientes  ? { nombre_completo: c.clientes.nombre_completo } : null,
      jueces:    c.jueces    ? { nombre: c.jueces.nombre } : null,
      tareas: (c.tareas ?? []).map((t: any) => ({
        id:                t.id,
        descripcion:       t.descripcion,
        fecha_vencimiento: t.fecha_vencimiento,
        completada:        t.completada,
      })),
      expedientes_penales: penal ? [{
        numero_carpeta_investigacion: penal.numero_carpeta_investigacion,
        delito:           penal.delito,
        estadio_procesal: penal.estadio_procesal,
        rol_abogado:      penal.rol_abogado,
        ministerios_publicos: penal.ministerios_publicos
          ? { nombre_agencia: penal.ministerios_publicos.nombre_agencia }
          : null,
      }] : [],
    }
  })

  return (
    // ✅ Contenedor con padding uniforme (mismo que Civil)
    <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(20px, 5vw, 40px)', width: '100%' }}>
      <ClienteCausasPenales
        jueces={jueces ?? []}
        ministerios={ministerios ?? []}
        abogados={abogados ?? []}
        causas={causas}
      />
    </div>
  )
}