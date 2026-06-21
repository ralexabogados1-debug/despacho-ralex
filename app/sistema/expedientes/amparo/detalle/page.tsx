// app/sistema/expedientes/amparo/detalle/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — idénticos al resto del sistema (dorado para Amparo)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  surface:     '#0b1220',
  border:      'rgba(255,255,255,0.06)',
  gold:        '#d4af37',
  goldAlpha:   'rgba(212,175,55,0.10)',
  green:       '#4ade80',
  greenAlpha:  'rgba(74,222,128,0.08)',
  amber:       '#fbbf24',
  amberAlpha:  'rgba(251,191,36,0.08)',
  red:         '#b3434f',
  textPrimary: 'rgba(255,255,255,0.85)',
  textMuted:   'rgba(255,255,255,0.40)',
  textFaint:   'rgba(255,255,255,0.22)',
  textAccent:  '#8fa8e0',
}

export default async function DetalleAmparoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const amparoId = Number(id)

  if (!id || Number.isNaN(amparoId)) {
    notFound()
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ampRaw, error } = await supabase
    .from('expedientes')
    .select(`
      id, numero_expediente, estado, fecha_inicio, descripcion,
      clientes ( nombre_completo ),
      juzgados ( nombre, ciudad ),
      tareas ( id, descripcion, fecha_vencimiento, completada ),
      expedientes_amparo (
        tipo_amparo, autoridad_responsable, acto_reclamado, tercero_interesado
      )
    `)
    .eq('id', amparoId)
    .single()

  if (error || !ampRaw) {
    notFound()
  }

  const dataAmpRaw = Array.isArray(ampRaw.expedientes_amparo)
    ? ampRaw.expedientes_amparo[0]
    : ampRaw.expedientes_amparo

  const amp = {
    id:                ampRaw.id,
    numero_expediente: ampRaw.numero_expediente,
    estado:            ampRaw.estado,
    fecha_inicio:      ampRaw.fecha_inicio,
    descripcion:       ampRaw.descripcion,
    cliente: ampRaw.clientes ? (ampRaw.clientes as any).nombre_completo : null,
    juzgado: ampRaw.juzgados ? (ampRaw.juzgados as any) : null,
    tareas: ((ampRaw.tareas as any[]) ?? []).map((t: any) => ({
      id: t.id, descripcion: t.descripcion, fecha_vencimiento: t.fecha_vencimiento, completada: t.completada,
    })),
    datos: dataAmpRaw ? {
      tipo_amparo:           dataAmpRaw.tipo_amparo,
      autoridad_responsable: dataAmpRaw.autoridad_responsable,
      acto_reclamado:        dataAmpRaw.acto_reclamado,
      tercero_interesado:    dataAmpRaw.tercero_interesado,
    } : null,
  }

  const activo = amp.estado === 'Activo' || amp.estado === 'En trámite'

  return (
    <div style={css.root}>
      <Link href="/sistema/expedientes/amparo" style={css.volver}>
        <i className="ti ti-arrow-left" style={{ fontSize: 16 }} aria-hidden="true" />
        Volver a Expedientes de Amparo
      </Link>

      <div style={css.header}>
        <div style={{ minWidth: 0 }}>
          <div style={css.eyebrow}>{amp.datos?.tipo_amparo || 'Amparo Indirecto'}</div>
          <h1 style={css.titulo}>{amp.numero_expediente}</h1>
        </div>
        <span style={{
          ...css.pill,
          background: activo ? T.greenAlpha : T.goldAlpha,
          color:      activo ? T.green      : T.gold,
          border:     `0.5px solid ${activo ? 'rgba(74,222,128,0.18)' : 'rgba(212,175,55,0.20)'}`,
        }}>
          {amp.estado}
        </span>
      </div>

      <Seccion titulo="Información del Amparo">
        <div style={css.grid2}>
          <Dato label="Quejoso" valor={amp.cliente} />
          <Dato label="Tipo de amparo" valor={amp.datos?.tipo_amparo} />
          <Dato label="Fecha de presentación" valor={amp.fecha_inicio} />
          <Dato label="Tercero interesado" valor={amp.datos?.tercero_interesado} />
        </div>
      </Seccion>

      <Seccion titulo="Acto Reclamado">
        <div style={css.grid2}>
          <Dato label="Autoridad responsable" valor={amp.datos?.autoridad_responsable} />
          <Dato label="Juzgado de Distrito" valor={amp.juzgado ? `${amp.juzgado.nombre} (${amp.juzgado.ciudad})` : null} />
        </div>
        {amp.datos?.acto_reclamado && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textFaint, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
              Acto reclamado
            </div>
            <p style={{ color: T.textMuted, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              {amp.datos.acto_reclamado}
            </p>
          </div>
        )}
      </Seccion>

      {amp.descripcion && (
        <Seccion titulo="Descripción / Observaciones">
          <p style={{ color: T.textMuted, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
            {amp.descripcion}
          </p>
        </Seccion>
      )}

      <Seccion titulo="Tareas y Términos">
        {amp.tareas.length === 0 ? (
          <p style={{ color: T.textFaint, fontSize: 13, margin: 0 }}>Sin tareas registradas para este amparo.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {amp.tareas.map((t) => (
              <div key={t.id} style={css.tareaRow}>
                <span style={{ ...css.rowDotStatic, background: t.completada ? T.green : T.amber }} />
                <span style={{
                  flex: 1, fontSize: 13.5,
                  color: t.completada ? T.textFaint : T.textPrimary,
                  textDecoration: t.completada ? 'line-through' : 'none',
                }}>
                  {t.descripcion}
                </span>
                {t.fecha_vencimiento && (
                  <span style={{ fontSize: 12, color: T.textFaint, flexShrink: 0 }}>{t.fecha_vencimiento}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Seccion>
    </div>
  )
}

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

const css = {
  root: {
    width: '100%', maxWidth: 900,
    padding: 'clamp(20px, 5vw, 40px) clamp(20px, 5vw, 40px)',
    boxSizing: 'border-box' as const,
    display: 'flex', flexDirection: 'column' as const, gap: 20,
  },
  volver: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 13, color: T.textAccent, textDecoration: 'none', fontWeight: 500, width: 'fit-content',
  } as React.CSSProperties,
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  eyebrow: {
    fontSize: 11, fontWeight: 600, color: T.gold, letterSpacing: '0.04em', textTransform: 'uppercase' as const, marginBottom: 4,
  } as React.CSSProperties,
  titulo: {
    fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 700, color: T.textPrimary, margin: 0, letterSpacing: '-0.5px',
  } as React.CSSProperties,
  pill: { fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20, flexShrink: 0 } as React.CSSProperties,
  seccion: { background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: '18px 20px' } as React.CSSProperties,
  seccionTitulo: { fontSize: 13, fontWeight: 600, color: T.textMuted, marginBottom: 16 } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 } as React.CSSProperties,
  tareaRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    background: '#0f1828', border: `0.5px solid ${T.border}`, borderRadius: 8,
  } as React.CSSProperties,
  rowDotStatic: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 } as React.CSSProperties,
}