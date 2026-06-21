// app/sistema/expedientes/civil/detalle/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — idénticos al resto del sistema (azul marino para Civil)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  surface:     '#0b1220',
  border:      'rgba(255,255,255,0.06)',
  accent:      '#3a5fb8',
  accentAlpha: 'rgba(58,95,184,0.12)',
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

export default async function DetalleExpedienteCivilPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const expedienteId = Number(id)

  if (!id || Number.isNaN(expedienteId)) {
    notFound()
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expRaw, error } = await supabase
    .from('expedientes')
    .select(`
      id, numero_expediente, tipo_juicio, caracter_cliente, contraparte, ciudad, estado, fecha_inicio, descripcion,
      clientes ( nombre_completo ),
      juzgados ( nombre, ciudad ),
      tareas ( id, descripcion, fecha_vencimiento, completada )
    `)
    .eq('id', expedienteId)
    .single()

  if (error || !expRaw) {
    notFound()
  }

  const exp = {
    id:                expRaw.id,
    numero_expediente: expRaw.numero_expediente,
    tipo_juicio:       expRaw.tipo_juicio,
    caracter_cliente:  expRaw.caracter_cliente,
    contraparte:       expRaw.contraparte,
    ciudad:            expRaw.ciudad,
    estado:            expRaw.estado,
    fecha_inicio:      expRaw.fecha_inicio,
    descripcion:       expRaw.descripcion,
    cliente: expRaw.clientes ? (expRaw.clientes as any).nombre_completo : null,
    juzgado: expRaw.juzgados ? (expRaw.juzgados as any) : null,
    tareas: ((expRaw.tareas as any[]) ?? []).map((t: any) => ({
      id: t.id, descripcion: t.descripcion, fecha_vencimiento: t.fecha_vencimiento, completada: t.completada,
    })),
  }

  const activo = exp.estado === 'Activo'

  return (
    <div style={css.root}>
      <Link href="/sistema/expedientes/civil" style={css.volver}>
        <i className="ti ti-arrow-left" style={{ fontSize: 16 }} aria-hidden="true" />
        Volver a Expedientes Civil / Familiar
      </Link>

      <div style={css.header}>
        <div style={{ minWidth: 0 }}>
          <div style={css.eyebrow}>{exp.tipo_juicio || 'Civil / Familiar'}</div>
          <h1 style={css.titulo}>{exp.numero_expediente}</h1>
        </div>
        <span style={{
          ...css.pill,
          background: activo ? T.greenAlpha : T.amberAlpha,
          color:      activo ? T.green      : T.amber,
          border:     `0.5px solid ${activo ? 'rgba(74,222,128,0.18)' : 'rgba(251,191,36,0.20)'}`,
        }}>
          {exp.estado}
        </span>
      </div>

      <Seccion titulo="Información General">
        <div style={css.grid2}>
          <Dato label="Cliente" valor={exp.cliente} />
          <Dato label="Carácter del cliente" valor={exp.caracter_cliente} />
          <Dato label="Contraparte" valor={exp.contraparte} />
          <Dato label="Fecha de inicio" valor={exp.fecha_inicio} />
          <Dato label="Ciudad" valor={exp.ciudad} />
          <Dato label="Tipo de juicio" valor={exp.tipo_juicio} />
        </div>
      </Seccion>

      <Seccion titulo="Información Procesal">
        <div style={css.grid2}>
          <Dato label="Juzgado" valor={exp.juzgado ? `${exp.juzgado.nombre} (${exp.juzgado.ciudad})` : null} />
        </div>
      </Seccion>

      {exp.descripcion && (
        <Seccion titulo="Descripción / Observaciones">
          <p style={{ color: T.textMuted, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
            {exp.descripcion}
          </p>
        </Seccion>
      )}

      <Seccion titulo="Tareas y Términos">
        {exp.tareas.length === 0 ? (
          <p style={{ color: T.textFaint, fontSize: 13, margin: 0 }}>Sin tareas registradas para este expediente.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exp.tareas.map((t) => (
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
    fontSize: 11, fontWeight: 600, color: T.accent, letterSpacing: '0.04em', textTransform: 'uppercase' as const, marginBottom: 4,
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