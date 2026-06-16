import { createClient } from '@/lib/supabase/server'

export default async function TestPage() {
  const supabase = await createClient()
  const { data: materias, error } = await supabase.from('materias').select('*')

  if (error) {
    return <pre style={{ padding: 24, color: 'red' }}>Error: {error.message}</pre>
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Conexión a Supabase OK ✅</h1>
      <pre>{JSON.stringify(materias, null, 2)}</pre>
    </div>
  )
}