'use client'

import { withAuth } from '@/components/layout/withAuth'
import { useAnonPay } from '@/hooks/useAnonPay'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, PageHeader, Skeleton, StatusBadge } from '@/components/ui'
import { formatUSDC, timeAgo, shortenTxHash, getChainExplorer } from '@/lib/utils'
import { ArrowUpRight, ArrowDownLeft, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Transaction, PaginatedTransactions } from '@/lib/api'
import { useAnonPay as useAnonPayHook } from '@/hooks/useAnonPay'

function HistoryPage() {
  const { getHistory, getMe } = useAnonPay()
  const [data, setData] = useState<PaginatedTransactions | null>(null)
  const [username, setUsername] = useState<string>('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe().then(u => setUsername(u.username)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    getHistory(page, 15)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1

  return (
    <div>
      <PageHeader
        title="Transaction History"
        subtitle={data ? `${data.total} total transactions` : undefined}
      />

      <Card>
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 border-b border-border-subtle text-xs text-text-muted font-medium">
          <div className="col-span-2">Transaction</div>
          <div className="text-right">Amount</div>
          <div className="text-center">Status</div>
          <div className="text-right">Time</div>
        </div>

        <div className="divide-y divide-border-subtle">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))
          ) : !data || data.items.length === 0 ? (
            <div className="py-16 text-center text-text-muted text-sm">
              No transactions yet.
            </div>
          ) : data.items.map((tx, i) => {
            const isSender = tx.sender_username === username
            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4 items-center px-4 sm:px-5 py-4 hover:bg-bg-elevated/40 transition-colors"
              >
                {/* Who */}
                <div className="col-span-2 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isSender ? 'bg-red-400/10' : 'bg-accent-primary/10'
                  }`}>
                    {isSender
                      ? <ArrowUpRight size={15} className="text-red-400" />
                      : <ArrowDownLeft size={15} className="text-accent-primary" />
                    }
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {isSender ? `To @${tx.recipient_username}` : `From @${tx.sender_username || 'anon'}`}
                    </div>
                    {tx.note && (
                      <div className="text-xs text-text-muted truncate">{tx.note}</div>
                    )}
                    {tx.tx_hash && (
                      <a
                        href={getChainExplorer(tx.chain, tx.tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-text-muted hover:text-accent-primary transition-colors flex items-center gap-1"
                      >
                        {shortenTxHash(tx.tx_hash)} <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className={`text-sm font-bold sm:text-right ${isSender ? 'text-red-400' : 'text-accent-primary'}`}>
                  {isSender ? '-' : '+'}{formatUSDC(tx.amount_usdc)} USDC
                </div>

                {/* Status */}
                <div className="sm:flex sm:justify-center">
                  <StatusBadge status={tx.status} />
                </div>

                {/* Time */}
                <div className="text-xs text-text-muted sm:text-right">
                  {timeAgo(tx.created_at)}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-border-subtle">
            <span className="text-xs text-text-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-bg-elevated border border-border-default disabled:opacity-30 hover:border-border-strong transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-bg-elevated border border-border-default disabled:opacity-30 hover:border-border-strong transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default withAuth(HistoryPage)
