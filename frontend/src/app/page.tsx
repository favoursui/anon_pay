'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Shield, Zap, Eye, Lock } from 'lucide-react'

export default function LandingPage() {
  const { login, authenticated, ready } = usePrivy()
  const router = useRouter()

  useEffect(() => {
    if (ready && authenticated) router.push('/dashboard')
  }, [ready, authenticated, router])

  return (
    <main className="min-h-screen bg-bg-primary bg-grid overflow-hidden">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-accent-primary opacity-[0.04] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent-secondary opacity-[0.05] blur-[100px]" />
        <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] rounded-full bg-accent-purple opacity-[0.03] blur-[80px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <img src="/anonpay-logo.svg" alt="AnonPay" className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-lg tracking-tight">AnonPay</span>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={login}
          className="btn-press flex items-center gap-2 px-5 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-sm font-medium hover:border-accent-primary/40 hover:text-accent-primary transition-all duration-200"
        >
          Launch App <ArrowRight size={14} />
        </motion.button>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-elevated border border-border-default text-xs text-text-secondary mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
          Non-custodial · Privacy-first · On-chain
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-6xl md:text-8xl font-extrabold tracking-tight leading-none mb-6"
        >
          Pay anyone <br />
          <span className="text-accent-primary text-glow-green">by username.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-text-secondary max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Send USDC to <span className="text-text-primary font-mono">@anyone</span> without ever exposing wallet addresses.
          Privacy-preserving payments on Arc network.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-4 flex-wrap"
        >
          <button
            onClick={login}
            className="btn-press flex items-center gap-2 px-8 py-4 rounded-2xl bg-accent-primary text-bg-primary font-bold text-base hover:bg-accent-primary/90 transition-all duration-200 glow-green"
          >
            Get Started <ArrowRight size={16} />
          </button>
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-press px-8 py-4 rounded-2xl bg-bg-elevated border border-border-default font-medium text-base hover:border-border-strong transition-all duration-200"
          >
            Learn more
          </button>
        </motion.div>

        {/* Mock UI preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-20 relative"
        >
          <div className="glass rounded-3xl p-6 max-w-sm mx-auto border border-border-subtle glow-green">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-accent-primary/20 flex items-center justify-center">
                <Zap size={16} className="text-accent-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">Send USDC</div>
                <div className="text-xs text-text-muted">Instant · Private</div>
              </div>
            </div>
            <div className="bg-bg-secondary rounded-xl p-3 mb-3 border border-border-subtle">
              <div className="text-xs text-text-muted mb-1">To</div>
              <div className="font-mono text-accent-primary text-sm">@favour</div>
            </div>
            <div className="bg-bg-secondary rounded-xl p-3 mb-4 border border-border-subtle">
              <div className="text-xs text-text-muted mb-1">Amount</div>
              <div className="text-2xl font-bold">50.00 <span className="text-sm text-text-muted">USDC</span></div>
            </div>
            <div className="w-full py-3 rounded-xl bg-accent-primary text-bg-primary font-bold text-sm text-center">
              Send Payment
            </div>
          </div>
          {/* Decorative lines */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent-primary/10 to-transparent" />
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-3xl font-bold text-center mb-16"
        >
          Built for privacy. Built for people.
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: <Shield size={20} />,
              title: 'Non-custodial',
              desc: 'Your keys, your USDC. We never touch your funds.',
              color: 'text-accent-primary',
              bg: 'bg-accent-primary/10',
            },
            {
              icon: <Eye size={20} />,
              title: 'Privacy-first',
              desc: 'Wallet addresses never appear in URLs or responses.',
              color: 'text-accent-secondary',
              bg: 'bg-accent-secondary/10',
            },
            {
              icon: <Zap size={20} />,
              title: 'Instant',
              desc: 'On-chain transfers on Base. Confirmed in seconds.',
              color: 'text-accent-purple',
              bg: 'bg-accent-purple/10',
            },
            {
              icon: <Lock size={20} />,
              title: 'Encrypted',
              desc: 'Wallet addresses encrypted at rest. Resolved server-side only.',
              color: 'text-accent-orange',
              bg: 'bg-accent-orange/10',
            },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6 border border-border-subtle hover:border-border-default transition-all duration-300"
            >
              <div className={`w-10 h-10 rounded-xl ${f.bg} ${f.color} flex items-center justify-center mb-4`}>
                {f.icon}
              </div>
              <h3 className="font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-subtle px-6 py-8 text-center text-text-muted text-sm">
        <div className="flex items-center justify-center gap-2">
          <a href="http://x.com/anonpayxyz" className="text-green-200 hover:text-accent-primary">Anonpay</a> · Private USDC Payments · Built on <a href="http://x.com/arc" className="text-green-200 hover:text-accent-primary">Arc</a>
        </div>
      </footer>
    </main>
  )
}
