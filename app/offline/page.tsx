export default function OfflinePage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: 12,
      textAlign: 'center',
      padding: 20,
      background: '#070a11',
      color: 'rgba(255,255,255,0.85)',
    }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Sin conexión</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, maxWidth: 320 }}>
        Esta pantalla aún no se ha guardado en tu dispositivo. Vuelve a intentarlo
        cuando tengas conexión, o abre una causa que ya hayas visitado antes.
      </p>
    </div>
  )
}