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
            <div className="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center animate-pulse">
              <span className="text-accent-primary font-bold font-mono">A</span>
            </div>
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
