// app/sistema/expedientes/penal/detalle/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — Rojo vino para Penal
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:          '#070b14',
  surface:     '#0b1220',
  surfaceHover:'#0f1828',
  border:      'rgba(255,255,255,0.06)',
  accent:      '#b3434f',
  accentLight: '#d45f6a',
  accentAlpha: 'rgba(179,67,79,0.10)',
  accentAlpha2:'rgba(179,67,79,0.20)',
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

// ─────────────────────────────────────────────────────────────────────────────
// PAGE (Server Component)
// ─────────────────────────────────────────────────────────────────────────────
export default async function DetalleCausaPenalPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const causaId = Number(id)

  if (!id || Number.isNaN(causaId)) notFound()

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

  if (error || !causaRaw) notFound()

  // Normalizar
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
    cliente: (causaRaw.clientes as any)?.nombre_completo ?? null,
    juez:   (causaRaw.jueces as any)?.nombre ?? null,
    juzgado:(causaRaw.juzgados as any) ?? null,
    tareas: ((causaRaw.tareas as any[]) ?? []).map((t: any) => ({
      id: t.id, descripcion: t.descripcion, fecha_vencimiento: t.fecha_vencimiento, completada: t.completada,
    })),
    penal: penalRaw ? {
      numero_carpeta_investigacion: penalRaw.numero_carpeta_investigacion,
      delito:           penalRaw.delito,
      estadio_procesal: penalRaw.estadio_procesal,
      rol_abogado:      penalRaw.rol_abogado,
      mp: (penalRaw.ministerios_publicos as any)?.nombre_agencia ?? null,
    } : null,
  }

  const activo = causa.estado === 'Activo'
  const totalTareas = causa.tareas.length
  const completadas = causa.tareas.filter(t => t.completada).length
  const progreso = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0

  return (
    <div style={s.root}>
      {/* ─── CSS para responsividad ─── */}
      <style>{`
        .pen-detalle-grid {
          grid-template-columns: 1fr 360px;
        }
        @media (max-width: 900px) {
          .pen-detalle-grid {
            grid-template-columns: 1fr !important;
          }
          .pen-detalle-root {
            max-width: 100% !important;
            padding: 16px !important;
          }
        }
        @media (max-width: 640px) {
          .pen-hero {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .pen-hero .pen-badge {
            align-self: flex-start;
          }
        }
      `}</style>

      {/* Breadcrumb */}
      <Link href="/sistema/expedientes/penal" style={s.breadcrumb}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Volver a Causas Penales
      </Link>

      {/* ─── HERO HEADER ─── */}
      <div className="pen-hero" style={s.hero}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.eyebrow}>
            <span style={s.dot} />
            {causa.penal?.delito || 'Sin delito especificado'}
          </div>
          <h1 style={s.titulo}>{causa.numero_expediente}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span style={{ fontSize: 13, color: T.textMuted }}>{causa.cliente || 'Sin cliente asignado'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <span style={{ fontSize: 13, color: T.textMuted }}>{causa.fecha_inicio || '—'}</span>
            </div>
          </div>
        </div>
        {/* Badge de estado */}
        <div className="pen-badge" style={{
          ...s.badge,
          background: activo ? T.greenAlpha : T.amberAlpha,
          borderColor: activo ? 'rgba(74,222,128,0.25)' : 'rgba(251,191,36,0.25)',
          color: activo ? T.green : T.amber,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: activo ? T.green : T.amber, flexShrink: 0 }} />
          {causa.estado}
        </div>
      </div>

      {/* ─── CONTENIDO PRINCIPAL ─── */}
      <div className="pen-detalle-grid" style={s.contentGrid}>
        {/* Columna izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Información General */}
          <Seccion titulo="Información General" icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          }>
            <div style={s.grid2}>
              <Dato label="Cliente" valor={causa.cliente} />
              <Dato label="Carácter del cliente" valor={causa.caracter_cliente} />
              <Dato label="Contraparte / Ofendido" valor={causa.contraparte} />
              <Dato label="Fecha de inicio" valor={causa.fecha_inicio} />
              <Dato label="Rol del abogado" valor={causa.penal?.rol_abogado} />
              <Dato label="Etapa procesal" valor={causa.penal?.estadio_procesal} />
            </div>
          </Seccion>

          {/* Información Procesal */}
          <Seccion titulo="Información Procesal" icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m14 13-8.5 8.5a2.121 2.121 0 1 1-3-3L11 10"/><path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>
            </svg>
          }>
            <div style={s.grid2}>
              <Dato label="N° Carpeta de Investigación" valor={causa.penal?.numero_carpeta_investigacion} />
              <Dato label="Juez asignado" valor={causa.juez} />
              <Dato label="Ministerio Público" valor={causa.penal?.mp} />
              <Dato label="Juzgado" valor={causa.juzgado ? `${causa.juzgado.nombre} (${causa.juzgado.ciudad})` : null} />
            </div>
          </Seccion>

          {/* Descripción */}
          {causa.descripcion && (
            <Seccion titulo="Notas / Descripción" icono={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            }>
              <p style={{ color: T.textMuted, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                {causa.descripcion}
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
              <p style={{ color: T.textFaint, fontSize: 13, margin: 0 }}>Sin tareas registradas para esta causa.</p>
            ) : (
              <>
                {/* Barra de progreso */}
                <div style={s.progresoBar}>
                  <div style={s.progresoFill(progreso)} />
                  <span style={s.progresoLabel}>{completadas}/{totalTareas} completadas</span>
                </div>

                {/* Lista de tareas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {causa.tareas.map(t => {
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

      {/* ─── ACCIONES ─── */}
      <div style={s.actions}>
        <button style={s.btnSecundario}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Editar Causa
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
        <span style={{ color: T.accent, display: 'flex', alignItems: 'center' }}>{icono}</span>
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
    color: T.accent,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  } as React.CSSProperties,
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: T.accent,
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
  } as React.CSSProperties, // columnas en clase .pen-detalle-grid

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
    background: `linear-gradient(90deg, ${T.accent}, ${T.accentLight})`,
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
    background: T.accent,
    color: '#fff',
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