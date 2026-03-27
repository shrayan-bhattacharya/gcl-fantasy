'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, Plus, CheckCircle, Loader2, Clock, UserCheck } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Invite = Database['public']['Tables']['invites']['Row']

export default function AdminInvites() {
  const supabase = createClient()
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState<string | null>(null)
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: inv }, { data: usr }] = await Promise.all([
      supabase.from('invites').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('id, display_name, email, created_at, role, total_score').order('created_at', { ascending: false }),
    ])
    setInvites(inv ?? [])
    setUsers(usr ?? [])
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const { data: me } = await supabase.auth.getUser()
      await supabase.from('invites').insert({ invited_email: email, invited_by: me.user?.id ?? null })
      setEmail('')
      loadData()
    })
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  async function promoteToAdmin(userId: string) {
    if (!confirm('Promote this user to admin?')) return
    await supabase.from('users').update({ role: 'admin' }).eq('id', userId)
    loadData()
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Invites & Users</h1>
      <p className="text-sm text-dark-muted mb-6">Generate invite links for new players. Share the link — they sign up and are automatically accepted.</p>

      {/* Generate invite */}
      <div className="glass rounded-xl border border-dark-border p-5 mb-6">
        <h2 className="text-sm font-bold text-white mb-3">Generate Invite Link</h2>
        <form onSubmit={createInvite} className="flex gap-3">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="colleague@company.com"
            className="flex-1 bg-dark-elevated border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-green/50"
          />
          <button type="submit" disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-gold/10 text-neon-gold border border-neon-gold/20 text-sm font-bold hover:bg-neon-gold/20 transition-colors disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate
          </button>
        </form>
      </div>

      {/* Invite list */}
      <div className="glass rounded-xl border border-dark-border mb-6">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-bold text-white">Invite Links ({invites.length})</h2>
        </div>
        <div className="divide-y divide-white/5">
          {invites.map(inv => {
            const isUsed = !!inv.used_at
            const isExpired = !isUsed && new Date(inv.expires_at) < new Date()
            const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inv.token}`
            return (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{inv.invited_email}</p>
                  <p className="text-[10px] text-dark-muted font-mono truncate mt-0.5">/invite/{inv.token.slice(0, 16)}…</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isUsed ? (
                    <span className="flex items-center gap-1 text-xs text-neon-green px-2 py-0.5 rounded-lg bg-neon-green/10 border border-neon-green/20">
                      <UserCheck className="w-3 h-3" /> Used
                    </span>
                  ) : isExpired ? (
                    <span className="flex items-center gap-1 text-xs text-red-400 px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <Clock className="w-3 h-3" /> Expired
                    </span>
                  ) : (
                    <button onClick={() => copyLink(inv.token)}
                      className="flex items-center gap-1.5 text-xs text-neon-cyan px-2.5 py-1.5 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 hover:bg-neon-cyan/20 transition-colors"
                    >
                      {copied === inv.token ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === inv.token ? 'Copied!' : 'Copy Link'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {invites.length === 0 && (
            <div className="px-4 py-8 text-center text-dark-muted text-sm">No invites generated yet</div>
          )}
        </div>
      </div>

      {/* User list */}
      <div className="glass rounded-xl border border-dark-border">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-bold text-white">Registered Users ({users.length})</h2>
        </div>
        <div className="divide-y divide-white/5">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center text-xs font-bold text-neon-green shrink-0">
                {(u.display_name?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{u.display_name ?? u.email}</p>
                <p className="text-[10px] text-dark-muted">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <span className="text-neon-gold font-bold">{u.total_score} pts</span>
                {u.role === 'admin' ? (
                  <span className="px-2 py-0.5 rounded-lg bg-neon-orange/10 text-neon-orange border border-neon-orange/20 font-medium">Admin</span>
                ) : (
                  <button onClick={() => promoteToAdmin(u.id)}
                    className="px-2 py-0.5 rounded-lg bg-white/5 text-dark-muted border border-dark-border hover:text-neon-orange hover:border-neon-orange/30 transition-colors font-medium"
                  >
                    Make Admin
                  </button>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="px-4 py-8 text-center text-dark-muted text-sm">No users registered yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
