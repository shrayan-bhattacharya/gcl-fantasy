'use client'

import { motion } from 'framer-motion'
import { useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Loader2, CheckCircle } from 'lucide-react'

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const supabase = createClient()

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Sign up user
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (signupError) {
      // Try sign in if already exists
      const { error: signinError } = await supabase.auth.signInWithPassword({ email, password })
      if (signinError) { setError(signupError.message); setLoading(false); return }
    }

    // Accept invite via RPC
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: accepted } = await (supabase as any).rpc('accept_invite', {
      invite_token: token,
      user_email: email,
    })

    if (!accepted) {
      setError('Invalid or expired invite link.')
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-dark-base flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5 }}
            className="text-neon-green text-6xl mb-4 flex justify-center"
          >
            <CheckCircle className="w-16 h-16" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Welcome to IPL Fantasy!
          </h2>
          <p className="text-dark-muted">Redirecting to your dashboard…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-base flex items-center justify-center p-6 stadium-bg">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏏</div>
          <h1 className="text-2xl font-black text-white mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
            You&apos;re Invited!
          </h1>
          <p className="text-dark-muted text-sm">Create your account to join the IPL Fantasy league</p>
        </div>

        <div className="glass rounded-2xl p-6">
          <form onSubmit={handleAccept} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-dark-muted mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="your@email.com"
                  className="w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-2.5 pl-10 text-white text-sm placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark-muted mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-2.5 pl-10 text-white text-sm placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20 transition-all"
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <motion.button
              type="submit" disabled={loading}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl text-sm font-bold text-dark-base bg-neon-green disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ boxShadow: '0 0 24px rgba(57,255,20,0.4)' }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Join the League
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
