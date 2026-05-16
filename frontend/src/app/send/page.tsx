'use client'

import { withAuth } from '@/components/layout/withAuth'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useState, Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button, Card, PageHeader } from '@/components/ui'
import { createWalletClient, createPublicClient, custom, http, parseUnits, defineChain } from 'viem'
import { ArrowUpRight, CheckCircle2, ExternalLink, AlertCircle, Loader2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'

// Chain config — all from .env
const ARC_CHAIN = defineChain({
  id: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '5042002'),
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || 'ARC Testnet',
  nativeCurrency: {
    // USDC is the native token on ARC
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_CHAIN_RPC_URL || ''] },
  },
  blockExplorers: {
    default: {
      name: 'ARC Explorer',
      url: process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL || '',
    },
  },
  testnet: true,
})

const EXPLORER_URL = process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL || ''

type Step = 'form' | 'signing' | 'confirming' | 'done'

function SendForm() {
  const searchParams = useSearchParams()
  const { getAccessToken, linkWallet } = usePrivy()
  const { wallets } = useWallets()
  const [step, setStep] = useState<Step>('form')
  const isSending = useRef(false)
  const [form, setForm] = useState({
    username: searchParams.get('to') || '',
    amount: searchParams.get('amount') || '',
    note: '',
  })
  const paymentLinkSlug = searchParams.get('slug') || undefined
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ txHash: string; amount: string; recipient: string } | null>(null)
  const [walletsReady, setWalletsReady] = useState(false)

  const activeWallet = wallets[0]

  useEffect(() => {
    const timer = setTimeout(() => setWalletsReady(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.username.trim()) e.username = 'Username is required'
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Enter a valid amount'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSend() {
    if (isSending.current) return
    if (!validate()) return
    if (!activeWallet) {
      toast.error('No wallet connected.')
      return
    }

    isSending.current = true
    setStep('signing')

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Not authenticated')

      // Step 1 - backend resolves @username → wallet (private, server-side)
      const initiated = await api.initiatePayment(token, {
        recipient_username: form.username.replace('@', ''),
        amount_usdc: form.amount,
        chain: 'arc',
        note: form.note || undefined,
        payment_link_slug: paymentLinkSlug,
      })

      // Step 2 - add ARC chain to wallet then switch to it
      toast.loading('Adding ARC network…', { id: 'tx' })
      const provider = await activeWallet.getEthereumProvider()

      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${ARC_CHAIN.id.toString(16)}`,
            chainName: ARC_CHAIN.name,
            nativeCurrency: ARC_CHAIN.nativeCurrency,
            rpcUrls: [process.env.NEXT_PUBLIC_CHAIN_RPC_URL || ''],
            blockExplorerUrls: [EXPLORER_URL],
          }],
        })
      } catch (chainErr: any) {
        console.warn('Chain add warning (may already exist):', chainErr?.message)
      }

      // Step 3 - send as native value transfer (USDC is native on ARC)
      toast.loading('Waiting for wallet signature…', { id: 'tx' })

      const walletClient = createWalletClient({
        chain: ARC_CHAIN,
        transport: custom(provider),
      })

      const publicClient = createPublicClient({
        chain: ARC_CHAIN,
        transport: http(process.env.NEXT_PUBLIC_CHAIN_RPC_URL),
      })

      const [address] = await walletClient.getAddresses()

      // Amount in native units (6 decimals since USDC)
      const value = parseUnits(form.amount, 18)

      // Estimate gas for native transfer
      let gasEstimate: bigint
      try {
        gasEstimate = await publicClient.estimateGas({
          account: address,
          to: initiated.recipient_wallet as `0x${string}`,
          value,
        })
        gasEstimate = (gasEstimate * 120n) / 100n // +20% buffer
      } catch {
        gasEstimate = 21000n // standard native transfer gas
      }

      // Native value transfer - no contract call needed
      const txHash = await walletClient.sendTransaction({
        account: address,
        to: initiated.recipient_wallet as `0x${string}`,
        value,
        gas: gasEstimate,
        chain: ARC_CHAIN,
      })

      toast.loading('Confirming on-chain…', { id: 'tx' })

      // Step 4 - confirm with backend
      setStep('confirming')
      await api.confirmPayment(token, initiated.tx_id, txHash)

      toast.dismiss('tx')
      setResult({ txHash, amount: form.amount, recipient: form.username.replace('@', '') })
      setStep('done')
      toast.success('Payment confirmed! 🎉')

    } catch (err: any) {
      toast.dismiss('tx')
      setStep('form')
      const msg =
        err?.response?.data?.detail ||
        err?.shortMessage ||
        err?.details ||
        err?.message ||
        'Payment failed'
      toast.error(msg)
      console.error('Send error:', err)
    } finally {
      isSending.current = false
    }
  }

  // Success screen 
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
          {EXPLORER_URL && (
            <a href={`${EXPLORER_URL}/tx/${result.txHash}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent-primary transition-colors mb-6 px-4 py-2 rounded-xl bg-bg-elevated border border-border-subtle">
              View on Explorer <ExternalLink size={13} />
            </a>
          )}
          <Button variant="secondary" className="w-full"
            onClick={() => { setStep('form'); setForm({ username: '', amount: '', note: '' }); setResult(null) }}>
            Send another
          </Button>
        </Card>
      </motion.div>
    )
  }

  const isBusy = step === 'signing' || step === 'confirming'
  const hasWallet = walletsReady && !!activeWallet

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md">

      {/* Network banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle text-xs text-text-muted mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary animate-pulse" />
        <span>Network: <span className="text-text-primary font-medium">{ARC_CHAIN.name}</span></span>
        <span className="text-border-strong">·</span>
        <span>Native token: <span className="text-text-primary font-medium">USDC</span></span>
        {EXPLORER_URL && (
          <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer"
            className="ml-auto hover:text-accent-primary transition-colors">
            Explorer →
          </a>
        )}
      </div>

      <Card className="p-6 space-y-5">

        {/* Recipient */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-text-secondary">Recipient</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-primary font-mono text-sm">@</span>
            <input
              className="input-focus w-full bg-bg-secondary border border-border-default rounded-xl pl-7 pr-4 py-3 text-sm text-text-primary placeholder-text-muted"
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

        {/* Note */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-text-secondary">Note (optional)</label>
          <input
            className="input-focus w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted"
            placeholder="What's this for?" disabled={isBusy}
            value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>

        {/* Summary */}
        {form.amount && parseFloat(form.amount) > 0 && form.username && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-bg-secondary rounded-xl p-4 border border-accent-primary/20 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">To</span>
              <span className="font-mono text-accent-primary font-medium">@{form.username.replace('@', '')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Amount</span>
              <span className="font-bold">{form.amount} USDC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Gas</span>
              <span className="text-text-secondary">Paid in USDC (native)</span>
            </div>
          </motion.div>
        )}

        {/* Wallet */}
        {!walletsReady ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-bg-elevated border border-border-subtle text-xs text-text-muted">
            <Loader2 size={13} className="animate-spin" /> Loading wallet…
          </div>
        ) : !hasWallet ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/20 text-xs text-yellow-400">
              <AlertCircle size={13} /> No wallet connected.
            </div>
            <button onClick={() => linkWallet()}
              className="btn-press w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-bg-elevated border border-border-default text-sm font-medium hover:border-accent-primary/40 hover:text-accent-primary transition-all">
              <Wallet size={15} /> Connect Wallet
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-xl bg-accent-primary/5 border border-accent-primary/20">
            <div className="flex items-center gap-2 text-xs text-accent-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
              {activeWallet.address.slice(0, 6)}…{activeWallet.address.slice(-4)}
              <span className="text-text-muted capitalize">({activeWallet.walletClientType})</span>
            </div>
            <button onClick={() => linkWallet()}
              className="text-xs text-text-muted hover:text-accent-primary transition-colors px-2 py-1 rounded-lg hover:bg-bg-elevated">
              + Add wallet
            </button>
          </div>
        )}

        <Button onClick={handleSend} loading={isBusy} className="w-full" size="lg" disabled={!hasWallet || isBusy}>
          {step === 'signing' ? 'Waiting for signature…' :
           step === 'confirming' ? 'Confirming on-chain…' :
           <><ArrowUpRight size={16} /> Send Payment</>}
        </Button>

      </Card>
    </motion.div>
  )
}

function SendPage() {
  return (
    <div>
      <PageHeader title="Send USDC" subtitle="Pay anyone by @username | wallet addresses stay private." />
      <Suspense fallback={<div className="text-text-muted text-sm">Loading…</div>}>
        <SendForm />
      </Suspense>
    </div>
  )
}

export default withAuth(SendPage)