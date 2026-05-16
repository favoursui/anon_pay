// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUSDC(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,  // always show 2 decimal places max
  }).format(num)
}

export function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function shortenTxHash(hash: string): string {
  if (!hash) return ''
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

// https://testnet.arcscan.app/tx/
export function getChainExplorer(chain: string, txHash: string): string {
  const explorerUrl = process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL || ''
  if (!explorerUrl || !txHash) return '#'
  return `${explorerUrl}/tx/${txHash}`
}
