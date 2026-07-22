import { query, run } from './dbHelpers';
import { createClient } from './supabase/client';

const supabase = createClient();

// ─────────────────────────────────────────────────────────────────────────
// ⏱️ Envuelve cualquier promesa de Supabase con timeout. Sin esto, cada
// llamada individual puede tardar 15-30s+ en fallar con señal mala, y como
// descargarFrescos() recorre 12 tablas en secuencia, eso fácilmente explica
// sincronizaciones de varios minutos. Con timeout corto, cada tabla que
// falla se salta rápido y se reintenta en la siguiente sincronización.
// ─────────────────────────────────────────────────────────────────────────
async function conTimeout<T = any>(promesa: PromiseLike<T>, ms = 6000): Promise<T> {
  return Promise.race([
    Promise.resolve(promesa),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT_SUPABASE')), ms)
    ),
  ])
}

const COLUMNAS: Record<string, string[]> = {
  expedientes: [
    'id', 'materia_id', 'cliente_id', 'juzgado_id', 'juez_id',
    'numero_expediente', 'tipo_juicio', 'caracter_cliente', 'contraparte',
    'ciudad', 'creado_por', 'estado', 'created_at', 'fecha_inicio', 'descripcion',
    'ultima_actuacion',
  ],
  expedientes_penales: [
    'expediente_id', 'ministerio_publico_id', 'numero_causa_penal',
    'numero_carpeta_investigacion', 'delito', 'estadio_procesal', 'rol_abogado',
    'imputado', 'victima_ofendido', 'proxima_actuacion', 'fecha_audiencia',
    'tipo_audiencia', 'nombre_agente_mp',
  ],
  expedientes_amparo: [
    'expediente_id', 'tipo_amparo', 'autoridad_responsable',
    'acto_reclamado', 'tercero_interesado', 'estadio_procesal', 'proxima_audiencia',
  ],
  expedientes_civiles: [
    'expediente_id', 'estadio_procesal',
  ],
  clientes: [
    'id', 'nombre_completo', 'telefono', 'email', 'created_at',
  ],
  jueces: [
    'id', 'nombre', 'juzgado_id',
  ],
  juzgados: [
    'id', 'nombre', 'ciudad', 'materia_id',
  ],
  materias: [
    'id', 'nombre',
  ],
  ministerios_publicos: [
    'id', 'nombre_agencia', 'ciudad',
  ],
  tareas: [
    'id', 'expediente_id', 'asignado_a_usuario_id',
    'descripcion', 'fecha_vencimiento', 'completada', 'eliminada',
  ],
  eventos: [
    'id', 'expediente_id', 'usuario_id',
    'titulo', 'tipo_evento', 'fecha_hora', 'descripcion',
  ],
  usuarios: [
    'id', 'nombre_completo', 'email', 'rol', 'activo', 'created_at', 'auth_id',
  ],
  // ⚠️ 'eventos_calendario' y 'actividad_reciente' se removieron: no existen
  // como tablas en Supabase (PostgREST devolvía 404 en cada sync).
}

const PK: Record<string, string> = {
  expedientes:          'id',
  expedientes_penales:  'expediente_id',
  expedientes_amparo:   'expediente_id',
  expedientes_civiles:  'expediente_id',
  clientes:             'id',
  jueces:               'id',
  juzgados:             'id',
  materias:             'id',
  ministerios_publicos: 'id',
  tareas:               'id',
  eventos:               'id',
  usuarios:               'id',
}

const TABLAS_CON_ID_AUTOGENERADO = ['clientes', 'expedientes', 'tareas', 'eventos']

const FK_ORIGEN: Record<string, string> = {
  cliente_id: 'clientes',
  expediente_id: 'expedientes',
}

const FKS_POR_TABLA: Record<string, string[]> = {
  expedientes:          ['cliente_id'],
  expedientes_penales:  ['expediente_id'],
  expedientes_civiles:  ['expediente_id'],
  expedientes_amparo:   ['expediente_id'],
  expediente_abogados:  ['expediente_id'],
  tareas:               ['expediente_id'],
  eventos:               ['expediente_id'],
}

const ORDEN_SYNC = [
  'clientes', 'jueces', 'juzgados', 'materias', 'ministerios_publicos', 'usuarios',
  'expedientes',
  'expedientes_penales', 'expedientes_civiles', 'expedientes_amparo',
  'expediente_abogados', 'tareas', 'eventos',
]

const TABLAS = Object.keys(COLUMNAS)

let ultimaSync = 0
const COOLDOWN_MS = 0 // 30 segundos

export async function syncConSupabase() {
  if (!navigator.onLine) return
  if (Date.now() - ultimaSync < COOLDOWN_MS) return
  ultimaSync = Date.now()

  // 🔍 TEMPORAL: ver qué hay en la cola
  const cola = await query(`SELECT * FROM sync_queue ORDER BY created_at ASC`)
  console.log('📋 sync_queue:', JSON.stringify(cola, null, 2))

  try {
    await subirPendientes()
  } catch (e) {
    console.warn('Fallo subiendo pendientes:', e)
  }
  try {
    await descargarFrescos()
  } catch (e) {
    console.warn('Fallo descargando catálogos:', e)
  }
}
async function subirPendientes() {
  // ✅ Verifica sesión antes de intentar subir
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.warn('⚠️ Sin sesión activa, skip subirPendientes')
    return
  }

  const pendientes = await query(`SELECT * FROM sync_queue ORDER BY created_at ASC`)
  // ... resto igual
  const ordenados = [...pendientes].sort((a, b) => {
    const ia = ORDEN_SYNC.indexOf(a.tabla)
    const ib = ORDEN_SYNC.indexOf(b.tabla)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  for (const item of ordenados) {
    // 🔧 Cada item se procesa en su propio try/catch: si la red se cae a
    // medio bucle, los items restantes se intentan en la siguiente
    // sincronización en vez de perderse porque uno solo rompió el for.
    try {
      const [itemFresco] = await query(`SELECT * FROM sync_queue WHERE id = ?`, [item.id])
      if (!itemFresco) continue

      // 🔧 FIX: antes esto siempre llamaba a subirAbogado() (que solo hace
      // upsert), sin importar si la operación en cola era 'upsert' o 'delete'.
      // Resultado: quitar un colaborador offline nunca se subía a Supabase —
      // el delete se quedaba atorado en sync_queue para siempre. Ahora se
      // bifurca según itemFresco.operacion.
      if (itemFresco.tabla === 'expediente_abogados') {
        if (itemFresco.operacion === 'delete') {
          await eliminarAbogadoSupabase(itemFresco)
        } else {
          await subirAbogado(itemFresco)
        }
        continue
      }

      const payload = JSON.parse(itemFresco.payload)
      const pk = PK[itemFresco.tabla] ?? 'id'

      if (itemFresco.operacion === 'upsert') {
        const idLocal = payload[pk]
        const esTemporal = TABLAS_CON_ID_AUTOGENERADO.includes(itemFresco.tabla)
          && typeof idLocal === 'number' && idLocal < 0

        if (esTemporal) {
          const payloadSubir = { ...payload }
          delete payloadSubir[pk]

          const { data, error } = await conTimeout<any>(
            supabase.from(itemFresco.tabla).insert(payloadSubir).select(pk).single()
          )

          if (error || !data) continue

          const idReal = (data as any)[pk]
          await reconciliarId(itemFresco.tabla, idLocal, idReal)
        } else {
          const { error } = await conTimeout<any>(
            supabase.from(itemFresco.tabla).upsert(payload)
          )
          if (error) continue
        }
      } else if (itemFresco.operacion === 'delete') {
  const { error } = await conTimeout<any>(
    supabase.from(itemFresco.tabla).delete().eq(pk, payload[pk])
  )
  if (error) {
    console.error(`❌ Error eliminando ${itemFresco.tabla}:`, error, payload)
    continue
  }
}

      await run(`DELETE FROM sync_queue WHERE id = ?`, [itemFresco.id])
    } catch (e) {
      // Error de red (fetch rechazado o timeout) al subir este item puntual.
      // Lo dejamos en la cola para reintentar en la próxima sincronización.
      console.warn(`Fallo subiendo item de sync_queue (tabla=${item.tabla}, id=${item.id}):`, e)
    }
  }
}

async function subirAbogado(itemFresco: any) {
  const payload = JSON.parse(itemFresco.payload)
  const { id: _idLocal, ...payloadSubir } = payload

  const { error } = await conTimeout<any>(
    supabase
      .from('expediente_abogados')
      .upsert(payloadSubir, { onConflict: 'expediente_id,usuario_id' })
  )

  if (error) return
  await run(`DELETE FROM sync_queue WHERE id = ?`, [itemFresco.id])
}

// 🆕 Contraparte de subirAbogado() para operaciones 'delete'. El payload de
// un delete de colaborador viene como { expediente_id, usuario_id } — sin
// "id" — porque eliminarColaboradorLocal() en dbHelpers.ts identifica la
// fila por esa pareja, no por el id autoincrement local (que puede no
// coincidir con Supabase si la fila no había sincronizado aún).
async function eliminarAbogadoSupabase(itemFresco: any) {
  const payload = JSON.parse(itemFresco.payload)

  const { error } = await conTimeout<any>(
    supabase
      .from('expediente_abogados')
      .delete()
      .eq('expediente_id', payload.expediente_id)
      .eq('usuario_id', payload.usuario_id)
  )

  if (error) return
  await run(`DELETE FROM sync_queue WHERE id = ?`, [itemFresco.id])
}

async function reconciliarId(tablaOrigen: string, idTemporal: number, idReal: number) {
  const pkOrigen = PK[tablaOrigen] ?? 'id'
  const ahora = Date.now()

  await run(
    `UPDATE ${tablaOrigen} SET ${pkOrigen} = ?, sync_status='synced', updated_at=? WHERE ${pkOrigen} = ?`,
    [idReal, ahora, idTemporal]
  )

  for (const [tablaHija, columnas] of Object.entries(FKS_POR_TABLA)) {
    for (const col of columnas) {
      if (FK_ORIGEN[col] !== tablaOrigen) continue
      await run(`UPDATE ${tablaHija} SET ${col} = ? WHERE ${col} = ?`, [idReal, idTemporal])
    }
  }

  const pendientes = await query(`SELECT * FROM sync_queue`)
  for (const p of pendientes) {
    let payload: any
    try { payload = JSON.parse(p.payload) } catch { continue }

    let cambiado = false
    for (const [col, tablaDestino] of Object.entries(FK_ORIGEN)) {
      if (tablaDestino === tablaOrigen && payload[col] === idTemporal) {
        payload[col] = idReal
        cambiado = true
      }
    }
    if (p.tabla === tablaOrigen && payload[pkOrigen] === idTemporal) {
      payload[pkOrigen] = idReal
      cambiado = true
    }

    if (cambiado) {
      await run(`UPDATE sync_queue SET payload = ? WHERE id = ?`, [JSON.stringify(payload), p.id])
    }
  }
}

async function descargarFrescos() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.warn('⚠️ Sin sesión activa, skip descargarFrescos')
    return
  }

  const idsPorTabla: Record<string, number[]> = {}
  // ... resto igual

  for (const tabla of TABLAS) {
    try {
      // 🔧 Timeout de 6s por tabla — antes esto podía colgarse 15-30s+ por
      // tabla con señal mala, y con 12 tablas en secuencia eso explicaba
      // sincronizaciones de varios minutos. Ahora, tabla que no responde a
      // tiempo se salta y se reintenta en la próxima sincronización.
      const { data, error } = await conTimeout<any>(
        supabase.from(tabla).select('*')
      )
      if (error || !data) continue

      const colsPermitidas = COLUMNAS[tabla]
      const pk = PK[tabla]
      idsPorTabla[tabla] = []

      for (const row of data) {
        idsPorTabla[tabla].push(row[pk])

        const [enCola] = await query(
          `SELECT id FROM sync_queue WHERE tabla = ? AND json_extract(payload,'$.${pk}') = ?`,
          [tabla, row[pk]]
        )
        if (enCola) continue

        const entries = Object.entries(row).filter(([k]) => colsPermitidas.includes(k))
        const cols = entries.map(([k]) => k)
        const vals = entries.map(([, v]) => v ?? null)

        if (!cols.includes(pk)) continue

        const placeholders = cols.map(() => '?').join(',')
        const updates = cols
          .filter(c => c !== pk)
          .map(c => `${c} = excluded.${c}`)
          .join(',')

        await run(
          `INSERT INTO ${tabla} (${cols.join(',')}, sync_status, updated_at)
           VALUES (${placeholders}, 'synced', ?)
           ON CONFLICT(${pk}) DO UPDATE SET ${updates}, sync_status='synced', updated_at=?`,
          [...vals, Date.now(), Date.now()]
        )
      }

      // ✅ Borra localmente lo que Supabase ya no devuelve (RLS lo quitó)
      // pero solo si no tiene cambios pendientes de subir
      if (idsPorTabla[tabla].length > 0) {
        const placeholders = idsPorTabla[tabla].map(() => '?').join(',')
        await run(
          `DELETE FROM ${tabla}
           WHERE ${pk} NOT IN (${placeholders})
           AND (sync_status = 'synced' OR sync_status IS NULL)
           AND ${pk} NOT IN (
             SELECT json_extract(payload, '$.${pk}')
             FROM sync_queue WHERE tabla = ?
           )`,
          [...idsPorTabla[tabla], tabla]
        )
      }

    } catch (e) {
      // Error de red o timeout en esta tabla puntual — se salta y sigue con
      // la siguiente en vez de bloquear todo el ciclo de sincronización.
      console.warn(`Fallo descargando catálogo "${tabla}":`, e)
    }
  }

  try {
    await descargarAbogados()
  } catch (e) {
    console.warn('Fallo descargando expediente_abogados:', e)
  }
}

async function descargarAbogados() {
  const { data, error } = await conTimeout<any>(
    supabase.from('expediente_abogados').select('*')
  )
  if (error || !data) return

  // 🔧 IMPORTANTE: aquí solo se hace upsert de lo que Supabase todavía tiene.
  // No se borran localmente los colaboradores que ya no vienen en `data`
  // (por ejemplo, alguien que fue removido por otro usuario). Si más adelante
  // ves colaboradores "fantasma" que no se quitan solos entre dispositivos,
  // este es el lugar: habría que borrar de SQLite cualquier fila de
  // expediente_abogados cuyo (expediente_id, usuario_id) ya no esté en `data`
  // Y cuyo expediente sí siga siendo visible (para no chocar con filas que
  // RLS ya no te deja ver por otras razones).
  for (const row of data) {
    const [existente] = await query(
      `SELECT id FROM expediente_abogados WHERE expediente_id = ? AND usuario_id = ?`,
      [row.expediente_id, row.usuario_id]
    )
    if (existente) {
      await run(
        `UPDATE expediente_abogados SET es_responsable = ?, sync_status='synced', updated_at=? WHERE id = ?`,
        [row.es_responsable ? 1 : 0, Date.now(), existente.id]
      )
    } else {
      await run(
        `INSERT INTO expediente_abogados (expediente_id, usuario_id, es_responsable, sync_status, updated_at)
         VALUES (?, ?, ?, 'synced', ?)`,
        [row.expediente_id, row.usuario_id, row.es_responsable ? 1 : 0, Date.now()]
      )
    }
  }
}