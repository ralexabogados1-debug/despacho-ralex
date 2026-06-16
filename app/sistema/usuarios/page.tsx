// app/usuarios/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsuariosCliente from './cliente'

export default async function UsuariosPage() {
  const supabase = await createClient()

  // 1. Validar sesión iniciada
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  // 2. Control de Acceso Estricto: Solo se permite al Administrador
  const { data: miPerfil } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('auth_id', authUser.id)
    .single()

  if (!miPerfil || miPerfil.rol !== 'Administrador') {
    redirect('/dashboard') // Desvía a los colaboradores si intentan entrar aquí
  }

  // 3. Traer la lista completa de usuarios para la tabla principal
  const { data: listaUsuarios } = await supabase
    .from('usuarios')
    .select('*')
    .order('nombre_completo', { ascending: true })

  const usuarios = listaUsuarios ?? []

  // 4. Calcular métricas rápidas para las tarjetas superiores (KPIs)
  const totalAbogados = usuarios.length
  const totalActivos = usuarios.filter(u => u.activo === true).length
  const totalInactivos = totalAbogados - totalActivos

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px 40px', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      <UsuariosCliente 
        usuariosIniciales={usuarios} 
        metricas={{ totalAbogados, totalActivos, totalInactivos }}
      />
    </div>
  )
}