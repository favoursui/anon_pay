'use client'

import { withAuth } from '@/components/layout/withAuth'
import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { motion } from 'framer-motion'
import { Button, Card, PageHeader, Skeleton } from '@/components/ui'
import { User, Wallet, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import type { UserPrivate } from '@/lib/api'
import { shortenAddress } from '@/lib/utils'

function ProfilePage() {
  // Use Privy directly — getAccessToken() fresh each time, no hook wrapper
  const { user, ready, getAccessToken } = usePrivy()
  const [profile, setProfile] = useState<UserPrivate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const hasFetched = useRef(false)  // prevent double-fetch in StrictMode

  const [form, setForm] = useState({
    username: '',
    wallet_address: '',
    display_name: '',
    bio: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load profile once when Privy is ready
  useEffect(() => {
    if (!ready || hasFetched.current) return
    hasFetched.current = true

    async function load() {
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('No token')
        const me = await api.getMe(token)
        setProfile(me)
        setForm({
          username: me.username,
          wallet_address: '',
          display_name: me.display_name || '',
          bio: me.bio || '',
        })
        setIsNew(false)
      } catch {
        setIsNew(true)
        const wallet = user?.wallet?.address || ''
        setForm(f => ({ ...f, wallet_address: wallet }))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [ready]) // only depend on ready — intentionally omitting others to prevent loop

  // Auto-fill wallet when Privy creates the embedded wallet
  useEffect(() => {
    if (isNew && user?.wallet?.address && !form.wallet_address) {
      setForm(f => ({ ...f, wallet_address: user.wallet!.address }))
    }
  }, [user?.wallet?.address, isNew]) // eslint-disable-line

  function validate() {
    const e: Record<string, string> = {}
    if (isNew) {
      if (!form.username.trim()) {
        e.username = 'Username is required'
      } else if (!/^[a-z0-9_]{3,32}$/.test(form.username)) {
        e.username = 'Lowercase letters, numbers and _ only (3–32 chars)'
      }
      if (!form.wallet_address.trim()) {
        e.wallet_address = 'Wallet address is required'
      } else if (!form.wallet_address.startsWith('0x') || form.wallet_address.length !== 42) {
        e.wallet_address = 'Must be a valid EVM address (0x… 42 chars)'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Not authenticated — please log in again')

      if (isNew) {
        const created = await api.register(token, {
          username: form.username,
          wallet_address: form.wallet_address,
          display_name: form.display_name || undefined,
          bio: form.bio || undefined,
        })
        setProfile(created)
        setIsNew(false)
        toast.success('Profile created! Welcome to AnonPay 🎉')
      } else {
        const updated = await api.updateMe(token, {
          display_name: form.display_name || undefined,
          bio: form.bio || undefined,
        })
        setProfile(updated)
        toast.success('Profile updated!')
      }
    } catch (err: unknown) {
      let msg = 'Failed to save profile'
      if (err && typeof err === 'object') {
        const e = err as { response?: { data?: { detail?: string } }; message?: string }
        msg = e?.response?.data?.detail || e?.message || msg
      }
      console.error('Profile save error:', err)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Profile" />
        <div className="max-w-lg space-y-4">
          <Card className="p-6 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'Set Up Profile' : 'Profile Settings'}
        subtitle={
          isNew
            ? 'Choose a username and confirm your wallet to get started.'
            : 'Update your display name and bio.'
        }
      />

      <div className="max-w-lg space-y-4">
        {/* Existing account info */}
        {!isNew && profile && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5">
              <div className="text-xs text-text-muted font-medium mb-4">ACCOUNT INFO</div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-accent-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-text-muted">Username</div>
                    <div className="font-mono font-bold text-accent-primary">@{profile.username}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-secondary/10 flex items-center justify-center flex-shrink-0">
                    <Shield size={14} className="text-accent-secondary" />
                  </div>
                  <div>
                    <div className="text-xs text-text-muted">Privy DID</div>
                    <div className="font-mono text-xs text-text-secondary">
                      {profile.privy_did.slice(0, 32)}…
                    </div>
                  </div>
                </div>
                {user?.wallet?.address && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                      <Wallet size={14} className="text-accent-purple" />
                    </div>
                    <div>
                      <div className="text-xs text-text-muted">Wallet (encrypted at rest)</div>
                      <div className="font-mono text-xs text-text-secondary">
                        {shortenAddress(user.wallet.address)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6">
            <div className="text-xs text-text-muted font-medium mb-5">
              {isNew ? 'CREATE YOUR PROFILE' : 'EDIT PROFILE'}
            </div>
            <div className="space-y-4">
              {isNew && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-text-secondary">Username</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-primary font-mono text-sm">@</span>
                      <input
                        className="input-focus w-full bg-bg-secondary border border-border-default rounded-xl pl-7 pr-4 py-3 text-sm text-text-primary placeholder-text-muted"
                        placeholder="yourname"
                        value={form.username}
                        onChange={e => setForm(f => ({
                          ...f,
                          username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        }))}
                      />
                    </div>
                    {errors.username && <p className="text-xs text-red-400">{errors.username}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-text-secondary">
                      Wallet Address
                      {user?.wallet?.address && (
                        <span className="ml-2 text-accent-primary text-xs">(auto-filled)</span>
                      )}
                    </label>
                    <input
                      className="input-focus w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted font-mono"
                      placeholder="0x..."
                      value={form.wallet_address}
                      onChange={e => setForm(f => ({ ...f, wallet_address: e.target.value.trim() }))}
                    />
                    {errors.wallet_address && <p className="text-xs text-red-400">{errors.wallet_address}</p>}
                    <p className="text-xs text-text-muted">
                      Encrypted immediately — never stored or exposed in plaintext.
                    </p>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary">Display Name (optional)</label>
                <input
                  className="input-focus w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted"
                  placeholder="Your Name"
                  value={form.display_name}
                  onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary">Bio (optional)</label>
                <input
                  className="input-focus w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted"
                  placeholder="A short bio…"
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                />
              </div>

              <Button onClick={handleSave} loading={saving} className="w-full" size="lg">
                {isNew ? 'Create Profile' : 'Save Changes'}
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default withAuth(ProfilePage)