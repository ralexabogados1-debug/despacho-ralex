// app/calendario/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarioCliente from './cliente'

export default async function CalendarioPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expedientes } = await supabase
    .from('expedientes')
    .select('id, numero_expediente')

  const { data: eventosDB } = await supabase
    .from('eventos')
    .select(`
      id, titulo, fecha_hora, tipo_evento,
      expedientes ( numero_expediente )
    `)

  const eventosEstructurados = (eventosDB ?? []).map((e: any) => {
    let fechaLimpia = ''
    let horaLimpia  = ''

    if (e.fecha_hora) {
      const partes = e.fecha_hora.split('T')
      fechaLimpia  = partes[0]
      if (partes[1]) {
        const [h, m] = partes[1].split(':')
        const horaNum = parseInt(h, 10)
        const ampm    = horaNum >= 12 ? 'pm' : 'am'
        const hora12  = horaNum % 12 || 12
        horaLimpia    = `${hora12}:${m} ${ampm}`
      }
    }

    return {
      id:         e.id,
      titulo:     e.titulo,
      fecha:      fechaLimpia,
      hora:       horaLimpia,
      tipo:       e.tipo_evento ?? 'Tarea/Pendiente',
      expediente: e.expedientes?.numero_expediente ?? null,
    }
  }).filter(ev => ev.fecha !== '')

  // ✅ Sin wrapper propio — el layout ya provee el fondo y el padding
  return (
    <CalendarioCliente
      eventosIniciales={eventosEstructurados}
      expedientes={expedientes ?? []}
    />
  )
}