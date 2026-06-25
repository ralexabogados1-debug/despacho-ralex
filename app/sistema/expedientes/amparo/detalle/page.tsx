// app/sistema/expedientes/amparo/detalle/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — Dorado para Amparo
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:          '#070b14',
  surface:     '#0b1220',
  surfaceHover:'#0f1828',
  border:      'rgba(255,255,255,0.06)',
  gold:        '#d4af37',
  goldLight:   '#f0d060',
  goldAlpha:   'rgba(212,175,55,0.10)',
  goldAlpha2:  'rgba(212,175,55,0.20)',
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

  if (!id || Number.isNaN(amparoId)) notFound()

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

  if (error || !ampRaw) notFound()

  const dataAmpRaw = Array.isArray(ampRaw.expedientes_amparo)
    ? ampRaw.expedientes_amparo[0]
    : ampRaw.expedientes_amparo

  const amp = {
    id:                ampRaw.id,
    numero_expediente: ampRaw.numero_expediente,
    estado:            ampRaw.estado,
    fecha_inicio:      ampRaw.fecha_inicio,
    descripcion:       ampRaw.descripcion,
    cliente: (ampRaw.clientes as any)?.nombre_completo ?? null,
    juzgado: (ampRaw.juzgados as any) ?? null,
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
  const totalTareas = amp.tareas.length
  const completadas = amp.tareas.filter(t => t.completada).length
  const progreso = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0

  return (
    <div style={s.root}>
      {/* ─── CSS para responsividad ─── */}
      <style>{`
        .amp-detalle-grid {
          grid-template-columns: 1fr 360px;
        }
        @media (max-width: 900px) {
          .amp-detalle-grid {
            grid-template-columns: 1fr !important;
          }
          .amp-detalle-root {
            max-width: 100% !important;
            padding: 16px !important;
          }
        }
        @media (max-width: 640px) {
          .amp-hero {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .amp-hero .amp-badge {
            align-self: flex-start;
          }
        }
      `}</style>

      {/* Breadcrumb con icono */}
      <Link href="/sistema/expedientes/amparo" style={s.breadcrumb}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Volver a Expedientes de Amparo
      </Link>

      {/* ─── HERO HEADER ─── */}
      <div className="amp-hero" style={s.hero}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.eyebrow}>
            <span style={s.dot} />
            {amp.datos?.tipo_amparo || 'Amparo Indirecto'}
          </div>
          <h1 style={s.titulo}>{amp.numero_expediente}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span style={{ fontSize: 13, color: T.textMuted }}>{amp.cliente || 'Sin cliente asignado'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <span style={{ fontSize: 13, color: T.textMuted }}>{amp.fecha_inicio || '—'}</span>
            </div>
          </div>
        </div>
        {/* Badge de estado grande */}
        <div className="amp-badge" style={{
          ...s.badge,
          background: activo ? T.greenAlpha : T.goldAlpha,
          borderColor: activo ? 'rgba(74,222,128,0.25)' : 'rgba(212,175,55,0.25)',
          color: activo ? T.green : T.gold,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: activo ? T.green : T.gold, flexShrink: 0 }} />
          {amp.estado}
        </div>
      </div>

      {/* ─── CONTENIDO PRINCIPAL ─── */}
      <div className="amp-detalle-grid" style={s.contentGrid}>
        {/* Columna izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Información del Amparo */}
          <Seccion titulo="Información del Amparo" icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          }>
            <div style={s.grid2}>
              <Dato label="Quejoso" valor={amp.cliente} />
              <Dato label="Tipo de amparo" valor={amp.datos?.tipo_amparo} />
              <Dato label="Fecha de presentación" valor={amp.fecha_inicio} />
              <Dato label="Tercero interesado" valor={amp.datos?.tercero_interesado} />
              <Dato label="Juzgado de Distrito" valor={amp.juzgado ? `${amp.juzgado.nombre} (${amp.juzgado.ciudad})` : null} />
              <Dato label="Autoridad responsable" valor={amp.datos?.autoridad_responsable} />
            </div>
          </Seccion>

          {/* Acto Reclamado */}
          <Seccion titulo="Acto Reclamado" icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          }>
            {amp.datos?.acto_reclamado ? (
              <div style={s.actoBox}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.5" style={{ flexShrink: 0, opacity: 0.5 }}>
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <p style={s.actoText}>{amp.datos.acto_reclamado}</p>
              </div>
            ) : (
              <p style={{ color: T.textFaint, fontSize: 13, margin: 0 }}>No especificado</p>
            )}
          </Seccion>

          {/* Observaciones (si existen) */}
          {amp.descripcion && (
            <Seccion titulo="Observaciones" icono={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            }>
              <p style={{ color: T.textMuted, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                {amp.descripcion}
              </p>
            </Seccion>
          )}
        </div>

        {/* Columna derecha: Tareas y progreso */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Seccion titulo="Tareas y Términos" icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="16" height="16" rx="2"/><path d="m9 12 2 2 4-4"/>
            </svg>
          }>
            {totalTareas === 0 ? (
              <p style={{ color: T.textFaint, fontSize: 13, margin: 0 }}>Sin tareas registradas para este amparo.</p>
            ) : (
              <>
                {/* Barra de progreso */}
                <div style={s.progresoBar}>
                  <div style={s.progresoFill(progreso)} />
                  <span style={s.progresoLabel}>{completadas}/{totalTareas} completadas</span>
                </div>

                {/* Lista de tareas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {amp.tareas.map(t => {
                    const vencida = !t.completada && t.fecha_vencimiento && t.fecha_vencimiento < new Date().toISOString().split('T')[0]
                    return (
                      <div key={t.id} style={s.tareaCard(t.completada, vencida)}>
                        <div style={s.tareaCheck(t.completada)}>
                          {t.completada && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5"/>
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: 13.5,
                            color: t.completada ? T.textFaint : T.textPrimary,
                            textDecoration: t.completada ? 'line-through' : 'none',
                            wordBreak: 'break-word',
                          }}>
                            {t.descripcion}
                          </span>
                          {t.fecha_vencimiento && (
                            <div style={{ fontSize: 11.5, color: vencida ? T.red : T.textFaint, marginTop: 2 }}>
                              {vencida ? '⚠ Vencida: ' : 'Vence: '}{t.fecha_vencimiento}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Seccion>
        </div>
      </div>

      {/* ─── ACCIONES FLOTANTES (placeholder) ─── */}
      <div style={s.actions}>
        <button style={s.btnSecundario}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Editar Amparo
        </button>
        <button style={s.btnPrimario}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Agregar Tarea
        </button>
      </div>
    </div>
  )
}

// ─── SUBCOMPONENTES ──────────────────────────────────────────────────────────
function Seccion({ titulo, icono, children }: { titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={{ color: T.gold, display: 'flex', alignItems: 'center' }}>{icono}</span>
        <h2 style={s.cardTitle}>{titulo}</h2>
      </div>
      <div style={{ padding: '0 4px' }}>
        {children}
      </div>
    </div>
  )
}

function Dato({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <div style={s.datoLabel}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: valor ? T.textPrimary : T.textFaint }}>
        {valor || '—'}
      </div>
    </div>
  )
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const s = {
  root: {
    width: '100%',
    maxWidth: 1100,
    margin: '0 auto',
    padding: 'clamp(20px, 4vw, 40px) clamp(20px, 5vw, 40px)',
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
  } as React.CSSProperties,
  breadcrumb: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: T.textAccent,
    textDecoration: 'none',
    fontWeight: 500,
    width: 'fit-content',
    transition: 'color 0.2s',
  } as React.CSSProperties,
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap' as const,
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 14,
    padding: '24px',
  } as React.CSSProperties,
  eyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11.5,
    fontWeight: 600,
    color: T.gold,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  } as React.CSSProperties,
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: T.gold,
    flexShrink: 0,
  },
  titulo: {
    fontSize: 'clamp(24px, 5vw, 32px)',
    fontWeight: 700,
    color: T.textPrimary,
    margin: 0,
    letterSpacing: '-0.5px',
    lineHeight: 1.1,
  } as React.CSSProperties,
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12.5,
    fontWeight: 600,
    padding: '8px 16px',
    borderRadius: 40,
    border: '0.5px solid',
    flexShrink: 0,
  } as React.CSSProperties,
  contentGrid: {
    display: 'grid',
    gap: 20,
    alignItems: 'start',
  } as React.CSSProperties, // Las columnas se definen en la clase .amp-detalle-grid

  // Tarjeta genérica
  card: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    borderRadius: 12,
    padding: '20px',
  } as React.CSSProperties,
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: T.textMuted,
    margin: 0,
    letterSpacing: '-0.1px',
  } as React.CSSProperties,

  // Grid de datos
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 18,
  } as React.CSSProperties,
  datoLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: T.textFaint,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  } as React.CSSProperties,

  // Acto reclamado
  actoBox: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    background: T.surfaceHover,
    border: `0.5px solid ${T.border}`,
    borderRadius: 10,
    padding: '16px',
  } as React.CSSProperties,
  actoText: {
    color: T.textPrimary,
    fontSize: 14,
    lineHeight: 1.7,
    margin: 0,
    fontStyle: 'italic',
  } as React.CSSProperties,

  // Progreso
  progresoBar: {
    position: 'relative' as const,
    height: 8,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  } as React.CSSProperties,
  progresoFill: (pct: number) => ({
    position: 'absolute' as const,
    left: 0,
    top: 0,
    height: '100%',
    width: `${pct}%`,
    background: `linear-gradient(90deg, ${T.gold}, ${T.goldLight})`,
    borderRadius: 4,
    transition: 'width 0.4s ease',
  }),
  progresoLabel: {
    fontSize: 11.5,
    color: T.textFaint,
    fontWeight: 500,
  } as React.CSSProperties,

  // Tarea individual
  tareaCard: (completada: boolean, vencida: boolean) => ({
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    padding: '12px 14px',
    background: completada ? 'rgba(255,255,255,0.02)' : vencida ? 'rgba(179,67,79,0.06)' : T.surfaceHover,
    border: `0.5px solid ${vencida ? 'rgba(179,67,79,0.25)' : T.border}`,
    borderRadius: 10,
    transition: 'background 0.2s',
  } as React.CSSProperties),
  tareaCheck: (completada: boolean) => ({
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: `1.5px solid ${completada ? T.green : T.border}`,
    background: completada ? T.greenAlpha : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: T.green,
    marginTop: 1,
  } as React.CSSProperties),

  // Acciones inferiores
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    flexWrap: 'wrap' as const,
    marginTop: 8,
  } as React.CSSProperties,
  btnPrimario: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 20px',
    background: T.gold,
    color: '#0b1220',
    border: 'none',
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'background 0.2s, transform 0.1s',
  } as React.CSSProperties,
  btnSecundario: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 20px',
    background: 'transparent',
    color: T.textMuted,
    border: `0.5px solid ${T.border}`,
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'background 0.2s',
  } as React.CSSProperties,
}