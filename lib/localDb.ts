import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;
let dbPromise: Promise<Database> | null = null; // evita carreras si getDb() se llama 2 veces seguidas

const VERSION_ACTUAL = 4;

function getStorageKey(userId?: string) {
  const uid = userId ?? localStorage.getItem('juridico-current-user') ?? 'default'
  return `juridico-sqlite-${uid}`
}

function getVersionKey(userId?: string) {
  const uid = userId ?? localStorage.getItem('juridico-current-user') ?? 'default'
  return `juridico-sqlite-version-${uid}`
}

// ─────────────────────────────────────────────────────────────────────────
// ⏱️ initSqlJs con timeout — el fetch interno del .wasm no tiene timeout
// propio, entonces con conexión inestable se puede quedar colgado para
// siempre. Si no resuelve en 8s, lanzamos error en vez de dejarlo pegado.
// ─────────────────────────────────────────────────────────────────────────
async function initSqlJsConTimeout(ms = 8000) {
  const resultado = await Promise.race([
    initSqlJs({ locateFile: () => '/sql-wasm.wasm' }),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ])

  if (resultado === 'timeout') {
    throw new Error('TIMEOUT_WASM')
  }

  return resultado
}

export async function getDb(userId?: string): Promise<Database> {
  if (db) return db

  // Si ya hay una carga en curso, reusarla en vez de disparar otro fetch
  if (dbPromise) return dbPromise

  dbPromise = (async () => {
    let SQL
    try {
      SQL = await initSqlJsConTimeout()
    } catch (err) {
      // Limpiamos la promesa fallida para permitir reintentar después
      dbPromise = null
      throw new Error(
        'No se pudo cargar el motor de base de datos local. Verifica tu conexión e inténtalo de nuevo.'
      )
    }

    const storageKey = getStorageKey(userId)
    const versionKey = getVersionKey(userId)

    const versionGuardada = Number(localStorage.getItem(versionKey) ?? '0')
    const versionCoincide = versionGuardada === VERSION_ACTUAL
    const saved = versionCoincide ? localStorage.getItem(storageKey) : null

    if (saved) {
      const buf = Uint8Array.from(atob(saved), c => c.charCodeAt(0))
      db = new SQL.Database(buf)
      migrarSchema(db)
    } else {
      db = new SQL.Database()
      initSchema(db)
      localStorage.setItem(versionKey, String(VERSION_ACTUAL))
    }

    return db
  })()

  return dbPromise
}

export function saveDb(userId?: string) {
  if (!db) return
  const data = db.export()
  const b64 = btoa(String.fromCharCode(...data))
  localStorage.setItem(getStorageKey(userId), b64)
  localStorage.setItem(getVersionKey(userId), String(VERSION_ACTUAL))
}

export function resetDb() {
  db = null
  dbPromise = null
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS expedientes (
      id                INTEGER PRIMARY KEY,
      materia_id        INTEGER,
      cliente_id        INTEGER,
      juzgado_id        INTEGER,
      juez_id           INTEGER,
      numero_expediente TEXT,
      tipo_juicio       TEXT,
      caracter_cliente  TEXT,
      contraparte       TEXT,
      ciudad            TEXT,
      creado_por        INTEGER,
      estado            TEXT,
      created_at        TEXT,
      fecha_inicio      TEXT,
      descripcion       TEXT,
      ultima_actuacion  TEXT,
      sync_status       TEXT DEFAULT 'synced',
      updated_at        INTEGER
    );

    CREATE TABLE IF NOT EXISTS expedientes_penales (
      expediente_id                INTEGER PRIMARY KEY,
      ministerio_publico_id        INTEGER,
      numero_causa_penal           TEXT,
      numero_carpeta_investigacion TEXT,
      delito                       TEXT,
      estadio_procesal             TEXT,
      rol_abogado                  TEXT,
      imputado                     TEXT,
      victima_ofendido             TEXT,
      proxima_actuacion            TEXT,
      fecha_audiencia              TEXT,
      tipo_audiencia               TEXT,
      nombre_agente_mp             TEXT,
      sync_status                  TEXT DEFAULT 'synced',
      updated_at                   INTEGER
    );

    CREATE TABLE IF NOT EXISTS expedientes_amparo (
      expediente_id         INTEGER PRIMARY KEY,
      tipo_amparo           TEXT,
      autoridad_responsable TEXT,
      acto_reclamado        TEXT,
      tercero_interesado    TEXT,
      estadio_procesal      TEXT,
      proxima_audiencia     TEXT,
      sync_status           TEXT DEFAULT 'synced',
      updated_at            INTEGER
    );

    CREATE TABLE IF NOT EXISTS expedientes_civiles (
      expediente_id    INTEGER PRIMARY KEY,
      estadio_procesal TEXT,
      sync_status      TEXT DEFAULT 'synced',
      updated_at       INTEGER
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id              INTEGER PRIMARY KEY,
      nombre_completo TEXT,
      telefono        TEXT,
      email           TEXT,
      created_at      TEXT,
      sync_status     TEXT DEFAULT 'synced',
      updated_at      INTEGER
    );

    CREATE TABLE IF NOT EXISTS jueces (
      id          INTEGER PRIMARY KEY,
      nombre      TEXT,
      juzgado_id  INTEGER,
      sync_status TEXT DEFAULT 'synced',
      updated_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS juzgados (
      id          INTEGER PRIMARY KEY,
      nombre      TEXT,
      ciudad      TEXT,
      materia_id  INTEGER,
      sync_status TEXT DEFAULT 'synced',
      updated_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS materias (
      id          INTEGER PRIMARY KEY,
      nombre      TEXT,
      sync_status TEXT DEFAULT 'synced',
      updated_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS eventos_calendario (
      id            INTEGER PRIMARY KEY,
      expediente_id INTEGER,
      usuario_id    INTEGER,
      titulo        TEXT,
      tipo_evento   TEXT,
      fecha_hora    TEXT,
      descripcion   TEXT,
      sync_status   TEXT DEFAULT 'synced',
      updated_at    INTEGER
    );

    CREATE TABLE IF NOT EXISTS ministerios_publicos (
      id             INTEGER PRIMARY KEY,
      nombre_agencia TEXT,
      ciudad         TEXT,
      sync_status    TEXT DEFAULT 'synced',
      updated_at     INTEGER
    );

    CREATE TABLE IF NOT EXISTS tareas (
      id                    INTEGER PRIMARY KEY,
      expediente_id         INTEGER,
      asignado_a_usuario_id INTEGER,
      descripcion           TEXT,
      fecha_vencimiento     TEXT,
      completada            INTEGER DEFAULT 0,
      estado_kanban         TEXT,
      eliminada             INTEGER DEFAULT 0,
      sync_status           TEXT DEFAULT 'synced',
      updated_at            INTEGER
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id            INTEGER PRIMARY KEY,
      expediente_id INTEGER,
      usuario_id    INTEGER,
      titulo        TEXT,
      tipo_evento   TEXT,
      fecha_hora    TEXT,
      descripcion   TEXT,
      sync_status   TEXT DEFAULT 'synced',
      updated_at    INTEGER
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id              INTEGER PRIMARY KEY,
      nombre_completo TEXT,
      email           TEXT,
      rol             TEXT,
      activo          INTEGER DEFAULT 0,
      created_at      TEXT,
      auth_id         TEXT,
      sync_status     TEXT DEFAULT 'synced',
      updated_at      INTEGER
    );

    CREATE TABLE IF NOT EXISTS expediente_abogados (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      expediente_id  INTEGER,
      usuario_id     INTEGER,
      es_responsable INTEGER DEFAULT 0,
      sync_status    TEXT DEFAULT 'synced',
      updated_at     INTEGER
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      tabla      TEXT,
      operacion  TEXT,
      payload    TEXT,
      created_at INTEGER
    );
  `)
  saveDb()
}

function columnaExiste(db: Database, tabla: string, columna: string): boolean {
  const res = db.exec(`PRAGMA table_info(${tabla})`)
  if (!res[0]) return false
  return res[0].values.some((row: any) => row[1] === columna)
}

function agregarColumnaSiFalta(db: Database, tabla: string, columna: string, tipo: string) {
  if (!columnaExiste(db, tabla, columna)) {
    db.run(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo}`)
  }
}

function migrarSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS expedientes_civiles (
      expediente_id    INTEGER PRIMARY KEY,
      estadio_procesal TEXT,
      sync_status      TEXT DEFAULT 'synced',
      updated_at       INTEGER
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS eventos (
      id            INTEGER PRIMARY KEY,
      expediente_id INTEGER,
      usuario_id    INTEGER,
      titulo        TEXT,
      tipo_evento   TEXT,
      fecha_hora    TEXT,
      descripcion   TEXT,
      sync_status   TEXT DEFAULT 'synced',
      updated_at    INTEGER
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id              INTEGER PRIMARY KEY,
      nombre_completo TEXT,
      email           TEXT,
      rol             TEXT,
      activo          INTEGER DEFAULT 0,
      created_at      TEXT,
      auth_id         TEXT,
      sync_status     TEXT DEFAULT 'synced',
      updated_at      INTEGER
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS expediente_abogados (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      expediente_id  INTEGER,
      usuario_id     INTEGER,
      es_responsable INTEGER DEFAULT 0,
      sync_status    TEXT DEFAULT 'synced',
      updated_at     INTEGER
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS juzgados (
      id          INTEGER PRIMARY KEY,
      nombre      TEXT,
      ciudad      TEXT,
      materia_id  INTEGER,
      sync_status TEXT DEFAULT 'synced',
      updated_at  INTEGER
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS materias (
      id          INTEGER PRIMARY KEY,
      nombre      TEXT,
      sync_status TEXT DEFAULT 'synced',
      updated_at  INTEGER
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS eventos_calendario (
      id            INTEGER PRIMARY KEY,
      expediente_id INTEGER,
      usuario_id    INTEGER,
      titulo        TEXT,
      tipo_evento   TEXT,
      fecha_hora    TEXT,
      descripcion   TEXT,
      sync_status   TEXT DEFAULT 'synced',
      updated_at    INTEGER
    );
  `)

  agregarColumnaSiFalta(db, 'expedientes', 'ultima_actuacion', 'TEXT')

  agregarColumnaSiFalta(db, 'expedientes_penales', 'imputado', 'TEXT')
  agregarColumnaSiFalta(db, 'expedientes_penales', 'victima_ofendido', 'TEXT')
  agregarColumnaSiFalta(db, 'expedientes_penales', 'proxima_actuacion', 'TEXT')
  agregarColumnaSiFalta(db, 'expedientes_penales', 'fecha_audiencia', 'TEXT')
  agregarColumnaSiFalta(db, 'expedientes_penales', 'tipo_audiencia', 'TEXT')
  agregarColumnaSiFalta(db, 'expedientes_penales', 'nombre_agente_mp', 'TEXT')

  agregarColumnaSiFalta(db, 'expedientes_amparo', 'estadio_procesal', 'TEXT')
  agregarColumnaSiFalta(db, 'expedientes_amparo', 'proxima_audiencia', 'TEXT')

  agregarColumnaSiFalta(db, 'tareas', 'estado_kanban', 'TEXT')

  saveDb()
}