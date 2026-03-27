'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Loader2 } from 'lucide-react'
import type { Variants } from 'framer-motion'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 250, damping: 25 } },
}

// Floating geometric shapes for background
const SHAPES = [
  { size: 120, x: '10%',  y: '15%', delay: 0,   dur: 18 },
  { size: 80,  x: '75%',  y: '8%',  delay: 2,   dur: 22 },
  { size: 200, x: '85%',  y: '60%', delay: 1,   dur: 26 },
  { size: 60,  x: '20%',  y: '75%', delay: 3,   dur: 20 },
  { size: 140, x: '55%',  y: '40%', delay: 1.5, dur: 24 },
  { size: 50,  x: '40%',  y: '85%', delay: 4,   dur: 16 },
]

function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const supabase = createClient()

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push(next)
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${next}` }
      })
      if (error) { setError(error.message); setLoading(false); return }
      if (data.session) {
        router.push(next)
        return
      }
      setSuccess('Check your email for a confirmation link!')
    }
    setLoading(false)
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=${next}` }
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-dark-base overflow-hidden">
      {/* Left panel — hero */}
      <motion.div
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex flex-1 relative items-center justify-center p-12 overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(0,102,204,0.1) 0%, transparent 65%)' }}
      >
        {/* Floating geometric shapes */}
        {SHAPES.map((shape, i) => (
          <motion.div
            key={i}
            className="absolute rounded-2xl border border-neon-blue/10"
            style={{
              width: shape.size,
              height: shape.size,
              left: shape.x,
              top: shape.y,
              rotate: i * 15,
            }}
            animate={{
              y: [0, -20, 0],
              x: [0, 10, 0],
              rotate: [i * 15, i * 15 + 30, i * 15],
              opacity: [0.06, 0.12, 0.06],
            }}
            transition={{
              duration: shape.dur,
              delay: shape.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Rotating rings */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-neon-blue/5"
            style={{ width: `${(i + 1) * 220}px`, height: `${(i + 1) * 220}px` }}
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 25 + i * 12, repeat: Infinity, ease: 'linear' }}
          />
        ))}

        <div className="relative z-10 text-center max-w-sm">
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="text-8xl mb-6"
          >
            🏏
          </motion.div>
          <h1 className="text-4xl font-black text-white mb-2 leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            GCL Fantasy
          </h1>
          <p className="gradient-text text-xl font-bold mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
            GreyChain League
          </p>
          <p className="text-dark-muted text-sm leading-relaxed mt-3">
            Predict matches. Build your squad.<br />
            Climb the leaderboard. Win glory.
          </p>

          {/* Stats row */}
          <div className="flex justify-center gap-8 mt-8">
            {[
              { label: 'Matches', value: '74' },
              { label: 'Players', value: '200+' },
              { label: 'Prize', value: '🏆' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>{stat.value}</p>
                <p className="text-xs text-dark-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* GreyChain branding pill */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="inline-flex items-center gap-2 mt-8 px-4 py-2 rounded-full glass border border-neon-blue/20"
          >
            <div className="w-2 h-2 rounded-full bg-neon-blue animate-pulse" />
            <span className="text-xs text-dark-muted">
              Powered by <span className="text-neon-blue font-semibold">GreyChain AI</span>
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Right panel — auth form */}
      <div className="flex-1 lg:max-w-md flex flex-col items-center justify-center p-6 lg:p-12 relative">
        {/* Mobile logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden text-center mb-8"
        >
          <div className="text-5xl mb-3">🏏</div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            GCL Fantasy
          </h1>
          <p className="text-xs text-dark-muted mt-1">by <span className="text-neon-blue">GreyChain AI</span></p>
        </motion.div>

        {/* Glassmorphic card */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm glass rounded-2xl border border-neon-blue/15 p-6"
          style={{ boxShadow: '0 0 60px rgba(0,102,204,0.08), 0 24px 48px rgba(0,0,0,0.3)' }}
        >
          {/* Mode tabs */}
          <motion.div variants={itemVariants} className="flex gap-1 p-1 bg-dark-card rounded-xl border border-dark-border mb-6">
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className="relative flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-200"
                style={{ color: mode === m ? '#ffffff' : '#8892a4' }}
              >
                {mode === m && (
                  <motion.div
                    layoutId="auth-tab"
                    className="absolute inset-0 bg-neon-blue rounded-lg"
                    style={{ boxShadow: '0 0 20px rgba(0,102,204,0.4)' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{m === 'login' ? 'Sign In' : 'Sign Up'}</span>
              </button>
            ))}
          </motion.div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-medium text-dark-muted mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@greychain.ai"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-4 py-2.5 pl-10 text-white text-sm placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-all duration-200"
                />
              </div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <label className="block text-xs font-medium text-dark-muted mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-4 py-2.5 pl-10 text-white text-sm placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-all duration-200"
                />
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  key="error"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="text-red-400 text-xs px-1"
                >
                  {error}
                </motion.p>
              )}
              {success && (
                <motion.p
                  key="success"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="text-neon-green text-xs px-1"
                >
                  {success}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div variants={itemVariants}>
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-neon-blue disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                style={{ boxShadow: '0 0 24px rgba(0,102,204,0.4)' }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </motion.button>
            </motion.div>
          </form>

          {/* Divider */}
          <motion.div variants={itemVariants} className="relative flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-dark-border" />
            <span className="text-xs text-dark-muted px-1">or</span>
            <div className="flex-1 h-px bg-dark-border" />
          </motion.div>

          {/* Google */}
          <motion.div variants={itemVariants}>
            <motion.button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl text-sm font-medium text-white glass border border-dark-border hover:border-white/20 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-60"
            >
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </motion.button>
          </motion.div>

          <motion.p variants={itemVariants} className="text-center text-xs text-dark-muted mt-6">
            This is a private contest — invite only.
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}

export default function LoginPageWrapper() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  )
}
