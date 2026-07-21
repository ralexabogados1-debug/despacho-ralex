// app/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { leerSesionLocal } from '@/lib/authLocal'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const sesion = leerSesionLocal()
    if (sesion) {
      router.replace('/sistema/dashboard')
    } else {
      router.replace('/login')
    }
  }, [router])

  return null
}