import { query, run } from './dbHelpers';
import { createClient } from './supabase/client';

const supabase = createClient();

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
  // 🆕 Para "Mi Perfil" — catálogos de solo lectura, nunca se crean offline
  eventos_calendario: [
    'id', 'expediente_id', 'usuario_id', 'titulo', 'tipo_evento', 'fecha_hora', 'descripcion',
  ],
  actividad_reciente: [
    'id', 'usuario_id', 'descripcion', 'created_at',
  ],
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
  eventos:              'id',
  usuarios:             'id',
  eventos_calendario:   'id', // 🆕
  actividad_reciente:   'id', // 🆕
}

// Tablas cuyo PK es autogenerado por Postgres y puede llegar con un ID
// temporal negativo (creado offline) que hay que reconciliar tras el insert real.
// 'tareas' se agrega porque ahora Civil crea tareas offline (término legal),
// igual que clientes/expedientes su id es SERIAL en Postgres.
// juzgados, materias, eventos_calendario y actividad_reciente NO entran aquí:
// son catálogos de solo lectura, nunca se crean offline.
const TABLAS_CON_ID_AUTOGENERADO = ['clientes', 'expedientes', 'tareas', 'eventos']

// Mapa: columna FK → tabla a la que apunta
const FK_ORIGEN: Record<string, string> = {
  cliente_id: 'clientes',
  expediente_id: 'expedientes',
}

// Mapa: tabla → columnas FK que podrían necesitar reescritura tras reconciliar
const FKS_POR_TABLA: Record<string, string[]> = {
  expedientes:          ['cliente_id'],
  expedientes_penales:  ['expediente_id'],
  expedientes_civiles:  ['expediente_id'],
  expedientes_amparo:   ['expediente_id'],
  expediente_abogados:  ['expediente_id'],
  tareas:               ['expediente_id'],
  eventos:              ['expediente_id'],
}

// Orden de subida: padres antes que hijos.
// 🆕 'eventos_calendario' y 'actividad_reciente' entran al final, junto a
// los demás catálogos de lectura para "Mi Perfil".
const ORDEN_SYNC = [
  'clientes', 'jueces', 'juzgados', 'materias', 'ministerios_publicos', 'usuarios',
  'expedientes',
  'expedientes_penales', 'expedientes_civiles', 'expedientes_amparo',
  'expediente_abogados', 'tareas', 'eventos',
  'eventos_calendario', 'actividad_reciente',
]

const TABLAS = Object.keys(COLUMNAS)

export async function syncConSupabase() {
  if (!navigator.onLine) return
  await subirPendientes()
  await descargarFrescos()
}

async function subirPendientes() {
  const pendientes = await query(`SELECT * FROM sync_queue ORDER BY created_at ASC`)

  const ordenados = [...pendientes].sort((a, b) => {
    const ia = ORDEN_SYNC.indexOf(a.tabla)
    const ib = ORDEN_SYNC.indexOf(b.tabla)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  for (const item of ordenados) {
    const [itemFresco] = await query(`SELECT * FROM sync_queue WHERE id = ?`, [item.id])
    if (!itemFresco) continue

    if (itemFresco.tabla === 'expediente_abogados') {
      await subirAbogado(itemFresco)
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

        const { data, error } = await supabase
          .from(itemFresco.tabla)
          .insert(payloadSubir)
          .select(pk)
          .single()

        if (error || !data) continue

        const idReal = (data as any)[pk]
        await reconciliarId(itemFresco.tabla, idLocal, idReal)
      } else {
        const { error } = await supabase.from(itemFresco.tabla).upsert(payload)
        if (error) continue
      }
    } else if (itemFresco.operacion === 'delete') {
      const { error } = await supabase.from(itemFresco.tabla).delete().eq(pk, payload[pk])
      if (error) continue
    }

    await run(`DELETE FROM sync_queue WHERE id = ?`, [itemFresco.id])
  }
}

async function subirAbogado(itemFresco: any) {
  const payload = JSON.parse(itemFresco.payload)
  const { id: _idLocal, ...payloadSubir } = payload

  const { error } = await supabase
    .from('expediente_abogados')
    .upsert(payloadSubir, { onConflict: 'expediente_id,usuario_id' })

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
  for (const tabla of TABLAS) {
    const { data, error } = await supabase.from(tabla).select('*')
    if (error || !data) continue

    const colsPermitidas = COLUMNAS[tabla]
    const pk = PK[tabla]

    for (const row of data) {
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
  }

  await descargarAbogados()
}

async function descargarAbogados() {
  const { data, error } = await supabase.from('expediente_abogados').select('*')
  if (error || !data) return

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