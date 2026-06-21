import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsuariosCliente from './cliente'

export default async function UsuariosPage() {
  const supabase = await createClient()

  // 1. Validar sesión
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  // 2. Solo administradores
  const { data: miPerfil } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('auth_id', authUser.id)
    .single()

  if (!miPerfil || miPerfil.rol !== 'admin') {
    redirect('/sistema/dashboard')
  }

  // 3. Lista completa de usuarios
  const { data: listaUsuarios } = await supabase
    .from('usuarios')
    .select('*')
    .order('nombre_completo', { ascending: true })

  const usuarios = listaUsuarios ?? []

  // 4. Métricas
  const totalAbogados = usuarios.length
  const totalActivos = usuarios.filter(u => u.activo === true).length
  const totalInactivos = totalAbogados - totalActivos

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 40px)', maxWidth: 1400, margin: '0 auto' }}>
      <UsuariosCliente
        usuariosIniciales={usuarios}
        metricas={{ totalAbogados, totalActivos, totalInactivos }}
      />
    </div>
  )
}