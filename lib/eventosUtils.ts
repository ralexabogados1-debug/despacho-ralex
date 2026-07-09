// lib/eventosUtils.ts
//
// Mapeo compartido entre app/calendario/page.tsx (carga inicial, online u
// offline) y app/calendario/cliente.tsx (datos locales reactivos que
// devuelve el hook useEventos). Ambas fuentes —el select() de Supabase y
// queryEventosLocal() en dbHelpers.ts— devuelven EXACTAMENTE el mismo
// shape anidado: { ..., expedientes: { numero_expediente } }, así que un
// único mapeo sirve para las dos.

export interface EventoCrudo {
  id: number
  titulo: string
  fecha_hora: string | null
  tipo_evento: string | null
  expedientes?: { numero_expediente: string | null } | null
}

export interface EventoUI {
  id: number
  titulo: string
  fecha: string
  hora: string
  tipo: string
  expediente: string | null
}

export function mapearEventosCrudos(rows: EventoCrudo[] | null | undefined): EventoUI[] {
  return (rows ?? [])
    .map((e) => {
      let fechaLimpia = ''
      let horaLimpia = ''

      if (e.fecha_hora) {
        const partes = e.fecha_hora.split('T')
        fechaLimpia = partes[0]
        if (partes[1]) {
          const [h, m] = partes[1].split(':')
          const horaNum = parseInt(h, 10)
          const ampm = horaNum >= 12 ? 'pm' : 'am'
          const hora12 = horaNum % 12 || 12
          horaLimpia = `${hora12}:${m} ${ampm}`
        }
      }

      return {
        id: e.id,
        titulo: e.titulo,
        fecha: fechaLimpia,
        hora: horaLimpia,
        tipo: e.tipo_evento ?? 'Tarea/Pendiente',
        expediente: e.expedientes?.numero_expediente ?? null,
      }
    })
    .filter((ev) => ev.fecha !== '')
}