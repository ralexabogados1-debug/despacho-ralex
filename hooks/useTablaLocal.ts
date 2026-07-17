import { useEffect, useState } from 'react'
import { query, run } from '@/lib/dbHelpers'
import { syncConSupabase } from '@/lib/sync'

type ConfigTabla = {
  tabla: string
  pk?: string
  orderBy?: string
  queryLocal?: () => Promise<any[]>
  softDeleteCol?: string   // ej. 'eliminada' — eliminar() hace UPDATE + upsert en cola, no DELETE
  soloLectura?: boolean    // si true, guardar()/eliminar() no hacen nada (ver nota abajo)
}

export function useTablaLocal({
  tabla,
  pk = 'id',
  orderBy = 'updated_at DESC',
  queryLocal,
  softDeleteCol,
  soloLectura = false,
}: ConfigTabla) {
  const [datos, setDatos]       = useState<any[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [montado, setMontado]   = useState(false)

useEffect(() => {
  setIsOnline(navigator.onLine)
  setMontado(true)
  if (navigator.onLine) doSync()
  else cargar()

  let offlineTimer: ReturnType<typeof setTimeout> | null = null

  const on = () => {
    if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null }
    setIsOnline(true)
    doSync()
  }
  const off = () => {
    offlineTimer = setTimeout(() => setIsOnline(false), 3000)
  }

  window.addEventListener('online',  on)
  window.addEventListener('offline', off)
  return () => {
    window.removeEventListener('online',  on)
    window.removeEventListener('offline', off)
    if (offlineTimer) clearTimeout(offlineTimer)
  }
}, [])
  useEffect(() => {
    if (montado) cargar()
  }, [tabla, montado])

  async function cargar() {
    const rows = queryLocal
      ? await queryLocal()
      : await query(`SELECT * FROM ${tabla} ORDER BY ${orderBy}`)
    setDatos(rows)
  }

  async function doSync() {
    setSyncing(true)
    await syncConSupabase()
    await cargar()
    setSyncing(false)
  }

  // 🔧 CORREGIDO: guardar/eliminar ya NO se declaran como `| undefined` en el
  // return. Antes: `guardar: soloLectura ? undefined : guardar`. El problema
  // es que `soloLectura` es un `boolean` genérico, no un literal, así que
  // TypeScript no puede angostar el tipo por llamador — el resultado era que
  // CUALQUIER módulo (Civil, Penal, Amparo...) veía `guardar` tipado como
  // posiblemente undefined (TS2722), aunque en ese módulo soloLectura fuera
  // siempre false. Ahora guardar/eliminar SIEMPRE existen como funciones;
  // si la tabla es de solo lectura, simplemente no hacen nada y avisan por
  // consola, en vez de desaparecer del tipo.
  async function guardar(item: any) {
    if (soloLectura) {
      console.warn(`useTablaLocal: "${tabla}" es de solo lectura; se ignoró guardar().`)
      return
    }
    const ahora = Date.now()
    const cols = [...Object.keys(item), 'sync_status', 'updated_at']
    const placeholders = cols.map(() => '?').join(',')
    const updates = Object.keys(item).map(c => `${c} = excluded.${c}`).join(',')

    await run(
      `INSERT INTO ${tabla} (${cols.join(',')})
       VALUES (${placeholders})
       ON CONFLICT(${pk}) DO UPDATE SET ${updates},
         sync_status='pending', updated_at=excluded.updated_at`,
      [...Object.values(item), 'pending', ahora]
    )
    await run(
      `INSERT INTO sync_queue (tabla, operacion, payload, created_at)
       VALUES (?, 'upsert', ?, ?)`,
      [tabla, JSON.stringify(item), ahora]
    )

    if (isOnline) await doSync()
    else await cargar()
  }

  async function eliminar(id: string) {
    if (soloLectura) {
      console.warn(`useTablaLocal: "${tabla}" es de solo lectura; se ignoró eliminar().`)
      return
    }
    const ahora = Date.now()

    if (softDeleteCol) {
      await run(
        `UPDATE ${tabla} SET ${softDeleteCol} = 1, sync_status='pending', updated_at=? WHERE ${pk} = ?`,
        [ahora, id]
      )
      const [fila] = await query(`SELECT * FROM ${tabla} WHERE ${pk} = ?`, [id])
      if (fila) {
        await run(
          `INSERT INTO sync_queue (tabla, operacion, payload, created_at)
           VALUES (?, 'upsert', ?, ?)`,
          [tabla, JSON.stringify(fila), ahora]
        )
      }
    } else {
      await run(`DELETE FROM ${tabla} WHERE ${pk} = ?`, [id])
      await run(
        `INSERT INTO sync_queue (tabla, operacion, payload, created_at)
         VALUES (?, 'delete', ?, ?)`,
        [tabla, JSON.stringify({ [pk]: id }), ahora]
      )
    }

    if (isOnline) await doSync()
    else await cargar()
  }

  return {
    datos,
    guardar,
    eliminar,
    isOnline,
    syncing,
    sincronizar: doSync,
    recargar: cargar,
  }
}