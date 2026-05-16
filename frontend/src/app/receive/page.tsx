'use client'

import { withAuth } from '@/components/layout/withAuth'
import { useAnonPay } from '@/hooks/useAnonPay'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, PageHeader, Skeleton } from '@/components/ui'
import { Copy, Check, Link as LinkIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import type { UserPrivate } from '@/lib/api'
import Link from 'next/link'

function ReceivePage() {
  const { getMe } = useAnonPay()
  const [profile, setProfile] = useState<UserPrivate | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<'username' | 'link' | null>(null)

  useEffect(() => {
    getMe().then(setProfile).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const payLink = profile ? `${appUrl}/pay/${profile.username}` : ''

  function copy(type: 'username' | 'link') {
    const text = type === 'username' ? `@${profile?.username}` : payLink
    navigator.clipboard.writeText(text)
    setCopied(type)
    toast.success(type === 'username' ? 'Username copied!' : 'Payment link copied!')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <PageHeader title="Receive USDC" subtitle="Share your username or payment link to get paid." />

      <div className="max-w-md space-y-4">
        {/* Username card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6">
            <div className="text-xs text-text-muted mb-2 font-medium">YOUR USERNAME</div>
            {loading ? (
              <Skeleton className="h-10 w-40" />
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold font-mono text-accent-primary">
                  @{profile?.username}
                </span>
                <button
                  onClick={() => copy('username')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-elevated border border-border-default text-xs hover:border-accent-primary/30 transition-all"
                >
                  {copied === 'username' ? <Check size={12} className="text-accent-primary" /> : <Copy size={12} />}
                  Copy
                </button>
              </div>
            )}
            <p className="text-xs text-text-muted mt-3">
              Anyone can send you USDC using this username. Your wallet address stays private.
            </p>
          </Card>
        </motion.div>

        {/* Payment link card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6">
            <div className="text-xs text-text-muted mb-2 font-medium">PAYMENT LINK</div>
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-bg-secondary rounded-xl px-3 py-2.5 border border-border-subtle font-mono text-xs text-text-secondary truncate">
                  {payLink}
                </div>
                <button
                  onClick={() => copy('link')}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-xs hover:border-accent-primary/30 transition-all"
                >
                  {copied === 'link' ? <Check size={12} className="text-accent-primary" /> : <Copy size={12} />}
                  Copy
                </button>
              </div>
            )}
            <p className="text-xs text-text-muted mt-3">
              Share this link, senders can pay you directly with this link.
            </p>
          </Card>
        </motion.div>

        {/* Custom payment links */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 hover:border-border-default transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-accent-purple/10 flex items-center justify-center">
                <LinkIcon size={16} className="text-accent-purple" />
              </div>
              <div>
                <div className="text-sm font-semibold">Custom Payment Links</div>
                <div className="text-xs text-text-muted">Set fixed amounts and notes</div>
              </div>
            </div>
            <p className="text-xs text-text-secondary mb-4">
              Create shareable links with pre-filled amounts, perfect for invoices, subscriptions, or donations.
            </p>
            <Link
              href="/payment-links"
              className="inline-flex items-center gap-2 text-xs font-medium text-accent-primary hover:underline"
            >
              Manage payment links →
            </Link>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default withAuth(ReceivePage)
