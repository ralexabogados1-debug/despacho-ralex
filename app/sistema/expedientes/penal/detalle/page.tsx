// app/sistema/expedientes/penal/detalle/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — idénticos al resto del sistema (rojo vino para Penal)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  surface:     '#0b1220',
  border:      'rgba(255,255,255,0.06)',
  accent:      '#3a5fb8',
  accentAlpha: 'rgba(58,95,184,0.12)',
  red:         '#b3434f',
  redAlpha:    'rgba(179,67,79,0.10)',
  green:       '#4ade80',
  greenAlpha:  'rgba(74,222,128,0.08)',
  amber:       '#fbbf24',
  amberAlpha:  'rgba(251,191,36,0.08)',
  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted:   'rgba(255,255,255,0.40)',
  textFaint:   'rgba(255,255,255,0.22)',
  textAccent:  '#8fa8e0',
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE (Server Component) — lee el id desde ?id=123
// ─────────────────────────────────────────────────────────────────────────────
export default async function DetalleCausaPenalPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const causaId = Number(id)

  if (!id || Number.isNaN(causaId)) {
    notFound()
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: causaRaw, error } = await supabase
    .from('expedientes')
    .select(`
      id, numero_expediente, caracter_cliente, contraparte, estado, fecha_inicio, descripcion,
      clientes ( nombre_completo ),
      jueces ( nombre ),
      juzgados ( nombre, ciudad ),
      tareas ( id, descripcion, fecha_vencimiento, completada ),
      expedientes_penales (
        numero_carpeta_investigacion, delito, estadio_procesal, rol_abogado,
        ministerios_publicos ( nombre_agencia )
      )
    `)
    .eq('id', causaId)
    .single()

  if (error || !causaRaw) {
    notFound()
  }

  // Normalizar para evitar referencias circulares
  const penalRaw = Array.isArray(causaRaw.expedientes_penales)
    ? causaRaw.expedientes_penales[0]
    : causaRaw.expedientes_penales

  const causa = {
    id:                causaRaw.id,
    numero_expediente: causaRaw.numero_expediente,
    caracter_cliente:  causaRaw.caracter_cliente,
    contraparte:       causaRaw.contraparte,
    estado:            causaRaw.estado,
    fecha_inicio:      causaRaw.fecha_inicio,
    descripcion:       causaRaw.descripcion,
    cliente:  causaRaw.clientes  ? (causaRaw.clientes as any).nombre_completo : null,
    juez:     causaRaw.jueces    ? (causaRaw.jueces as any).nombre : null,
    juzgado:  causaRaw.juzgados  ? (causaRaw.juzgados as any) : null,
    tareas: ((causaRaw.tareas as any[]) ?? []).map((t: any) => ({
      id: t.id, descripcion: t.descripcion, fecha_vencimiento: t.fecha_vencimiento, completada: t.completada,
    })),
    penal: penalRaw ? {
      numero_carpeta_investigacion: penalRaw.numero_carpeta_investigacion,
      delito:           penalRaw.delito,
      estadio_procesal: penalRaw.estadio_procesal,
      rol_abogado:      penalRaw.rol_abogado,
      mp: penalRaw.ministerios_publicos ? (penalRaw.ministerios_publicos as any).nombre_agencia : null,
    } : null,
  }

  const activo = causa.estado === 'Activo'

  return (
    <div style={css.root}>
      {/* Breadcrumb + volver */}
      <Link href="/sistema/expedientes/penal" style={css.volver}>
        <i className="ti ti-arrow-left" style={{ fontSize: 16 }} aria-hidden="true" />
        Volver a Causas Penales
      </Link>

      {/* Encabezado */}
      <div style={css.header}>
        <div style={{ minWidth: 0 }}>
          <div style={css.eyebrow}>{causa.penal?.delito || 'Sin delito especificado'}</div>
          <h1 style={css.titulo}>{causa.numero_expediente}</h1>
        </div>
        <span style={{
          ...css.pill,
          background: activo ? T.greenAlpha : T.amberAlpha,
          color:      activo ? T.green      : T.amber,
          border:     `0.5px solid ${activo ? 'rgba(74,222,128,0.18)' : 'rgba(251,191,36,0.20)'}`,
        }}>
          {causa.estado}
        </span>
      </div>

      {/* Información general */}
      <Seccion titulo="Información General">
        <div style={css.grid2}>
          <Dato label="Cliente" valor={causa.cliente} />
          <Dato label="Carácter del cliente" valor={causa.caracter_cliente} />
          <Dato label="Fecha de inicio" valor={causa.fecha_inicio} />
          <Dato label="Rol del abogado" valor={causa.penal?.rol_abogado} />
          <Dato label="Contraparte / Ofendido" valor={causa.contraparte} />
          <Dato label="Etapa procesal" valor={causa.penal?.estadio_procesal} />
        </div>
      </Seccion>

      {/* Información procesal */}
      <Seccion titulo="Información Procesal">
        <div style={css.grid2}>
          <Dato label="Número de carpeta de investigación" valor={causa.penal?.numero_carpeta_investigacion} />
          <Dato label="Juez asignado" valor={causa.juez} />
          <Dato label="Ministerio Público" valor={causa.penal?.mp} />
          <Dato label="Juzgado" valor={causa.juzgado ? `${causa.juzgado.nombre} (${causa.juzgado.ciudad})` : null} />
        </div>
      </Seccion>

      {/* Descripción */}
      {causa.descripcion && (
        <Seccion titulo="Descripción / Notas">
          <p style={{ color: T.textMuted, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
            {causa.descripcion}
          </p>
        </Seccion>
      )}

      {/* Tareas / términos */}
      <Seccion titulo="Tareas y Términos">
        {causa.tareas.length === 0 ? (
          <p style={{ color: T.textFaint, fontSize: 13, margin: 0 }}>Sin tareas registradas para esta causa.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {causa.tareas.map((t) => (
              <div key={t.id} style={css.tareaRow}>
                <span style={{
                  ...css.rowDotStatic,
                  background: t.completada ? T.green : T.amber,
                }} />
                <span style={{
                  flex: 1,
                  fontSize: 13.5,
                  color: t.completada ? T.textFaint : T.textPrimary,
                  textDecoration: t.completada ? 'line-through' : 'none',
                }}>
                  {t.descripcion}
                </span>
                {t.fecha_vencimiento && (
                  <span style={{ fontSize: 12, color: T.textFaint, flexShrink: 0 }}>
                    {t.fecha_vencimiento}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Seccion>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧩 SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────────────
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={css.seccion}>
      <div style={css.seccionTitulo}>{titulo}</div>
      {children}
    </div>
  )
}

function Dato({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.textFaint, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: valor ? T.textPrimary : T.textFaint }}>
        {valor || '—'}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
const css = {
  root: {
    width: '100%',
    maxWidth: 900,
    padding: 'clamp(20px, 5vw, 40px) clamp(20px, 5vw, 40px)',
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  },

  volver: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: T.textAccent,
    textDecoration: 'none',
    fontWeight: 500,
    width: 'fit-content',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  eyebrow: {
    fontSize: 11,
    fontWeight: 600,
    color: T.red,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  } as React.CSSProperties,

  titulo: {
    fontSize: 'clamp(22px, 4vw, 28px)',
    fontWeight: 700,
    color: T.textPrimary,
    margin: 0,
    letterSpacing: '-0.5px',
  } as React.CSSProperties,

  pill: {
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 12px',
    borderRadius: 20,
    flexShrink: 0,
  } as React.CSSProperties,

  seccion: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 12,
    padding: '18px 20px',
  } as React.CSSProperties,

  seccionTitulo: {
    fontSize: 13,
    fontWeight: 600,
    color: T.textMuted,
    marginBottom: 16,
  } as React.CSSProperties,

  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  } as React.CSSProperties,

  tareaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    background: '#0f1828',
    border: `0.5px solid ${T.border}`,
    borderRadius: 8,
  } as React.CSSProperties,

  rowDotStatic: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  } as React.CSSProperties,
}