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
export async function queryEventosLocal(usuarioId?: number): Promise<any[]> {
  const db = await getDb()
  const stmt = db.prepare(`
    SELECT
      ev.id, ev.expediente_id, ev.usuario_id,
      ev.titulo, ev.tipo_evento, ev.fecha_hora, ev.descripcion,
      e.numero_expediente,
      u.nombre_completo AS usuario_nombre
    FROM eventos ev
    LEFT JOIN expedientes e ON e.id = ev.expediente_id
    LEFT JOIN usuarios    u ON u.id = ev.usuario_id
    ${usuarioId ? 'WHERE ev.usuario_id = ?' : ''}
    ORDER BY ev.fecha_hora ASC
  `)
  if (usuarioId) stmt.bind([usuarioId])
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
  // ⚠️ Debe caber en el rango de `integer` (int4) de Postgres:
  // -2,147,483,648 a 2,147,483,647. Antes usábamos Date.now() * 1000,
  // lo que generaba números de 16 dígitos y provocaba el error
  // "value -numeros is out of range for type integer" al editar o
  // sincronizar una tarea/expediente/cliente creado offline.
  const base = Date.now() % 2_000_000_000 // dentro del rango, ciclo ~23 días
  return -(base + contadorTemp)
}

// Busca los datos del usuario actual (tabla usuarios) por email, ya que la
// sesión local (authLocal) no guarda el id de Postgres. Se trae también
// nombre_completo y rol porque varias pantallas (ej. asignación automática
// de abogado responsable al crear un expediente) necesitan mostrarlos sin
// tener que hacer una segunda consulta.
export type UsuarioLocal = {
  id: number
  nombre_completo: string
  rol: string
}

export async function obtenerUsuarioLocalPorEmail(email: string): Promise<UsuarioLocal | null> {
  const [row] = await query<UsuarioLocal>(
    `SELECT id, nombre_completo, rol FROM usuarios WHERE email = ?`,
    [email]
  )
  return row ?? null
}

// ─────────────────────────────────────────────────────────────────────────
// 👤 Datos de "Mi Perfil": expedientes asignados (cualquier materia, vía
// expediente_abogados), conteo de tareas activas y conteo de eventos —
// todo resuelto contra SQLite local.
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
    `SELECT COUNT(*) as n FROM eventos WHERE usuario_id = ?`,
    [usuarioId]
  )

  return {
    expedientes,
    conteoTareas: tareasRow?.n ?? 0,
    conteoEventos: eventosRow?.n ?? 0,
    actividad: [], // ← para compatibilidad con el componente de perfil
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

    // ✅ CORREGIDO: antes usábamos un mapeo fijo (MAPA_MATERIAS = { Civil: 1,
    // Familiar: 2 }) que asumía coincidir con los ids reales de la tabla
    // `materias` en Supabase. Si esos ids cambiaran, el expediente se
    // guardaría con un materia_id equivocado (como ya pasó con el conteo
    // del dashboard, donde Familiar terminaba contado como Penal). Ahora
    // se resuelve dinámicamente desde la tabla local `materias`, igual
    // que ya hace crearExpedienteAmparoLocal.
    const [materia] = await query<{ id: number }>(
      `SELECT id FROM materias WHERE nombre = ?`,
      [materiaNombre]
    ).catch(() => [] as any[])
    materiaId = materia?.id ?? null
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
// ─────────────────────────────────────────────────────────────────────────

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

  // ⚠️ CORREGIDO: antes usábamos un id fijo (MATERIA_ID_AMPARO = 4) que
  // asumía coincidir con el id real de "Amparo" en la tabla `materias` de
  // Supabase. Si ese id real era distinto, el expediente se creaba y
  // sincronizaba bien, pero la consulta online (page.tsx) filtra por
  // materia_id = id real de "Amparo", así que el expediente jamás aparecía
  // aunque sí existía en la base. Ahora se resuelve dinámicamente desde
  // la tabla local `materias` (ya replicada vía initSchema/migrarSchema).
  const [materiaAmparo] = await query<{ id: number }>(
    `SELECT id FROM materias WHERE nombre = 'Amparo'`
  ).catch(() => [] as any[])
  const materiaId = materiaAmparo?.id ?? null

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
    materia_id: materiaId,
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

  // ✅ CORREGIDO: el juzgado ahora se resuelve directo desde e.juzgado_id
  // (igual que Civil y Amparo), NO a través de jueces.juzgado_id.
  // Antes, si la causa no tenía juez_id asignado todavía, el juzgado
  // offline salía vacío aunque expedientes.juzgado_id sí tuviera valor.
  const expStmt = db.prepare(`
    SELECT
      e.id, e.numero_expediente, e.caracter_cliente, e.contraparte,
      e.estado, e.fecha_inicio, e.descripcion,
      e.cliente_id, e.juez_id, e.juzgado_id,
      c.nombre_completo AS cliente_nombre,
      j.nombre AS juez_nombre,
      jz.nombre AS juzgado_nombre, jz.ciudad AS juzgado_ciudad
    FROM expedientes e
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN jueces j ON j.id = e.juez_id
    LEFT JOIN juzgados jz ON jz.id = e.juzgado_id
    WHERE e.id = ?
  `);
  expStmt.bind([id]);
  let exp: any = null;
  if (expStmt.step()) exp = expStmt.getAsObject();
  expStmt.free();
  if (!exp) return null;

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
    juzgado: exp.juzgado_nombre ? { nombre: exp.juzgado_nombre, ciudad: exp.juzgado_ciudad } : null,
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
async function limpiarExpedienteDeCacheLocal(id: number) {
  await run(`DELETE FROM expedientes_penales WHERE expediente_id = ?`, [id]);
  await run(`DELETE FROM expedientes_civiles WHERE expediente_id = ?`, [id]);
  await run(`DELETE FROM expedientes_amparo WHERE expediente_id = ?`, [id]);
  await run(`DELETE FROM tareas WHERE expediente_id = ?`, [id]);
  await run(`DELETE FROM expedientes WHERE id = ?`, [id]);
}

export async function eliminarExpedienteLocal(id: number) {
  await limpiarExpedienteDeCacheLocal(id);
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at)
     VALUES (?, 'delete', ?, ?)`,
    ['expedientes', JSON.stringify({ id }), Date.now()]
  );
}

export async function limpiarExpedienteCacheTrasBorrarOnline(id: number) {
  await limpiarExpedienteDeCacheLocal(id);
}

// ─────────────────────────────────────────────────────────────────────────
// 👥 Colaboradores de un expediente (expediente_abogados)
// Se identifican por (expediente_id, usuario_id), NUNCA por el "id" local
// autoincrement — porque ese id puede no existir todavía en Supabase si el
// registro no ha sincronizado, y porque expediente_id puede ser un ID
// temporal negativo (ver generarIdTemporal) que se reescribe después vía
// reconciliarId() en sync.ts, el cual ya sabe reescribir expediente_id en
// cualquier fila pendiente de expediente_abogados.
// ─────────────────────────────────────────────────────────────────────────

export async function queryColaboradoresLocal(expedienteId: number): Promise<any[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT ea.id, ea.usuario_id, ea.es_responsable, u.nombre_completo
    FROM expediente_abogados ea
    JOIN usuarios u ON u.id = ea.usuario_id
    WHERE ea.expediente_id = ?
    ORDER BY ea.es_responsable DESC, u.nombre_completo ASC
  `);
  stmt.bind([expedienteId]);
  const rows: any[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({ ...r, es_responsable: !!r.es_responsable });
  }
  stmt.free();
  return rows;
}

export async function agregarColaboradorLocal(
  expedienteId: number,
  usuarioId: number,
  esResponsable = false
) {
  const existentes = await query(
    `SELECT id FROM expediente_abogados WHERE expediente_id = ? AND usuario_id = ?`,
    [expedienteId, usuarioId]
  );
  if (existentes.length > 0) return; // ya es colaborador, no duplicar

  const ahora = Date.now();
  await run(
    `INSERT INTO expediente_abogados (expediente_id, usuario_id, es_responsable, sync_status, updated_at)
     VALUES (?, ?, ?, 'pending', ?)`,
    [expedienteId, usuarioId, esResponsable ? 1 : 0, ahora]
  );
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    [
      'expediente_abogados',
      JSON.stringify({ expediente_id: expedienteId, usuario_id: usuarioId, es_responsable: esResponsable }),
      ahora,
    ]
  );
}

export async function eliminarColaboradorLocal(expedienteId: number, usuarioId: number) {
  const ahora = Date.now();
  await run(
    `DELETE FROM expediente_abogados WHERE expediente_id = ? AND usuario_id = ?`,
    [expedienteId, usuarioId]
  );
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'delete', ?, ?)`,
    ['expediente_abogados', JSON.stringify({ expediente_id: expedienteId, usuario_id: usuarioId }), ahora]
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ✏️ Edición offline de expedientes (Civil / Amparo / Penal)
// Actualiza SQLite local y encola el cambio en sync_queue como 'upsert'.
// ─────────────────────────────────────────────────────────────────────────

type DatosExpedienteBaseEditado = {
  numero_expediente: string
  fecha_inicio: string | null
  descripcion: string | null
}

// ── Civil / Familiar ──
type DatosCivilEditado = DatosExpedienteBaseEditado & {
  tipo_juicio: string | null
  caracter_cliente: string | null
  contraparte: string | null
  ciudad: string | null
}

export async function actualizarExpedienteCivilLocal(
  expedienteId: number,
  datos: DatosCivilEditado
) {
  const ahora = Date.now()

  await run(
    `UPDATE expedientes SET
      numero_expediente = ?, tipo_juicio = ?, caracter_cliente = ?, contraparte = ?,
      ciudad = ?, fecha_inicio = ?, descripcion = ?,
      sync_status = 'pending', updated_at = ?
     WHERE id = ?`,
    [
      datos.numero_expediente, datos.tipo_juicio, datos.caracter_cliente, datos.contraparte,
      datos.ciudad, datos.fecha_inicio, datos.descripcion,
      ahora, expedienteId,
    ]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes', JSON.stringify({ id: expedienteId, ...datos }), ahora]
  )
}

// ── Amparo ──
type DatosAmparoEditado = {
  tipo_amparo: string | null
  tercero_interesado: string | null
  autoridad_responsable: string | null
  acto_reclamado: string | null
}

export async function actualizarExpedienteAmparoLocal(
  expedienteId: number,
  datosExpediente: DatosExpedienteBaseEditado,
  datosAmparo: DatosAmparoEditado
) {
  const ahora = Date.now()

  await run(
    `UPDATE expedientes SET
      numero_expediente = ?, fecha_inicio = ?, descripcion = ?,
      sync_status = 'pending', updated_at = ?
     WHERE id = ?`,
    [
      datosExpediente.numero_expediente, datosExpediente.fecha_inicio, datosExpediente.descripcion,
      ahora, expedienteId,
    ]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes', JSON.stringify({ id: expedienteId, ...datosExpediente }), ahora]
  )

  await run(
    `UPDATE expedientes_amparo SET
      tipo_amparo = ?, tercero_interesado = ?, autoridad_responsable = ?, acto_reclamado = ?,
      sync_status = 'pending', updated_at = ?
     WHERE expediente_id = ?`,
    [
      datosAmparo.tipo_amparo, datosAmparo.tercero_interesado,
      datosAmparo.autoridad_responsable, datosAmparo.acto_reclamado,
      ahora, expedienteId,
    ]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes_amparo', JSON.stringify({ expediente_id: expedienteId, ...datosAmparo }), ahora]
  )
}

// ── Penal ──
type DatosPenalBaseEditado = DatosExpedienteBaseEditado & {
  caracter_cliente: string | null
  contraparte: string | null
}

type DatosPenalEspecificoEditado = {
  numero_carpeta_investigacion: string | null
  delito: string | null
  estadio_procesal: string | null
  rol_abogado: string | null
}

export async function actualizarExpedientePenalLocal(
  expedienteId: number,
  datosExpediente: DatosPenalBaseEditado,
  datosPenal: DatosPenalEspecificoEditado
) {
  const ahora = Date.now()

  await run(
    `UPDATE expedientes SET
      numero_expediente = ?, caracter_cliente = ?, contraparte = ?,
      fecha_inicio = ?, descripcion = ?,
      sync_status = 'pending', updated_at = ?
     WHERE id = ?`,
    [
      datosExpediente.numero_expediente, datosExpediente.caracter_cliente, datosExpediente.contraparte,
      datosExpediente.fecha_inicio, datosExpediente.descripcion,
      ahora, expedienteId,
    ]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes', JSON.stringify({ id: expedienteId, ...datosExpediente }), ahora]
  )

  await run(
    `UPDATE expedientes_penales SET
      numero_carpeta_investigacion = ?, delito = ?, estadio_procesal = ?, rol_abogado = ?,
      sync_status = 'pending', updated_at = ?
     WHERE expediente_id = ?`,
    [
      datosPenal.numero_carpeta_investigacion, datosPenal.delito,
      datosPenal.estadio_procesal, datosPenal.rol_abogado,
      ahora, expedienteId,
    ]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['expedientes_penales', JSON.stringify({ expediente_id: expedienteId, ...datosPenal }), ahora]
  )
}

// ─────────────────────────────────────────────────────────────────────────
// ✅ Tareas offline: crear y marcar completada/pendiente
// ─────────────────────────────────────────────────────────────────────────

export async function crearTareaLocal(
  expedienteId: number,
  descripcion: string,
  fechaVencimiento: string | null,
  asignadoAUsuarioId: number | null = null
): Promise<{ tareaId: number }> {
  const ahora = Date.now()
  const idTareaTemp = generarIdTemporal()

  const tarea = {
    id: idTareaTemp,
    expediente_id: expedienteId,
    asignado_a_usuario_id: asignadoAUsuarioId,
    descripcion,
    fecha_vencimiento: fechaVencimiento,
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

  return { tareaId: idTareaTemp }
}

export async function toggleTareaLocal(tareaId: number, completadaNueva: boolean) {
  const ahora = Date.now()

  await run(
    `UPDATE tareas SET completada = ?, sync_status = 'pending', updated_at = ? WHERE id = ?`,
    [completadaNueva ? 1 : 0, ahora, tareaId]
  )
  await run(
    `INSERT INTO sync_queue (tabla, operacion, payload, created_at) VALUES (?, 'upsert', ?, ?)`,
    ['tareas', JSON.stringify({ id: tareaId, completada: completadaNueva }), ahora]
  )
}