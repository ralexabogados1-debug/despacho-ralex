import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;
const STORAGE_KEY = 'juridico-sqlite';

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const buf = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
    db = new SQL.Database(buf);
    migrarSchema(db);
  } else {
    db = new SQL.Database();
    initSchema(db);
  }

  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const b64 = btoa(String.fromCharCode(...data));
  localStorage.setItem(STORAGE_KEY, b64);
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
      id               INTEGER PRIMARY KEY,
      nombre_completo  TEXT,
      telefono         TEXT,
      email            TEXT,
      created_at       TEXT,
      sync_status      TEXT DEFAULT 'synced',
      updated_at       INTEGER
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

    -- 🆕 Catálogo de materias (Civil, Familiar, Penal, Amparo, etc.)
    -- Necesaria para el filtro "juzgados por materia" en Amparo offline.
    CREATE TABLE IF NOT EXISTS materias (
      id          INTEGER PRIMARY KEY,
      nombre      TEXT,
      sync_status TEXT DEFAULT 'synced',
      updated_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS ministerios_publicos (
      id            INTEGER PRIMARY KEY,
      nombre_agencia TEXT,
      ciudad        TEXT,
      sync_status   TEXT DEFAULT 'synced',
      updated_at    INTEGER
    );

    CREATE TABLE IF NOT EXISTS tareas (
      id                    INTEGER PRIMARY KEY,
      expediente_id         INTEGER,
      asignado_a_usuario_id INTEGER,
      descripcion           TEXT,
      fecha_vencimiento     TEXT,
      completada            INTEGER DEFAULT 0,
      -- 🆕 estado_kanban: necesario para el tablero de Tareas (Por Hacer / En Progreso / Completada).
      -- Sin esta columna, TableroTareasCliente no puede clasificar las tareas en columnas offline.
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
  `);
  saveDb();
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

  // juzgados (usuarios con BD anterior a este cambio)
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

  // 🆕 materias (usuarios con BD anterior a este cambio)
  // Esta es la tabla que faltaba y causaba "no such table: materias"
  // en el selector de juzgados de Amparo offline.
  db.run(`
    CREATE TABLE IF NOT EXISTS materias (
      id          INTEGER PRIMARY KEY,
      nombre      TEXT,
      sync_status TEXT DEFAULT 'synced',
      updated_at  INTEGER
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

  // 🆕 estado_kanban (usuarios con BD anterior a este cambio) — sin esta
  // columna el tablero de Tareas no puede clasificar filas offline en
  // Por Hacer / En Progreso / Completada.
  agregarColumnaSiFalta(db, 'tareas', 'estado_kanban', 'TEXT')

  saveDb()
}