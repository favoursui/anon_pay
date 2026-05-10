'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import type { PaymentLink } from '@/lib/api'
import { formatUSDC } from '@/lib/utils'
import { ArrowUpRight, Shield, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function PayPage() {
  const params = useParams()
  const slug = params.slug as string
  const { login, authenticated } = usePrivy()
  const [link, setLink] = useState<PaymentLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getPaymentLink(slug)
      .then(setLink)
      .catch(() => setError('Payment link not found or expired.'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="animate-spin text-text-muted" />
      </div>
    )
  }

  if (error || !link) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center text-center p-6">
        <div>
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold mb-2">Link not found</h1>
          <p className="text-text-secondary text-sm mb-6">{error}</p>
          <Link href="/" className="text-accent-primary hover:underline text-sm">Go to AnonPay →</Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-bg-primary bg-grid flex items-center justify-center p-4">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent-primary opacity-[0.03] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-4">
            <div className="w-6 h-6 rounded bg-accent-primary/20 flex items-center justify-center">
              <span className="text-accent-primary font-bold text-xs font-mono">A</span>
            </div>
            <span className="text-sm">AnonPay</span>
          </Link>
          <h1 className="text-2xl font-bold">
            Pay <span className="text-accent-primary font-mono">@{link.owner_username}</span>
          </h1>
          {link.note && (
            <p className="text-text-secondary text-sm mt-2">{link.note}</p>
          )}
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-6 border border-border-subtle">
          {/* Amount */}
          <div className="bg-bg-secondary rounded-2xl p-5 text-center mb-5 border border-border-subtle">
            {link.amount_usdc ? (
              <>
                <div className="text-xs text-text-muted mb-1">Amount</div>
                <div className="text-4xl font-bold">
                  {formatUSDC(link.amount_usdc)}
                  <span className="text-lg text-text-muted ml-2">USDC</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-text-muted mb-2">Open amount</div>
                <div className="text-lg font-semibold text-text-secondary">You choose the amount</div>
              </>
            )}
          </div>

          {/* CTA */}
          {authenticated ? (
            <Link
              href={`/send?to=${link.owner_username}&amount=${link.amount_usdc || ''}&slug=${slug}`}
              className="btn-press w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-accent-primary text-bg-primary font-bold glow-green hover:bg-accent-primary/90 transition-all"
            >
              <ArrowUpRight size={18} />
              Send {link.amount_usdc ? `${formatUSDC(link.amount_usdc)} USDC` : 'USDC'}
            </Link>
          ) : (
            <button
              onClick={login}
              className="btn-press w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-accent-primary text-bg-primary font-bold glow-green hover:bg-accent-primary/90 transition-all"
            >
              <ArrowUpRight size={18} />
              Login to Pay
            </button>
          )}

          {/* Privacy note */}
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-text-muted">
            <Shield size={11} />
            Your wallet address stays private
          </div>
        </div>

        <div className="text-center mt-4">
          <Link href="/" className="text-xs text-text-muted hover:text-text-primary transition-colors">
            Powered by AnonPay
          </Link>
        </div>
      </motion.div>
    </main>
  )
}
