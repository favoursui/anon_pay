'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'

export function withAuth(Component: React.ComponentType) {
  return function AuthGuard(props: object) {
    const { ready, authenticated } = usePrivy()
    const router = useRouter()

    useEffect(() => {
      if (ready && !authenticated) router.push('/')
    }, [ready, authenticated, router])

    if (!ready) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <img src="/anonpay-logo.svg" alt="AnonPay" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-lg tracking-tight">AnonPay</span>
            <div className="text-text-muted text-sm">Loading…</div>
          </div>
        </div>
      )
    }

    if (!authenticated) return null

    return (
      <AppLayout>
        <Component {...props} />
      </AppLayout>
    )
  }
}
