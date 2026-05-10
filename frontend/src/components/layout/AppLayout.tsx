'use client'

import { usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Send, Download, History,
  Link as LinkIcon, User, LogOut, Menu, X
} from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const NAV = [
  { href: '/dashboard',       label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/send',            label: 'Send',            icon: Send },
  { href: '/receive',         label: 'Receive',         icon: Download },
  { href: '/history',         label: 'History',         icon: History },
  { href: '/payment-links',   label: 'Payment Links',   icon: LinkIcon },
  { href: '/profile',         label: 'Profile',         icon: User },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = usePrivy()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-bg-primary">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-border-subtle bg-bg-secondary fixed h-full z-20">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-border-subtle">
          <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center flex-shrink-0">
            <span className="text-bg-primary font-bold text-sm font-mono">A</span>
          </div>
          <span className="font-bold text-base tracking-tight">AnonPay</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                pathname === href
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t border-border-subtle">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-secondary hover:text-red-400 hover:bg-red-400/5 transition-all w-full"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-bg-secondary border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-primary flex items-center justify-center">
            <span className="text-bg-primary font-bold text-xs font-mono">A</span>
          </div>
          <span className="font-bold text-sm">AnonPay</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-bg-elevated transition-colors">
          <Menu size={18} />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 z-40"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-bg-secondary border-r border-border-subtle z-50 flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent-primary flex items-center justify-center">
                    <span className="text-bg-primary font-bold text-xs font-mono">A</span>
                  </div>
                  <span className="font-bold text-sm">AnonPay</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-bg-elevated">
                  <X size={16} />
                </button>
              </div>
              <nav className="flex-1 px-3 py-3 space-y-0.5">
                {NAV.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                      pathname === href
                        ? 'bg-accent-primary/10 text-accent-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="px-3 py-3 border-t border-border-subtle">
                <button
                  onClick={logout}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-secondary hover:text-red-400 w-full"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
