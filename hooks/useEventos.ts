import { useTablaLocal } from './useTablaLocal'
import { queryEventosLocal } from '@/lib/dbHelpers'

export function useEventos() {
  const { datos, ...resto } = useTablaLocal({
    tabla: 'eventos',
    queryLocal: queryEventosLocal,
  })
  return { eventos: datos, ...resto }
}