'use client'

import { withAuth } from '@/components/layout/withAuth'
import { useAnonPay } from '@/hooks/useAnonPay'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button, Card, PageHeader } from '@/components/ui'
import { useWalletClient } from 'wagmi'
import { parseUnits, encodeFunctionData } from 'viem'
import { ArrowUpRight, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { getChainExplorer } from '@/lib/utils'

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const ERC20_ABI = [{
  name: 'transfer', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ type: 'bool' }],
}] as const

type Step = 'form' | 'signing' | 'confirming' | 'done'

function SendForm() {
  const searchParams = useSearchParams()
  const { initiatePayment, confirmPayment } = useAnonPay()
  const { data: walletClient } = useWalletClient()
  const [step, setStep] = useState<Step>('form')
  const [form, setForm] = useState({
    username: searchParams.get('to') || '',
    amount:   searchParams.get('amount') || '',
    note: '', chain: 'base',
  })
  const paymentLinkSlug = searchParams.get('slug') || undefined
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ txHash: string; amount: string; recipient: string } | null>(null)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.username.trim()) e.username = 'Username is required'
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Enter a valid amount'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSend() {
    if (!validate() || !walletClient) {
      if (!walletClient) toast.error('No wallet connected')
      return
    }
    setStep('signing')
    try {
      const initiated = await initiatePayment({
        recipient_username: form.username.replace('@', ''),
        amount_usdc: form.amount, chain: form.chain,
        note: form.note || undefined,
        payment_link_slug: paymentLinkSlug,
      })
      toast.loading('Waiting for wallet signature…', { id: 'sign' })
      const calldata = encodeFunctionData({
        abi: ERC20_ABI, functionName: 'transfer',
        args: [initiated.recipient_wallet as `0x${string}`, parseUnits(form.amount, 6)],
      })
      const txHash = await walletClient.sendTransaction({ to: USDC_BASE, data: calldata })
      toast.dismiss('sign')
      toast.success('Transaction broadcast!', { id: 'bc' })
      setStep('confirming')
      await confirmPayment(initiated.tx_id, txHash)
      setResult({ txHash, amount: form.amount, recipient: form.username.replace('@', '') })
      setStep('done')
      toast.success('Payment confirmed! 🎉', { id: 'bc' })
    } catch (err: any) {
      setStep('form')
      toast.error(err?.response?.data?.detail || err?.shortMessage || err?.message || 'Payment failed')
    }
  }

  if (step === 'done' && result) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto">
        <Card className="p-10 text-center">
          <div className="w-20 h-20 rounded-3xl bg-accent-primary/10 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={36} className="text-accent-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Payment Sent!</h2>
          <p className="text-accent-primary font-bold text-xl mb-1">{result.amount} USDC</p>
          <p className="text-text-secondary text-sm mb-6">
            sent to <span className="font-mono text-text-primary">@{result.recipient}</span>
          </p>
          <a href={getChainExplorer(form.chain, result.txHash)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent-primary transition-colors mb-6 px-4 py-2 rounded-xl bg-bg-elevated border border-border-subtle">
            View on explorer <ExternalLink size={13} />
          </a>
          <Button variant="secondary" className="w-full"
            onClick={() => { setStep('form'); setForm({ username:'', amount:'', note:'', chain:'base' }); setResult(null) }}>
            Send another
          </Button>
        </Card>
      </motion.div>
    )
  }

  const isBusy = step === 'signing' || step === 'confirming'
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md">
      <Card className="p-6 space-y-5">
        {/* Recipient */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-text-secondary">Recipient</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-primary font-mono text-sm">@</span>
            <input className="input-focus w-full bg-bg-secondary border border-border-default rounded-xl pl-7 pr-4 py-3 text-sm text-text-primary placeholder-text-muted"
              placeholder="username" value={form.username.replace('@', '')} disabled={isBusy}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          {errors.username && <p className="text-xs text-red-400">{errors.username}</p>}
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-text-secondary">Amount (USDC)</label>
          <div className="relative">
            <input type="number" min="0" step="0.01" placeholder="0.00" disabled={isBusy}
              className="input-focus w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-2xl font-bold text-text-primary placeholder-text-muted"
              value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">USDC</span>
          </div>
          {errors.amount && <p className="text-xs text-red-400">{errors.amount}</p>}
        </div>

        {/* Network */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-text-secondary">Network</label>
          <div className="grid grid-cols-2 gap-2">
            {['base', 'arc'].map(chain => (
              <button key={chain} disabled={isBusy} onClick={() => setForm(f => ({ ...f, chain }))}
                className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${
                  form.chain === chain ? 'border-accent-primary/50 bg-accent-primary/10 text-accent-primary'
                  : 'border-border-default bg-bg-secondary text-text-secondary hover:border-border-strong'}`}>
                {chain === 'base' ? '🔵 Base' : '🟣 ARC'}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-text-secondary">Note (optional)</label>
          <input className="input-focus w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted"
            placeholder="What's this for?" disabled={isBusy}
            value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>

        {/* Summary */}
        {form.amount && parseFloat(form.amount) > 0 && form.username && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-bg-secondary rounded-xl p-4 border border-accent-primary/20 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">To</span>
              <span className="font-mono text-accent-primary font-medium">@{form.username.replace('@','')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Amount</span>
              <span className="font-bold">{form.amount} USDC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Network</span>
              <span className="capitalize">{form.chain}</span>
            </div>
          </motion.div>
        )}

        {!walletClient && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/20 text-xs text-yellow-400">
            <AlertCircle size={13} /> No wallet connected. Connect one via your Privy account to send.
          </div>
        )}

        <Button onClick={handleSend} loading={isBusy} className="w-full" size="lg" disabled={!walletClient}>
          {step === 'signing' ? 'Waiting for signature…' : step === 'confirming' ? 'Confirming on-chain…' :
            <><ArrowUpRight size={16} /> Send Payment</>}
        </Button>
      </Card>
    </motion.div>
  )
}

function SendPage() {
  return (
    <div>
      <PageHeader title="Send USDC" subtitle="Pay anyone by @username — wallet addresses stay private." />
      <Suspense fallback={<div className="text-text-muted text-sm">Loading…</div>}>
        <SendForm />
      </Suspense>
    </div>
  )
}

export default withAuth(SendPage)
