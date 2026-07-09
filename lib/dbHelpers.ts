import { getDb, saveDb } from './localDb';

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

export async function run(sql: string, params: any[] = []) {
  const db = await getDb();
  db.run(sql, params);
  saveDb();
}

// ─────────────────────────────────────────────────────────────────────────
// 🔗 JOINs locales que replican la estructura anidada que devuelve Supabase
// ─────────────────────────────────────────────────────────────────────────

export async function queryExpedientesPenalesLocal(): Promise<any[]> {
  const db = await getDb();

  const expStmt = db.prepare(`
    SELECT 
      e.id, e.numero_expediente, e.estado, e.caracter_cliente,
      e.cliente_id, e.juez_id,
      c.nombre_completo AS cliente_nombre,
      j.nombre          AS juez_nombre
    FROM expedientes e
    LEFT JOIN clientes            c ON c.id = e.cliente_id
    LEFT JOIN jueces              j ON j.id = e.juez_id
    WHERE e.id IN (SELECT expediente_id FROM expedientes_penales)
    ORDER BY e.id DESC
  `)

  const exps: any[] = []
  while (expStmt.step()) exps.push(expStmt.getAsObject())
  expStmt.free()

  for (const exp of exps) {
    const penalStmt = db.prepare(`
      SELECT ep.*, mp.nombre_agencia
      FROM expedientes_penales ep
      LEFT JOIN ministerios_publicos mp ON mp.id = ep.ministerio_publico_id
      WHERE ep.expediente_id = ?
    `)
    penalStmt.bind([exp.id])
    const penales: any[] = []
    while (penalStmt.step()) {
      const row = penalStmt.getAsObject()
      penales.push({
        ...row,
        ministerios_publicos: { nombre_agencia: row.nombre_agencia ?? null }
      })
    }
    penalStmt.free()

    const tareasStmt = db.prepare(`
      SELECT * FROM tareas 
      WHERE expediente_id = ? AND (eliminada = 0 OR eliminada IS NULL)
    `)
    tareasStmt.bind([exp.id])
    const tareas: any[] = []
    while (tareasStmt.step()) {
      const t = tareasStmt.getAsObject()
      tareas.push({ ...t, completada: !!t.completada })
    }
    tareasStmt.free()

    exp.clientes             = { nombre_completo: exp.cliente_nombre ?? null }
    exp.jueces                = { nombre: exp.juez_nombre ?? null }
    exp.expedientes_penales  = penales
    exp.tareas                = tareas
    delete exp.cliente_nombre
    delete exp.juez_nombre
  }

  return exps
}

// Civil hace join con `juzgados`/`juzgado_id` (no con `jueces`/`juez_id`),
// que es lo que realmente usa Civil (ver page.tsx: select juzgados(nombre, ciudad)).
export async function queryExpedientesCivilesLocal(): Promise<any[]> {
  const db = await getDb();

  const expStmt = db.prepare(`
    SELECT 
      e.id, e.numero_expediente, e.estado, e.caracter_cliente,
      e.cliente_id, e.juzgado_id, e.contraparte, e.tipo_juicio, e.ciudad,
      c.nombre_completo AS cliente_nombre,
      j.nombre           AS juzgado_nombre,
      j.ciudad            AS juzgado_ciudad
    FROM expedientes e
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN juzgados j ON j.id = e.juzgado_id
    WHERE e.id IN (SELECT expediente_id FROM expedientes_civiles)
    ORDER BY e.id DESC
  `)

  const exps: any[] = []
  while (expStmt.step()) exps.push(expStmt.getAsObject())
  expStmt.free()

  for (const exp of exps) {
    const civilStmt = db.prepare(`SELECT * FROM expedientes_civiles WHERE expediente_id = ?`)
    civilStmt.bind([exp.id])
    const civiles: any[] = []
    while (civilStmt.step()) civiles.push(civilStmt.getAsObject())
    civilStmt.free()

    const tareasStmt = db.prepare(`
      SELECT * FROM tareas 
      WHERE expediente_id = ? AND (eliminada = 0 OR eliminada IS NULL)
    `)
    tareasStmt.bind([exp.id])
    const tareas: any[] = []
    while (tareasStmt.step()) {
      const t = tareasStmt.getAsObject()
      tareas.push({ ...t, completada: !!t.completada })
    }
    tareasStmt.free()

    exp.clientes            = { nombre_completo: exp.cliente_nombre ?? null }
    exp.juzgados             = { nombre: exp.juzgado_nombre ?? null, ciudad: exp.juzgado_ciudad ?? null }
    exp.expedientes_civiles = civiles
    exp.tareas               = tareas
    delete exp.cliente_nombre
    delete exp.juzgado_nombre
    delete exp.juzgado_ciudad
  }

  return exps
}

// ✅ CORREGIDO: ahora hace join con `juzgados`/`juzgado_id` (no con `jueces`/`juez_id`),
// para quedar consistente con el patrón real que usa Amparo en page.tsx/cliente.tsx
// y con el schema de Supabase (expedientes.juzgado_id).
export async function queryExpedientesAmparoLocal(): Promise<any[]> {
  const db = await getDb();

  const expStmt = db.prepare(`
    SELECT 
      e.id, e.numero_expediente, e.estado, e.caracter_cliente,
      e.cliente_id, e.juzgado_id, e.contraparte,
      c.nombre_completo AS cliente_nombre,
      j.nombre           AS juzgado_nombre,
      j.ciudad            AS juzgado_ciudad
    FROM expedientes e
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN juzgados j ON j.id = e.juzgado_id
    WHERE e.id IN (SELECT expediente_id FROM expedientes_amparo)
    ORDER BY e.id DESC
  `)

  const exps: any[] = []
  while (expStmt.step()) exps.push(expStmt.getAsObject())
  expStmt.free()

  for (const exp of exps) {
    const amparoStmt = db.prepare(`SELECT * FROM expedientes_amparo WHERE expediente_id = ?`)
    amparoStmt.bind([exp.id])
    const amparos: any[] = []
    while (amparoStmt.step()) amparos.push(amparoStmt.getAsObject())
    amparoStmt.free()

    const tareasStmt = db.prepare(`
      SELECT * FROM tareas 
      WHERE expediente_id = ? AND (eliminada = 0 OR eliminada IS NULL)
    `)
    tareasStmt.bind([exp.id])
    const tareas: any[] = []
    while (tareasStmt.step()) {
      const t = tareasStmt.getAsObject()
      tareas.push({ ...t, completada: !!t.completada })
    }
    tareasStmt.free()

    exp.clientes            = { nombre_completo: exp.cliente_nombre ?? null }
    exp.juzgados             = { nombre: exp.juzgado_nombre ?? null, ciudad: exp.juzgado_ciudad ?? null }
    exp.expedientes_amparo  = amparos
    exp.tareas                = tareas
    delete exp.cliente_nombre
    delete exp.juzgado_nombre
    delete exp.juzgado_ciudad
  }

  return exps
}

// ─────────────────────────────────────────────────────────────────────────
// 📋 Catálogo de expedientes para el selector "Vincular a expediente" del
// módulo de Tareas. Replica el shape que devuelve Supabase en
// app/tareas/page.tsx: select('id, numero_expediente, materias (nombre)').
// ─────────────────────────────────────────────────────────────────────────
export async function queryExpedientesCatalogoLocal(): Promise<any[]> {
  const db = await getDb();

  const stmt = db.prepare(`
    SELECT e.id, e.numero_expediente, m.nombre AS materia_nombre
    FROM expedientes e
    LEFT JOIN materias m ON m.id = e.materia_id
    ORDER BY e.numero_expediente ASC
  `)

  const rows: any[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()

  return rows.map(r => ({
    id: r.id,
    numero_expediente: r.numero_expediente,
    materias: r.materia_nombre ? { nombre: r.materia_nombre } : null,
  }))
}

// Abogados activos — catálogo para el selector "Asignar a abogado" de Tareas
// (mismo filtro que usa Supabase: rol = 'Abogado' AND activo = true).
export async function queryAbogadosLocal(): Promise<any[]> {
  return query<any>(
    `SELECT id, nombre_completo FROM usuarios WHERE rol = 'Abogado' AND activo = 1 ORDER BY nombre_completo ASC`
  )
}

// Catálogos completos para selects de formularios (offline-ready)
export async function queryCatalogosLocal() {
  const [clientes, jueces, ministerios, juzgados, materias] = await Promise.all([
    query<any>(`SELECT * FROM clientes ORDER BY nombre_completo ASC`),
    query<any>(`SELECT * FROM jueces ORDER BY nombre ASC`),
    query<any>(`SELECT * FROM ministerios_publicos ORDER BY nombre_agencia ASC`),
    query<any>(`SELECT * FROM juzgados ORDER BY nombre ASC`),
    query<any>(`SELECT * FROM materias ORDER BY nombre ASC`),
  ])
  return { clientes, jueces, ministerios, juzgados, materias }
}

// JOIN local para tareas
export async function queryTareasLocal(): Promise<any[]> {
  const db = await getDb();

  const stmt = db.prepare(`
    SELECT
      t.id, t.expediente_id, t.asignado_a_usuario_id,
      t.descripcion, t.fecha_vencimiento, t.completada, t.estado_kanban,
      e.numero_expediente,
      u.nombre_completo AS usuario_nombre
    FROM tareas t
    LEFT JOIN expedientes e ON e.id = t.expediente_id
    LEFT JOIN usuarios    u ON u.id = t.asignado_a_usuario_id
    WHERE (t.eliminada = 0 OR t.eliminada IS NULL)
    ORDER BY t.fecha_vencimiento ASC
  `)

  const rows: any[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()

  return rows.map(r => ({
    ...r,
    completada: !!r.completada,
    expedientes: { numero_expediente: r.numero_expediente ?? null },
    usuarios:    { nombre_completo: r.usuario_nombre ?? null },
  }))
}

// JOIN local para eventos
export async function queryEventosLocal(): Promise<any[]> {
  const db = await getDb();

  const stmt = db.prepare(`
    SELECT
      ev.id, ev.expediente_id, ev.usuario_id,
      ev.titulo, ev.tipo_evento, ev.fecha_hora, ev.descripcion,
      e.numero_expediente,
      u.nombre_completo AS usuario_nombre
    FROM eventos ev
    LEFT JOIN expedientes e ON e.id = ev.expediente_id
    LEFT JOIN usuarios    u ON u.id = ev.usuario_id
    ORDER BY ev.fecha_hora ASC
  `)

  const rows: any[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()

  return rows.map(r => ({
    ...r,
    expedientes: { numero_expediente: r.numero_expediente ?? null },
    usuarios:    { nombre_completo: r.usuario_nombre ?? null },
  }))
}

// ─────────────────────────────────────────────────────────────────────────
// 🆔 IDs temporales para creación offline (negativos para no chocar con Postgres)
// ─────────────────────────────────────────────────────────────────────────
let contadorTemp = 0
export function generarIdTemporal(): number {
  contadorTemp += 1
  return -(Date.now() * 1000 + contadorTemp)
}

// Busca el id numérico (tabla usuarios) del usuario actual por email,
// ya que la sesión local (authLocal) no guarda el id de Postgres.
export async function obtenerUsuarioLocalPorEmail(email: string): Promise<{ id: number } | null> {
  const [row] = await query<{ id: number }>(
    `SELECT id FROM usuarios WHERE email = ?`,
    [email]
  )
  return row ?? null
}

// ─────────────────────────────────────────────────────────────────────────
// 👤 Datos de "Mi Perfil": expedientes asignados (cualquier materia, vía
// expediente_abogados), conteo de tareas activas, conteo de eventos y
// actividad reciente — todo resuelto contra SQLite local.
// ─────────────────────────────────────────────────────────────────────────
export async function queryPerfilLocal(usuarioId: number) {
  const db = await getDb();

  const expStmt = db.prepare(`
    SELECT
      e.id, e.numero_expediente, e.estado, e.contraparte,
      c.nombre_completo AS quejoso,
      m.nombre           AS materia_nombre
    FROM expediente_abogados ea
    JOIN expedientes e   ON e.id = ea.expediente_id
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN materias m ON m.id = e.materia_id
    WHERE ea.usuario_id = ?
    ORDER BY e.id DESC
  `)
  expStmt.bind([usuarioId])
  const expedientes: any[] = []
  while (expStmt.step()) {
    const row = expStmt.getAsObject()
    expedientes.push({
      id: row.id,
      numero_expediente: row.numero_expediente,
      estado_tramite: row.estado,
      quejoso: row.quejoso ?? null,
      tipo_amparo: row.materia_nombre ?? null,
    })
  }
  expStmt.free()

  const [tareasRow] = await query<{ n: number }>(
    `SELECT COUNT(*) as n FROM tareas
     WHERE asignado_a_usuario_id = ?
       AND (eliminada = 0 OR eliminada IS NULL)
       AND (estado_kanban IS NULL OR estado_kanban != 'Completada')`,
    [usuarioId]
  )

  const [eventosRow] = await query<{ n: number }>(
    `SELECT COUNT(*) as n FROM eventos_calendario WHERE usuario_id = ?`,
    [usuarioId]
  )

  const actividad = await query<any>(
    `SELECT * FROM actividad_reciente WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 3`,
    [usuarioId]
  )

  return {
    expedientes,
    conteoTareas: tareasRow?.n ?? 0,
    conteoEventos: eventosRow?.n ?? 0,
    actividad,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ✍️ Creación offline de una causa penal completa:
// clientes → expedientes → expedientes_penales → expediente_abogados
// ⚠️ PENDIENTE: materia_id queda en null (materias no está replicada en SQLite local).
// ─────────────────────────────────────────────────────────────────────────
type DatosCausaPenal = {
  cliente_nombre: string
  numero_causa: string
  numero_carpeta: string | null
  delito: string
  etapa_procesal: string
  fecha_inicio: string
  estado: string
  rol_cliente: string
  rol_abogado: string
  contraparte: string | null
  juez_id: number | null
  mp_id: number | null
  abogado_id: number | null
  descripcion: string | null
}

export async function crearCausaPenalLocal(
  datos: DatosCausaPenal,
  creadoPorId: number | null
): Promise<{ expedienteId: number }> {
  const ahora = Date.now()

  const idClienteTemp = generarIdTemporal()
  const cliente = {
    id: idClienteTemp,
    nombre_completo: datos.cliente_nombre,
    telefono: null,
    email: null,
    created_at: new Date().toISOString(),
  }
  await run(
    `INSERT INTO clientes (id, nombre_completo, telefono, email, created_at, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [cliente.id, cliente.nombre_completo, cliente.telefono, cliente.email, cliente.created_at, ahora]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['clientes', JSON.stringify(cliente), ahora]
  )

  const idExpedienteTemp = generarIdTemporal()
  const expediente = {
    id: idExpedienteTemp,
    materia_id: null,
    cliente_id: idClienteTemp,
    juzgado_id: null,
    juez_id: datos.juez_id,
    numero_expediente: datos.numero_causa,
    tipo_juicio: null,
    caracter_cliente: datos.rol_cliente,
    contraparte: datos.contraparte,
    ciudad: null,
    creado_por: creadoPorId,
    estado: datos.estado,
    created_at: new Date().toISOString(),
    fecha_inicio: datos.fecha_inicio || null,
    descripcion: datos.descripcion,
    ultima_actuacion: null,
  }
  await run(
    `INSERT INTO expedientes (
      id, materia_id, cliente_id, juzgado_id, juez_id, numero_expediente,
      tipo_juicio, caracter_cliente, contraparte, ciudad, creado_por,
      estado, created_at, fecha_inicio, descripcion, ultima_actuacion,
      sync_status, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)`,
    [
      expediente.id, expediente.materia_id, expediente.cliente_id, expediente.juzgado_id,
      expediente.juez_id, expediente.numero_expediente, expediente.tipo_juicio,
      expediente.caracter_cliente, expediente.contraparte, expediente.ciudad,
      expediente.creado_por, expediente.estado, expediente.created_at,
      expediente.fecha_inicio, expediente.descripcion, expediente.ultima_actuacion,
      ahora,
    ]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes', JSON.stringify(expediente), ahora]
  )

  const penal = {
    expediente_id: idExpedienteTemp,
    ministerio_publico_id: datos.mp_id,
    numero_causa_penal: datos.numero_causa,
    numero_carpeta_investigacion: datos.numero_carpeta,
    delito: datos.delito,
    estadio_procesal: datos.etapa_procesal,
    rol_abogado: datos.rol_abogado,
    imputado: null,
    victima_ofendido: null,
    proxima_actuacion: null,
    fecha_audiencia: null,
    tipo_audiencia: null,
    nombre_agente_mp: null,
  }
  await run(
    `INSERT INTO expedientes_penales (
      expediente_id, ministerio_publico_id, numero_causa_penal, numero_carpeta_investigacion,
      delito, estadio_procesal, rol_abogado, imputado, victima_ofendido,
      proxima_actuacion, fecha_audiencia, tipo_audiencia, nombre_agente_mp,
      sync_status, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)`,
    [
      penal.expediente_id, penal.ministerio_publico_id, penal.numero_causa_penal,
      penal.numero_carpeta_investigacion, penal.delito, penal.estadio_procesal,
      penal.rol_abogado, penal.imputado, penal.victima_ofendido, penal.proxima_actuacion,
      penal.fecha_audiencia, penal.tipo_audiencia, penal.nombre_agente_mp, ahora,
    ]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes_penales', JSON.stringify(penal), ahora]
  )

  const abogadoId = datos.abogado_id ?? creadoPorId
  if (abogadoId) {
    const abogado = {
      expediente_id: idExpedienteTemp,
      usuario_id: abogadoId,
      es_responsable: 1,
    }
    await run(
      `INSERT INTO expediente_abogados (expediente_id, usuario_id, es_responsable, sync_status, updated_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      [abogado.expediente_id, abogado.usuario_id, abogado.es_responsable, ahora]
    )
    await run(
      `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
      ['expediente_abogados', JSON.stringify(abogado), ahora]
    )
  }

  return { expedienteId: idExpedienteTemp }
}

// ─────────────────────────────────────────────────────────────────────────
// ✍️ Creación offline de un expediente Civil/Familiar completo:
// clientes → expedientes → expedientes_civiles → expediente_abogados → tareas (si hay término)
// ─────────────────────────────────────────────────────────────────────────
type DatosExpedienteCivil = {
  cliente_nombre: string
  numero_expediente: string
  fecha_inicio: string
  estado: string
  ciudad: string
  rol_cliente: string
  contraparte: string | null
  materia_juicio_tipo: string // Ej: "Familiar|Divorcio voluntario"
  juzgado_id: number | null
  plazo_otorgado: string | null
  fecha_limite_termino: string | null
  abogado_id: number | null
  descripcion: string | null
}

export async function crearExpedienteCivilLocal(
  datos: DatosExpedienteCivil,
  creadoPorId: number | null
): Promise<{ expedienteId: number }> {
  const ahora = Date.now()

  let tipoJuicio = ''
  let materiaId: number | null = null
  if (datos.materia_juicio_tipo && datos.materia_juicio_tipo.includes('|')) {
    const partes = datos.materia_juicio_tipo.split('|')
    const materiaNombre = partes[0]
    tipoJuicio = partes[1] || ''

    const MAPA_MATERIAS: Record<string, number> = {
      'Civil': 1,
      'Familiar': 2
    }
    materiaId = MAPA_MATERIAS[materiaNombre] ?? null
  }

  const idClienteTemp = generarIdTemporal()
  const cliente = {
    id: idClienteTemp,
    nombre_completo: datos.cliente_nombre,
    telefono: null,
    email: null,
    created_at: new Date().toISOString(),
  }
  await run(
    `INSERT INTO clientes (id, nombre_completo, telefono, email, created_at, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [cliente.id, cliente.nombre_completo, cliente.telefono, cliente.email, cliente.created_at, ahora]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['clientes', JSON.stringify(cliente), ahora]
  )

  const idExpedienteTemp = generarIdTemporal()
  const expediente = {
    id: idExpedienteTemp,
    materia_id: materiaId,
    cliente_id: idClienteTemp,
    juzgado_id: datos.juzgado_id,
    juez_id: null,
    numero_expediente: datos.numero_expediente,
    tipo_juicio: tipoJuicio || null,
    caracter_cliente: datos.rol_cliente,
    contraparte: datos.contraparte,
    ciudad: datos.ciudad,
    creado_por: creadoPorId,
    estado: datos.estado,
    created_at: new Date().toISOString(),
    fecha_inicio: datos.fecha_inicio || null,
    descripcion: datos.descripcion,
    ultima_actuacion: null,
  }
  await run(
    `INSERT INTO expedientes (
      id, materia_id, cliente_id, juzgado_id, juez_id, numero_expediente,
      tipo_juicio, caracter_cliente, contraparte, ciudad, creado_por,
      estado, created_at, fecha_inicio, descripcion, ultima_actuacion,
      sync_status, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)`,
    [
      expediente.id, expediente.materia_id, expediente.cliente_id, expediente.juzgado_id,
      expediente.juez_id, expediente.numero_expediente, expediente.tipo_juicio,
      expediente.caracter_cliente, expediente.contraparte, expediente.ciudad,
      expediente.creado_por, expediente.estado, expediente.created_at,
      expediente.fecha_inicio, expediente.descripcion, expediente.ultima_actuacion,
      ahora,
    ]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes', JSON.stringify(expediente), ahora]
  )

  const civil = {
    expediente_id: idExpedienteTemp,
    estadio_procesal: null,
  }
  await run(
    `INSERT INTO expedientes_civiles (expediente_id, estadio_procesal, sync_status, updated_at)
     VALUES (?, ?, 'pending', ?)`,
    [civil.expediente_id, civil.estadio_procesal, ahora]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes_civiles', JSON.stringify(civil), ahora]
  )

  const abogadoId = datos.abogado_id ?? creadoPorId
  if (abogadoId) {
    const abogado = {
      expediente_id: idExpedienteTemp,
      usuario_id: abogadoId,
      es_responsable: 1,
    }
    await run(
      `INSERT INTO expediente_abogados (expediente_id, usuario_id, es_responsable, sync_status, updated_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      [abogado.expediente_id, abogado.usuario_id, abogado.es_responsable, ahora]
    )
    await run(
      `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
      ['expediente_abogados', JSON.stringify(abogado), ahora]
    )
  }

  if (datos.fecha_limite_termino) {
    const idTareaTemp = generarIdTemporal()
    const tarea = {
      id: idTareaTemp,
      expediente_id: idExpedienteTemp,
      asignado_a_usuario_id: abogadoId ?? null,
      descripcion: `Vencimiento de término: ${datos.plazo_otorgado ?? ''}`,
      fecha_vencimiento: datos.fecha_limite_termino,
      completada: 0,
      eliminada: 0,
    }
    await run(
      `INSERT INTO tareas (
        id, expediente_id, asignado_a_usuario_id, descripcion,
        fecha_vencimiento, completada, eliminada, sync_status, updated_at
      ) VALUES (?,?,?,?,?,?,?, 'pending', ?)`,
      [
        tarea.id, tarea.expediente_id, tarea.asignado_a_usuario_id, tarea.descripcion,
        tarea.fecha_vencimiento, tarea.completada, tarea.eliminada, ahora,
      ]
    )
    await run(
      `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
      ['tareas', JSON.stringify(tarea), ahora]
    )
  }

  return { expedienteId: idExpedienteTemp }
}

// ─────────────────────────────────────────────────────────────────────────
// ✍️ Creación offline de un expediente Amparo completo:
// clientes → expedientes → expedientes_amparo → expediente_abogados (opcional)
//
// 🐛 Reemplaza el flujo anterior en cliente.tsx (ClienteAmparos.manejarSubmit),
// que llamaba dos veces al mismo guardar() de useExpedientes('expedientes_amparo')
// -- una con { id, numero_expediente, ... } pensado para "expedientes", pero
// como el hook estaba pegado a la tabla "expedientes_amparo" (que NO tiene
// columna "id", solo "expediente_id"), tronaba con:
// "table expedientes_amparo has no column named id".
// Esta función, igual que crearExpedienteCivilLocal(), escribe cada objeto
// en su tabla correcta: clientes(id) → expedientes(id) → expedientes_amparo(expediente_id).
//
// ✅ FIX (08/jul/2026): materia_id ya NO se guarda como null. Antes, el
// expediente quedaba con materia_id = NULL en Supabase, y como page.tsx de
// Amparo filtra con `.eq('materia_id', materiaAmparo.id)`, en SQL un NULL
// nunca es igual a nada (ni a otro NULL) — por eso el expediente se creaba
// bien, sincronizaba bien, pero JAMÁS aparecía en la lista una vez que la
// app recargaba en modo online. Se confirmó en Supabase que el id real de
// la materia "Amparo" es 4 (tabla materias).
// ─────────────────────────────────────────────────────────────────────────
const MATERIA_ID_AMPARO = 4

type DatosExpedienteAmparo = {
  cliente_nombre: string // Quejoso
  numero_expediente: string
  fecha_presentacion: string | null
  estado: string
  juzgado_id: number | null
  tipo_amparo: string // 'Directo' | 'Indirecto'
  autoridad_responsable: string | null
  acto_reclamado: string | null
  tercero_interesado: string | null
  estadio_procesal: string | null
  proxima_audiencia: string | null
  abogado_id: number | null
  descripcion: string | null
}

export async function crearExpedienteAmparoLocal(
  datos: DatosExpedienteAmparo,
  creadoPorId: number | null
): Promise<{ expedienteId: number }> {
  const ahora = Date.now()

  // 1. Cliente (Quejoso)
  const idClienteTemp = generarIdTemporal()
  const cliente = {
    id: idClienteTemp,
    nombre_completo: datos.cliente_nombre,
    telefono: null,
    email: null,
    created_at: new Date().toISOString(),
  }
  await run(
    `INSERT INTO clientes (id, nombre_completo, telefono, email, created_at, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [cliente.id, cliente.nombre_completo, cliente.telefono, cliente.email, cliente.created_at, ahora]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['clientes', JSON.stringify(cliente), ahora]
  )

  // 2. Expediente base
  const idExpedienteTemp = generarIdTemporal()
  const expediente = {
    id: idExpedienteTemp,
    materia_id: MATERIA_ID_AMPARO,
    cliente_id: idClienteTemp,
    juzgado_id: datos.juzgado_id,
    juez_id: null,
    numero_expediente: datos.numero_expediente,
    tipo_juicio: null,
    caracter_cliente: 'Quejoso',
    contraparte: null,
    ciudad: null,
    creado_por: creadoPorId,
    estado: datos.estado,
    created_at: new Date().toISOString(),
    fecha_inicio: datos.fecha_presentacion || null,
    descripcion: datos.descripcion,
    ultima_actuacion: null,
  }
  await run(
    `INSERT INTO expedientes (
      id, materia_id, cliente_id, juzgado_id, juez_id, numero_expediente,
      tipo_juicio, caracter_cliente, contraparte, ciudad, creado_por,
      estado, created_at, fecha_inicio, descripcion, ultima_actuacion,
      sync_status, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)`,
    [
      expediente.id, expediente.materia_id, expediente.cliente_id, expediente.juzgado_id,
      expediente.juez_id, expediente.numero_expediente, expediente.tipo_juicio,
      expediente.caracter_cliente, expediente.contraparte, expediente.ciudad,
      expediente.creado_por, expediente.estado, expediente.created_at,
      expediente.fecha_inicio, expediente.descripcion, expediente.ultima_actuacion,
      ahora,
    ]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes', JSON.stringify(expediente), ahora]
  )

  // 3. Fila en expedientes_amparo — SIEMPRE va con expediente_id, nunca "id"
  const amparo = {
    expediente_id: idExpedienteTemp,
    tipo_amparo: datos.tipo_amparo,
    autoridad_responsable: datos.autoridad_responsable,
    acto_reclamado: datos.acto_reclamado,
    tercero_interesado: datos.tercero_interesado,
    estadio_procesal: datos.estadio_procesal,
    proxima_audiencia: datos.proxima_audiencia,
  }
  await run(
    `INSERT INTO expedientes_amparo (
      expediente_id, tipo_amparo, autoridad_responsable, acto_reclamado,
      tercero_interesado, estadio_procesal, proxima_audiencia,
      sync_status, updated_at
    ) VALUES (?,?,?,?,?,?,?, 'pending', ?)`,
    [
      amparo.expediente_id, amparo.tipo_amparo, amparo.autoridad_responsable,
      amparo.acto_reclamado, amparo.tercero_interesado, amparo.estadio_procesal,
      amparo.proxima_audiencia, ahora,
    ]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes_amparo', JSON.stringify(amparo), ahora]
  )

  // 4. Abogado responsable (opcional — solo si se pasa abogado_id o creadoPorId)
  const abogadoId = datos.abogado_id ?? creadoPorId
  if (abogadoId) {
    const abogado = {
      expediente_id: idExpedienteTemp,
      usuario_id: abogadoId,
      es_responsable: 1,
    }
    await run(
      `INSERT INTO expediente_abogados (expediente_id, usuario_id, es_responsable, sync_status, updated_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      [abogado.expediente_id, abogado.usuario_id, abogado.es_responsable, ahora]
    )
    await run(
      `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
      ['expediente_abogados', JSON.stringify(abogado), ahora]
    )
  }

  return { expedienteId: idExpedienteTemp }
}
// ─────────────────────────────────────────────────────────────────────────
// 🆕 AGREGAR AL FINAL DE lib/dbHelpers.ts
// Lectura offline de UN expediente (detalle) + borrado local con cola de sync.
// Sigue el mismo patrón que queryExpedientesPenalesLocal/CivilesLocal/AmparoLocal
// (JOINs manuales que replican el shape anidado del select() de Supabase),
// pero para un solo id en vez de la lista completa.
// ─────────────────────────────────────────────────────────────────────────

// ── Amparo ──────────────────────────────────────────────────────────────
export async function queryDetalleAmparoLocal(id: number): Promise<any | null> {
  const db = await getDb();

  const expStmt = db.prepare(`
    SELECT
      e.id, e.numero_expediente, e.estado, e.fecha_inicio, e.descripcion,
      e.cliente_id, e.juzgado_id,
      c.nombre_completo AS cliente_nombre,
      j.nombre AS juzgado_nombre, j.ciudad AS juzgado_ciudad
    FROM expedientes e
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN juzgados j ON j.id = e.juzgado_id
    WHERE e.id = ?
  `);
  expStmt.bind([id]);
  let exp: any = null;
  if (expStmt.step()) exp = expStmt.getAsObject();
  expStmt.free();
  if (!exp) return null;

  const amparoStmt = db.prepare(`SELECT * FROM expedientes_amparo WHERE expediente_id = ?`);
  amparoStmt.bind([id]);
  let datosAmparo: any = null;
  if (amparoStmt.step()) datosAmparo = amparoStmt.getAsObject();
  amparoStmt.free();

  const tareasStmt = db.prepare(`
    SELECT * FROM tareas
    WHERE expediente_id = ? AND (eliminada = 0 OR eliminada IS NULL)
  `);
  tareasStmt.bind([id]);
  const tareas: any[] = [];
  while (tareasStmt.step()) {
    const t = tareasStmt.getAsObject();
    tareas.push({ ...t, completada: !!t.completada });
  }
  tareasStmt.free();

  return {
    id: exp.id,
    numero_expediente: exp.numero_expediente,
    estado: exp.estado,
    fecha_inicio: exp.fecha_inicio,
    descripcion: exp.descripcion,
    cliente: exp.cliente_nombre ?? null,
    juzgado: exp.juzgado_nombre ? { nombre: exp.juzgado_nombre, ciudad: exp.juzgado_ciudad } : null,
    tareas,
    datos: datosAmparo ? {
      tipo_amparo: datosAmparo.tipo_amparo,
      autoridad_responsable: datosAmparo.autoridad_responsable,
      acto_reclamado: datosAmparo.acto_reclamado,
      tercero_interesado: datosAmparo.tercero_interesado,
    } : null,
  };
}

// ── Civil / Familiar ────────────────────────────────────────────────────
export async function queryDetalleCivilLocal(id: number): Promise<any | null> {
  const db = await getDb();

  const expStmt = db.prepare(`
    SELECT
      e.id, e.numero_expediente, e.tipo_juicio, e.caracter_cliente, e.contraparte,
      e.ciudad, e.estado, e.fecha_inicio, e.descripcion,
      e.cliente_id, e.juzgado_id,
      c.nombre_completo AS cliente_nombre,
      j.nombre AS juzgado_nombre, j.ciudad AS juzgado_ciudad
    FROM expedientes e
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN juzgados j ON j.id = e.juzgado_id
    WHERE e.id = ?
  `);
  expStmt.bind([id]);
  let exp: any = null;
  if (expStmt.step()) exp = expStmt.getAsObject();
  expStmt.free();
  if (!exp) return null;

  const tareasStmt = db.prepare(`
    SELECT * FROM tareas
    WHERE expediente_id = ? AND (eliminada = 0 OR eliminada IS NULL)
  `);
  tareasStmt.bind([id]);
  const tareas: any[] = [];
  while (tareasStmt.step()) {
    const t = tareasStmt.getAsObject();
    tareas.push({ ...t, completada: !!t.completada });
  }
  tareasStmt.free();

  return {
    id: exp.id,
    numero_expediente: exp.numero_expediente,
    tipo_juicio: exp.tipo_juicio,
    caracter_cliente: exp.caracter_cliente,
    contraparte: exp.contraparte,
    ciudad: exp.ciudad,
    estado: exp.estado,
    fecha_inicio: exp.fecha_inicio,
    descripcion: exp.descripcion,
    cliente: exp.cliente_nombre ?? null,
    juzgado: exp.juzgado_nombre ? { nombre: exp.juzgado_nombre, ciudad: exp.juzgado_ciudad } : null,
    tareas,
  };
}

// ── Penal ────────────────────────────────────────────────────────────────
export async function queryDetallePenalLocal(id: number): Promise<any | null> {
  const db = await getDb();

  const expStmt = db.prepare(`
    SELECT
      e.id, e.numero_expediente, e.caracter_cliente, e.contraparte,
      e.estado, e.fecha_inicio, e.descripcion,
      e.cliente_id, e.juez_id,
      c.nombre_completo AS cliente_nombre,
      j.nombre AS juez_nombre, j.juzgado_id AS juez_juzgado_id
    FROM expedientes e
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN jueces j ON j.id = e.juez_id
    WHERE e.id = ?
  `);
  expStmt.bind([id]);
  let exp: any = null;
  if (expStmt.step()) exp = expStmt.getAsObject();
  expStmt.free();
  if (!exp) return null;

  // Juzgado del juez asignado (mismo criterio que usa el select anidado de Supabase: jueces → juzgados)
  let juzgado: any = null;
  if (exp.juez_juzgado_id) {
    const jzStmt = db.prepare(`SELECT nombre, ciudad FROM juzgados WHERE id = ?`);
    jzStmt.bind([exp.juez_juzgado_id]);
    if (jzStmt.step()) juzgado = jzStmt.getAsObject();
    jzStmt.free();
  }

  const penalStmt = db.prepare(`
    SELECT ep.*, mp.nombre_agencia
    FROM expedientes_penales ep
    LEFT JOIN ministerios_publicos mp ON mp.id = ep.ministerio_publico_id
    WHERE ep.expediente_id = ?
  `);
  penalStmt.bind([id]);
  let penal: any = null;
  if (penalStmt.step()) penal = penalStmt.getAsObject();
  penalStmt.free();

  const tareasStmt = db.prepare(`
    SELECT * FROM tareas
    WHERE expediente_id = ? AND (eliminada = 0 OR eliminada IS NULL)
  `);
  tareasStmt.bind([id]);
  const tareas: any[] = [];
  while (tareasStmt.step()) {
    const t = tareasStmt.getAsObject();
    tareas.push({ ...t, completada: !!t.completada });
  }
  tareasStmt.free();

  return {
    id: exp.id,
    numero_expediente: exp.numero_expediente,
    caracter_cliente: exp.caracter_cliente,
    contraparte: exp.contraparte,
    estado: exp.estado,
    fecha_inicio: exp.fecha_inicio,
    descripcion: exp.descripcion,
    cliente: exp.cliente_nombre ?? null,
    juez: exp.juez_nombre ?? null,
    juzgado,
    tareas,
    penal: penal ? {
      numero_carpeta_investigacion: penal.numero_carpeta_investigacion,
      delito: penal.delito,
      estadio_procesal: penal.estadio_procesal,
      rol_abogado: penal.rol_abogado,
      mp: penal.nombre_agencia ?? null,
    } : null,
  };
}

// ── Borrado de un expediente + hijos, en cache local ───────────────────
// Postgres hace ON DELETE CASCADE en el servidor; sql.js no tiene ese cascade
// activado, así que hay que replicarlo a mano aquí.
async function limpiarExpedienteDeCacheLocal(id: number) {
  await run(`DELETE FROM expedientes_penales WHERE expediente_id = ?`, [id]);
  await run(`DELETE FROM expedientes_civiles WHERE expediente_id = ?`, [id]);
  await run(`DELETE FROM expedientes_amparo WHERE expediente_id = ?`, [id]);
  await run(`DELETE FROM tareas WHERE expediente_id = ?`, [id]);
  await run(`DELETE FROM expedientes WHERE id = ?`, [id]);
}

// Se borró OFFLINE: limpia el cache y encola el delete para cuando vuelva la red.
export async function eliminarExpedienteLocal(id: number) {
  await limpiarExpedienteDeCacheLocal(id);
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at)
     VALUES (?, 'delete', ?, ?)`,
    ['expedientes', JSON.stringify({ id }), Date.now()]
  );
}

// Se borró ONLINE (ya se hizo el delete en Supabase): solo limpia el cache local,
// sin encolar nada, para que el expediente no "reaparezca" si se pierde la
// conexión antes del próximo syncConSupabase().
export async function limpiarExpedienteCacheTrasBorrarOnline(id: number) {
  await limpiarExpedienteDeCacheLocal(id);
}