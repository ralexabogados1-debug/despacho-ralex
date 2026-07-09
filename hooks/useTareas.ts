'use client'

// ─────────────────────────────────────────────────────────────────────────
// 🔄 useTareas — mismo patrón que useExpedientes('expedientes_civiles'),
// pero para la tabla 'tareas'. Envuelve useTablaLocal() (canónico, ver
// Arquitectura_Offline sección 13.2) con:
//   - queryLocal: queryTareasLocal (join con expedientes/usuarios, igual
//     shape anidado que devuelve Supabase en tareas/page.tsx)
//   - softDeleteCol: 'eliminada' → eliminar() hace UPDATE eliminada=1 +
//     encola upsert, en vez de DELETE real (igual que el resto de tablas
//     con soft-delete del proyecto)
//
// Expone { tareas, guardar, eliminar, isOnline, syncing, sincronizar,
// recargar } — el alias datos→tareas es lo único que agrega este wrapper
// sobre useTablaLocal(); todo lo demás se re-exporta tal cual.
// ─────────────────────────────────────────────────────────────────────────

import { useTablaLocal } from './useTablaLocal'
import { queryTareasLocal } from '@/lib/dbHelpers'

export function useTareas() {
  const {
    datos: tareas,
    guardar,
    eliminar,
    isOnline,
    syncing,
    sincronizar,
    recargar,
  } = useTablaLocal({
    tabla: 'tareas',
    queryLocal: queryTareasLocal,
    softDeleteCol: 'eliminada',
  })

  return { tareas, guardar, eliminar, isOnline, syncing, sincronizar, recargar }
}