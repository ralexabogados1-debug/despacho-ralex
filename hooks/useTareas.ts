import { useTablaLocal } from './useTablaLocal'
import { queryTareasLocal } from '@/lib/dbHelpers'

export function useTareas() {
  const { datos, ...resto } = useTablaLocal({
    tabla: 'tareas',
    queryLocal: queryTareasLocal,
    softDeleteCol: 'eliminada',
  })
  return { tareas: datos, ...resto }
}