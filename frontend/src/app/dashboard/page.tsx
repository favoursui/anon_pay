'use client'

import { withAuth } from '@/components/layout/withAuth'
import { useAnonPay } from '@/hooks/useAnonPay'
import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, Skeleton, StatusBadge } from '@/components/ui'
import { formatUSDC, timeAgo, getChainExplorer } from '@/lib/utils'
import type { UserPrivate, Transaction } from '@/lib/api'
import { ArrowUpRight, ArrowDownLeft, Copy, ExternalLink, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

function DashboardPage() {
  const { getMe, getHistory } = useAnonPay()
  const [profile, setProfile] = useState<UserPrivate | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [me, history] = await Promise.all([getMe(), getHistory(1, 5)])
      setProfile(me)
      setTxs(history.items)
    } catch {
      // user may not be registered yet
    } finally {
      setLoading(false)
    }
  }, [getMe, getHistory])

  useEffect(() => { load() }, [load])

  const totalSent = txs
    .filter(t => t.sender_username === profile?.username && t.status === 'confirmed')
    .reduce((sum, t) => sum + parseFloat(t.amount_usdc), 0)

  const totalReceived = txs
    .filter(t => t.recipient_username === profile?.username && t.status === 'confirmed')
    .reduce((sum, t) => sum + parseFloat(t.amount_usdc), 0)

  function copyUsername() {
    if (profile?.username) {
      navigator.clipboard.writeText(`@${profile.username}`)
      toast.success('Username copied!')
    }
  }

  if (!profile && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 flex items-center justify-center mb-4">
          <span className="text-3xl">👋</span>
        </div>
        <h2 className="text-xl font-bold mb-2">Welcome to AnonPay</h2>
        <p className="text-text-secondary text-sm mb-6">Set up your profile to start sending and receiving USDC</p>
        <Link href="/profile" className="btn-press px-6 py-3 rounded-xl bg-accent-primary text-bg-primary font-bold text-sm">
          Set up profile
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="text-text-muted text-sm mb-1">Welcome back</p>
        {loading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {profile?.display_name || `@${profile?.username}`}
            </h1>
            <button
              onClick={copyUsername}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-bg-elevated border border-border-subtle text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <span className="font-mono text-accent-primary">@{profile?.username}</span>
              <Copy size={11} />
            </button>
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: 'Total Sent',
            value: loading ? null : `$${formatUSDC(totalSent)}`,
            icon: <ArrowUpRight size={16} className="text-red-400" />,
            bg: 'bg-red-400/5',
            delay: 0.1,
          },
          {
            label: 'Total Received',
            value: loading ? null : `$${formatUSDC(totalReceived)}`,
            icon: <ArrowDownLeft size={16} className="text-accent-primary" />,
            bg: 'bg-accent-primary/5',
            delay: 0.2,
          },
          {
            label: 'Transactions',
            value: loading ? null : String(txs.length),
            icon: <TrendingUp size={16} className="text-accent-secondary" />,
            bg: 'bg-accent-secondary/5',
            delay: 0.3,
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: stat.delay }}
          >
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-text-muted">{stat.label}</span>
                <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  {stat.icon}
                </div>
              </div>
              {stat.value === null ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <div className="text-xl font-bold">{stat.value}</div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Link href="/send">
          <Card className="p-5 hover:border-accent-primary/30 hover:bg-accent-primary/5 transition-all duration-200 cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-accent-primary/10 flex items-center justify-center mb-3 group-hover:bg-accent-primary/20 transition-colors">
              <ArrowUpRight size={18} className="text-accent-primary" />
            </div>
            <div className="font-semibold text-sm">Send USDC</div>
            <div className="text-xs text-text-muted mt-0.5">Pay by username</div>
          </Card>
        </Link>
        <Link href="/receive">
          <Card className="p-5 hover:border-accent-secondary/30 hover:bg-accent-secondary/5 transition-all duration-200 cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-accent-secondary/10 flex items-center justify-center mb-3 group-hover:bg-accent-secondary/20 transition-colors">
              <ArrowDownLeft size={18} className="text-accent-secondary" />
            </div>
            <div className="font-semibold text-sm">Receive USDC</div>
            <div className="text-xs text-text-muted mt-0.5">Share your address</div>
          </Card>
        </Link>
      </div>

      {/* Recent transactions */}
      <Card>
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <h2 className="font-semibold text-sm">Recent Transactions</h2>
          <Link href="/history" className="text-xs text-text-muted hover:text-accent-primary transition-colors">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-border-subtle">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))
          ) : txs.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">
              No transactions yet.{' '}
              <Link href="/send" className="text-accent-primary hover:underline">
                Send your first payment
              </Link>
            </div>
          ) : txs.map((tx, i) => {
            const isSender = tx.sender_username === profile?.username
            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-4 hover:bg-bg-elevated/50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isSender ? 'bg-red-400/10' : 'bg-accent-primary/10'
                }`}>
                  {isSender
                    ? <ArrowUpRight size={16} className="text-red-400" />
                    : <ArrowDownLeft size={16} className="text-accent-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {isSender ? `To @${tx.recipient_username}` : `From @${tx.sender_username || 'unknown'}`}
                  </div>
                  <div className="text-xs text-text-muted">{timeAgo(tx.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${isSender ? 'text-red-400' : 'text-accent-primary'}`}>
                    {isSender ? '-' : '+'}{formatUSDC(tx.amount_usdc)} USDC
                  </div>
                  <StatusBadge status={tx.status} />
                </div>
                {tx.tx_hash && (
                  <a
                    href={getChainExplorer(tx.chain, tx.tx_hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-text-muted hover:text-accent-primary transition-colors"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </motion.div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

export default withAuth(DashboardPage)