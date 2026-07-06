import { useTablaLocal } from './useTablaLocal'
import {
  queryExpedientesPenalesLocal,
  queryExpedientesCivilesLocal,
  queryExpedientesAmparoLocal,
} from '@/lib/dbHelpers'

type Tabla = 'expedientes' | 'expedientes_penales' | 'expedientes_civiles' | 'expedientes_amparo'

const QUERY_LOCAL: Partial<Record<Tabla, () => Promise<any[]>>> = {
  expedientes_penales: queryExpedientesPenalesLocal,
  expedientes_civiles: queryExpedientesCivilesLocal,
  expedientes_amparo:  queryExpedientesAmparoLocal,
}

export function useExpedientes(tabla: Tabla) {
  const pk = tabla === 'expedientes' ? 'id' : 'expediente_id'
  const queryLocal = QUERY_LOCAL[tabla]

  const { datos, ...resto } = useTablaLocal({ tabla, pk, queryLocal })
  return { expedientes: datos, ...resto }
}