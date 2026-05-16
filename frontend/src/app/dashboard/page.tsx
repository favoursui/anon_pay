'use client'

import { withAuth } from '@/components/layout/withAuth'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { createPublicClient, http, defineChain, formatUnits } from 'viem'
import { motion } from 'framer-motion'
import { Card, Skeleton, StatusBadge } from '@/components/ui'
import { formatUSDC, timeAgo, getChainExplorer } from '@/lib/utils'
import type { UserPrivate, Transaction } from '@/lib/api'
import { ArrowUpRight, ArrowDownLeft, Copy, ExternalLink, TrendingUp, Wallet, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

// Chain from env
const ARC_CHAIN = defineChain({
  id: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1633'),
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || 'ARC Testnet',
  nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_CHAIN_RPC_URL || ''] },
  },
})

async function fetchUSDCBalance(walletAddress: string): Promise<string> {
  if (!walletAddress) return '0'
  try {
    const client = createPublicClient({
      chain: ARC_CHAIN,
      transport: http(process.env.NEXT_PUBLIC_CHAIN_RPC_URL),
    })
    // USDC is the native token on ARC — use getBalance, not readContract
    const balance = await client.getBalance({
      address: walletAddress as `0x${string}`,
    })
    const raw = formatUnits(balance, 18)  // 6 decimals
    return parseFloat(raw).toFixed(2)
  } catch {
    return '0'
  }
}

async function fetchUSDCPrice(): Promise<number> {
  // USDC is always ~$1 but fetch real price for accuracy
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd',
      { next: { revalidate: 300 } }
    )
    const data = await res.json()
    return data?.['usd-coin']?.usd ?? 1
  } catch {
    return 1 // fallback
  }
}

function DashboardPage() {
  const { ready, getAccessToken } = usePrivy()
  const { wallets } = useWallets()
  const [profile, setProfile] = useState<UserPrivate | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null)
  const [usdcPrice, setUsdcPrice] = useState<number>(1)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const didLoad = useRef(false)

  const activeWallet = wallets[0]

  // Load profile + transactions once
  useEffect(() => {
    if (!ready || didLoad.current) return
    didLoad.current = true
    let cancelled = false

    async function load() {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const [me, history] = await Promise.all([
          api.getMe(token),
          api.getHistory(token, 1, 5),
        ])
        if (cancelled) return
        setProfile(me)
        setTxs(history.items)
      } catch {
        // not registered yet
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [ready]) // eslint-disable-line

  // Load wallet balance whenever wallet becomes available
  useEffect(() => {
    if (!activeWallet?.address) return
    let cancelled = false

    async function loadBalance() {
      setBalanceLoading(true)
      try {
        const [balance, price] = await Promise.all([
          fetchUSDCBalance(activeWallet.address),
          fetchUSDCPrice(),
        ])
        if (!cancelled) {
          setUsdcBalance(balance)
          setUsdcPrice(price)
        }
      } catch {
        if (!cancelled) setUsdcBalance('0')
      } finally {
        if (!cancelled) setBalanceLoading(false)
      }
    }
    loadBalance()
    return () => { cancelled = true }
  }, [activeWallet?.address]) // eslint-disable-line

  async function refreshBalance() {
    if (!activeWallet?.address) return
    setBalanceLoading(true)
    try {
      const [balance, price] = await Promise.all([
        fetchUSDCBalance(activeWallet.address),
        fetchUSDCPrice(),
      ])
      setUsdcBalance(balance)
      setUsdcPrice(price)
      toast.success('Balance refreshed')
    } catch {
      toast.error('Failed to refresh balance')
    } finally {
      setBalanceLoading(false)
    }
  }

  const usdcNum = parseFloat(usdcBalance || '0')
  const usdValue = (usdcNum * usdcPrice).toFixed(2)

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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <p className="text-text-muted text-sm mb-1">Welcome back</p>
        {loading ? <Skeleton className="h-8 w-48" /> : (
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {profile?.display_name || `@${profile?.username}`}
            </h1>
            <button onClick={copyUsername}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-bg-elevated border border-border-subtle text-xs text-text-muted hover:text-text-primary transition-colors">
              <span className="font-mono text-accent-primary">@{profile?.username}</span>
              <Copy size={11} />
            </button>
          </div>
        )}
      </motion.div>

      {/* Wallet Balance Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
        <Card className="p-6 bg-gradient-to-br from-bg-card to-bg-elevated border-accent-primary/10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={14} className="text-text-muted" />
                <span className="text-xs text-text-muted">Wallet Balance</span>
                {activeWallet && (
                  <span className="text-xs text-text-muted font-mono">
                    ({activeWallet.address.slice(0,6)}…{activeWallet.address.slice(-4)})
                  </span>
                )}
              </div>
              {balanceLoading || usdcBalance === null ? (
                <Skeleton className="h-10 w-40 mb-1" />
              ) : (
                <>
                  <div className="text-4xl font-extrabold tracking-tight">
                    {formatUSDC(usdcNum)}
                    <span className="text-lg text-text-muted font-normal ml-2">USDC</span>
                  </div>
                  <div className="text-text-secondary text-sm mt-1">
                    ≈ <span className="font-semibold text-text-primary">${usdValue} USD</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={refreshBalance}
                disabled={balanceLoading}
                className="p-2 rounded-xl bg-bg-elevated border border-border-subtle hover:border-accent-primary/30 transition-all disabled:opacity-40"
                title="Refresh balance"
              >
                <RefreshCw size={13} className={balanceLoading ? 'animate-spin text-accent-primary' : 'text-text-muted'} />
              </button>
              {!activeWallet && (
                <div className="text-xs text-text-muted text-right">No wallet<br/>connected</div>
              )}
            </div>
          </div>

          {/* Quick send/receive */}
          <div className="grid grid-cols-2 gap-2 mt-5">
            <Link href="/send" className="btn-press flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent-primary text-bg-primary font-semibold text-sm hover:bg-accent-primary/90 transition-all">
              <ArrowUpRight size={15} /> Send
            </Link>
            <Link href="/receive" className="btn-press flex items-center justify-center gap-2 py-2.5 rounded-xl bg-bg-elevated border border-border-default font-semibold text-sm hover:border-border-strong transition-all">
              <ArrowDownLeft size={15} /> Receive
            </Link>
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Sent',     value: loading ? null : `$${formatUSDC(totalSent)}`,     icon: <ArrowUpRight size={16} className="text-red-400" />,        bg: 'bg-red-400/5',          delay: 0.1 },
          { label: 'Total Received', value: loading ? null : `$${formatUSDC(totalReceived)}`, icon: <ArrowDownLeft size={16} className="text-accent-primary" />, bg: 'bg-accent-primary/5',   delay: 0.2 },
          { label: 'Transactions',   value: loading ? null : String(txs.length),              icon: <TrendingUp size={16} className="text-accent-secondary" />,  bg: 'bg-accent-secondary/5', delay: 0.3 },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: stat.delay }}>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-text-muted">{stat.label}</span>
                <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center`}>{stat.icon}</div>
              </div>
              {stat.value === null
                ? <Skeleton className="h-7 w-24" />
                : <div className="text-xl font-bold">{stat.value}</div>}
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent transactions */}
      <Card>
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <h2 className="font-semibold text-sm">Recent Transactions</h2>
          <Link href="/history" className="text-xs text-text-muted hover:text-accent-primary transition-colors">View all →</Link>
        </div>
        <div className="divide-y divide-border-subtle">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))
          ) : txs.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">
              No transactions yet.{' '}
              <Link href="/send" className="text-accent-primary hover:underline">Send your first payment</Link>
            </div>
          ) : txs.map((tx, i) => {
            const isSender = tx.sender_username === profile?.username
            return (
              <motion.div key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-4 hover:bg-bg-elevated/50 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isSender ? 'bg-red-400/10' : 'bg-accent-primary/10'}`}>
                  {isSender ? <ArrowUpRight size={16} className="text-red-400" /> : <ArrowDownLeft size={16} className="text-accent-primary" />}
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
                  <a href={getChainExplorer(tx.chain, tx.tx_hash)} target="_blank" rel="noopener noreferrer"
                    className="ml-1 text-text-muted hover:text-accent-primary transition-colors">
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