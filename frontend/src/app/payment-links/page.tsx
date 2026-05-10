'use client'

import { withAuth } from '@/components/layout/withAuth'
import { useAnonPay } from '@/hooks/useAnonPay'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button, Input, Textarea, Card, PageHeader, Skeleton } from '@/components/ui'
import { Plus, Copy, Trash2, ToggleLeft, ToggleRight, ExternalLink, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { PaymentLink } from '@/lib/api'
import { formatUSDC, timeAgo } from '@/lib/utils'

function PaymentLinksPage() {
  const { getMyPaymentLinks, createPaymentLink, updatePaymentLink, deletePaymentLink } = useAnonPay()
  const [links, setLinks] = useState<PaymentLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ slug: '', amount_usdc: '', note: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function load() {
    try {
      const data = await getMyPaymentLinks()
      setLinks(data)
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.slug.trim()) e.slug = 'Slug is required'
    else if (!/^[a-z0-9\-_]{3,64}$/.test(form.slug)) e.slug = 'Only lowercase letters, numbers, - and _'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCreate() {
    if (!validate()) return
    setCreating(true)
    try {
      await createPaymentLink({
        slug: form.slug,
        amount_usdc: form.amount_usdc || undefined,
        note: form.note || undefined,
      })
      toast.success('Payment link created!')
      setForm({ slug: '', amount_usdc: '', note: '' })
      setShowCreate(false)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create link')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggle(link: PaymentLink) {
    try {
      await updatePaymentLink(link.slug, { is_active: !link.is_active })
      setLinks(ls => ls.map(l => l.id === link.id ? { ...l, is_active: !l.is_active } : l))
      toast.success(link.is_active ? 'Link deactivated' : 'Link activated')
    } catch {
      toast.error('Failed to update link')
    }
  }

  async function handleDelete(link: PaymentLink) {
    if (!confirm(`Delete /${link.slug}?`)) return
    try {
      await deletePaymentLink(link.slug)
      setLinks(ls => ls.filter(l => l.id !== link.id))
      toast.success('Link deleted')
    } catch {
      toast.error('Failed to delete link')
    }
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/pay/${slug}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied!')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <PageHeader title="Payment Links" subtitle="Create shareable links with fixed amounts." />
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus size={14} /> New Link
        </Button>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-bg-card border border-border-default rounded-2xl p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold">Create Payment Link</h2>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-bg-elevated">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <Input
                  label="Slug (URL path)"
                  placeholder="my-link"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))}
                  error={errors.slug}
                />
                <div className="text-xs text-text-muted -mt-2">
                  Link will be: <span className="font-mono text-accent-primary">/pay/{form.slug || 'my-link'}</span>
                </div>
                <Input
                  label="Fixed amount in USDC (optional)"
                  type="number"
                  placeholder="Leave empty for open amount"
                  value={form.amount_usdc}
                  onChange={e => setForm(f => ({ ...f, amount_usdc: e.target.value }))}
                />
                <Input
                  label="Note (optional)"
                  placeholder="What's this payment for?"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setShowCreate(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} loading={creating} className="flex-1">
                    Create Link
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Links list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </Card>
          ))}
        </div>
      ) : links.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-bg-elevated mx-auto mb-3 flex items-center justify-center">
            <Plus size={20} className="text-text-muted" />
          </div>
          <div className="text-text-secondary text-sm mb-4">No payment links yet</div>
          <Button onClick={() => setShowCreate(true)} size="sm">Create your first link</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((link, i) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={`p-5 ${!link.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-accent-primary">/pay/{link.slug}</span>
                      {!link.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-bg-elevated text-text-muted border border-border-subtle">
                          inactive
                        </span>
                      )}
                    </div>
                    {link.amount_usdc && (
                      <div className="text-sm text-text-secondary">
                        Fixed: <span className="font-bold text-text-primary">{formatUSDC(link.amount_usdc)} USDC</span>
                      </div>
                    )}
                    {link.note && (
                      <div className="text-xs text-text-muted mt-1 truncate">{link.note}</div>
                    )}
                    <div className="text-xs text-text-muted mt-1">{timeAgo(link.created_at)}</div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => copyLink(link.slug)}
                      className="p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-muted hover:text-text-primary"
                      title="Copy link"
                    >
                      <Copy size={14} />
                    </button>
                    <a
                      href={`/pay/${link.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-muted hover:text-text-primary"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => handleToggle(link)}
                      className="p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-muted hover:text-text-primary"
                      title={link.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {link.is_active ? <ToggleRight size={14} className="text-accent-primary" /> : <ToggleLeft size={14} />}
                    </button>
                    <button
                      onClick={() => handleDelete(link)}
                      className="p-2 rounded-lg hover:bg-red-400/10 transition-colors text-text-muted hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

export default withAuth(PaymentLinksPage)
