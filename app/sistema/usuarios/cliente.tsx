// app/usuarios/cliente.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Metricas {
  totalAbogados: number
  totalActivos: number
  totalInactivos: number
}

interface UsuariosClienteProps {
  usuariosIniciales: any[]
  metricas: Metricas
}

export default function UsuariosCliente({ usuariosIniciales, metricas }: UsuariosClienteProps) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('Todos')

  // Filtro dinámico en el cliente por nombre, correo o rol
  const usuariosFiltrados = usuariosIniciales.filter((usuario) => {
    const cumpleBusqueda = 
      usuario.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.email.toLowerCase().includes(busqueda.toLowerCase())
    
    const cumpleFiltroRol = filtroRol === 'Todos' || usuario.rol === filtroRol

    return cumpleBusqueda && cumpleFiltroRol
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      
      {/* ENCABEZADO PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Control de Usuarios</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Administra el personal del despacho jurídico y sus permisos.</p>
        </div>
        <button style={btnPrimarioStyle}>➕ Invitar Nuevo Abogado</button>
      </div>

      {/* TARJETAS DE MÉTRICAS (KPIs) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={cardMetricaStyle}>
          <span style={labelMetricaStyle}>ABOGADOS REGISTRADOS</span>
          <div style={valorMetricaStyle}>{metricas.totalAbogados}</div>
        </div>
        <div style={cardMetricaStyle}>
          <span style={labelMetricaStyle}>CUENTAS ACTIVAS</span>
          <div style={{ ...valorMetricaStyle, color: '#16a34a' }}>{metricas.totalActivos}</div>
        </div>
        <div style={cardMetricaStyle}>
          <span style={labelMetricaStyle}>CUENTAS SUSPENDIDAS</span>
          <div style={{ ...valorMetricaStyle, color: '#dc2626' }}>{metricas.totalInactivos}</div>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div style={barraFiltrosStyle}>
        <input 
          type="text" 
          placeholder="🔍 Buscar abogado por nombre o correo..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={inputBusquedaStyle}
        />
        <select 
          value={filtroRol} 
          onChange={(e) => setFiltroRol(e.target.value)} 
          style={selectFiltroStyle}
        >
          <option value="Todos">Todos los roles</option>
          <option value="Administrador">Administradores</option>
          <option value="Colaborador">Colaboradores</option>
        </select>
      </div>

      {/* TABLA PRINCIPAL DE CONTROL */}
      <div style={cardTablaStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0', height: 40 }}>
              <th style={{ paddingLeft: 12 }}>Abogado / Empleado</th>
              <th>Correo Electrónico</th>
              <th>Rol del Sistema</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right', paddingRight: 12 }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                  No se encontraron usuarios con esos criterios de búsqueda.
                </td>
              </tr>
            ) : (
              usuariosFiltrados.map((usuario) => (
                <tr key={usuario.id} style={filaTablaStyle}>
                  {/* Celda de Avatar y Nombre */}
                  <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={avatarMiniStyle}>
                      {usuario.nombre_completo.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: '#0f172a', display: 'block' }}>{usuario.nombre_completo}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>ID Interno: #{usuario.id}</span>
                    </div>
                  </td>
                  {/* Correo */}
                  <td style={{ color: '#334155' }}>{usuario.email}</td>
                  {/* Rol */}
                  <td>
                    <span style={{
                      ...badgeRolStyle,
                      background: usuario.rol === 'Administrador' ? '#f1f5f9' : '#eff6ff',
                      color: usuario.rol === 'Administrador' ? '#475569' : '#1d4ed8',
                      borderColor: usuario.rol === 'Administrador' ? '#cbd5e1' : '#bfdbfe',
                    }}>
                      {usuario.rol}
                    </span>
                  </td>
                  {/* Estado */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: usuario.activo ? '#16a34a' : '#94a3b8' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: usuario.activo ? '#22c55e' : '#94a3b8' }} />
                      {usuario.activo ? 'Activo' : 'Suspendido'}
                    </div>
                  </td>
                  {/* Botón de Redirección al Perfil */}
                  <td style={{ textAlign: 'right', paddingRight: 12 }}>
                    <button 
                      onClick={() => router.push(`/perfil/${usuario.id}`)} 
                      style={btnVerPerfilStyle}
                    >
                      Ver Perfil 👀
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}

// ESTILOS EN LÍNEA ELEGANTES PARA LA TABLA ADMINISTRATIVA
const btnPrimarioStyle: React.CSSProperties = { background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const cardMetricaStyle: React.CSSProperties = { background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }
const labelMetricaStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }
const valorMetricaStyle: React.CSSProperties = { fontSize: 26, fontWeight: 700, marginTop: 4, color: '#0f172a' }
const barraFiltrosStyle: React.CSSProperties = { display: 'flex', gap: 12, marginBottom: 16 }
const inputBusquedaStyle: React.CSSProperties = { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: 'white' }
const selectFiltroStyle: React.CSSProperties = { padding: '0 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: 'white', cursor: 'pointer' }
const cardTablaStyle: React.CSSProperties = { background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }
const filaTablaStyle: React.CSSProperties = { borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }
const avatarMiniStyle: React.CSSProperties = { width: 32, height: 32, borderRadius: '50%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }
const badgeRolStyle: React.CSSProperties = { border: '1px solid', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }
const btnVerPerfilStyle: React.CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer', transition: 'all 0.15s' }