import { useTablaLocal } from './useTablaLocal'

export function useUsuariosLocal() {
  const { datos, isOnline, syncing, sincronizar, recargar } = useTablaLocal({
    tabla: 'usuarios',
    soloLectura: true,
  })
  return { usuarios: datos, isOnline, syncing, sincronizar, recargar }
  // guardar()/eliminar() no se exponen — crear/editar usuarios requiere red (auth_id vive en Supabase Auth)
}