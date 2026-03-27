'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, Trash2, ShieldCheck, ShieldOff, Loader2, X, UserCog,
} from 'lucide-react'
import type { Database } from '@/types/database.types'

type UserRow = Database['public']['Tables']['users']['Row']

export default function AdminUsers() {
  const supabase = createClient()
  const [users, setUsers] = useState<UserRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null)

  // Add user form state
  const [addEmail, setAddEmail] = useState('')
  const [addName, setAddName] = useState('')
  const [addRole, setAddRole] = useState<'user' | 'admin'>('user')
  const [addError, setAddError] = useState('')
  const addEmailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadUsers() }, [])
  useEffect(() => { if (showAdd) setTimeout(() => addEmailRef.current?.focus(), 50) }, [showAdd])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('id, display_name, email, role, created_at, total_score, prediction_score, fantasy_score')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  const filtered = users.filter(u => {
    const q = query.toLowerCase()
    return !q || u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  })

  async function toggleRole(u: UserRow) {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    setActionId(u.id)
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, role: newRole } : p))
      flash(`${u.display_name ?? u.email} is now ${newRole}`)
    } else {
      const { error } = await res.json()
      flash(`Error: ${error}`)
    }
    setActionId(null)
  }

  async function deleteUser() {
    if (!confirmDelete) return
    const u = confirmDelete
    setConfirmDelete(null)
    setActionId(u.id)
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(prev => prev.filter(p => p.id !== u.id))
      flash(`${u.display_name ?? u.email} deleted`)
    } else {
      const text = await res.text()
      let errorMsg = `HTTP ${res.status}`
      try { errorMsg = JSON.parse(text).error ?? errorMsg } catch { errorMsg = text || errorMsg }
      flash(`Error: ${errorMsg}`)
    }
    setActionId(null)
  }

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  function resetAddForm() {
    setAddEmail('')
    setAddName('')
    setAddRole('user')
    setAddError('')
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    startTransition(async () => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail, display_name: addName || undefined, role: addRole }),
      })
      if (res.ok) {
        setShowAdd(false)
        resetAddForm()
        await loadUsers()
        flash('User created — they can log in via Google or reset their password')
      } else {
        const { error } = await res.json()
        setAddError(error)
      }
    })
  }

  const inputCls = 'w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-dark-muted/40 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-all'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            User Management
          </h1>
          <p className="text-sm text-dark-muted mt-1">
            {users.length} users registered
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); resetAddForm() }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neon-blue text-white text-sm font-bold hover:bg-neon-blue/90 transition-colors"
          style={{ boxShadow: '0 0 16px rgba(0,102,204,0.3)' }}
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Flash message */}
      {msg && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-neon-blue/10 border border-neon-blue/20 text-neon-blue text-sm">
          {msg}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className={`${inputCls} pl-10`}
        />
      </div>

      {/* Users table */}
      <div className="glass rounded-xl border border-dark-border">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-white/5 text-[11px] font-semibold text-dark-muted uppercase tracking-wider">
          <span>User</span>
          <span className="text-right w-20">Score</span>
          <span className="text-right w-20">Role</span>
          <span className="text-right w-28">Actions</span>
        </div>

        <div className="divide-y divide-white/5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-dark-muted">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-dark-muted text-sm">
              {query ? 'No users match your search' : 'No users yet'}
            </div>
          ) : (
            filtered.map(u => {
              const isActing = actionId === u.id
              return (
                <div key={u.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3">
                  {/* User info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-neon-blue/20 border border-neon-blue/30 flex items-center justify-center text-xs font-bold text-neon-blue shrink-0">
                      {(u.display_name?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {u.display_name ?? <span className="text-dark-muted italic">No name</span>}
                      </p>
                      <p className="text-[11px] text-dark-muted truncate">{u.email}</p>
                      <p className="text-[10px] text-dark-muted/60">
                        Joined {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right w-20">
                    <p className="text-sm font-bold text-neon-gold">{u.total_score}</p>
                    <p className="text-[10px] text-dark-muted">pts</p>
                  </div>

                  {/* Role badge */}
                  <div className="text-right w-20">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-neon-orange/10 text-neon-orange border border-neon-orange/20 font-medium">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </span>
                    ) : (
                      <span className="text-xs text-dark-muted">User</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5 w-28">
                    {isActing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-dark-muted" />
                    ) : (
                      <>
                        <button
                          onClick={() => toggleRole(u)}
                          title={u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                          className="p-1.5 rounded-lg border border-dark-border text-dark-muted hover:text-neon-orange hover:border-neon-orange/30 transition-colors"
                        >
                          {u.role === 'admin'
                            ? <ShieldOff className="w-3.5 h-3.5" />
                            : <ShieldCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u)}
                          title="Delete user"
                          className="p-1.5 rounded-lg border border-dark-border text-dark-muted hover:text-red-400 hover:border-red-500/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark-base" onClick={() => setShowAdd(false)} />
          <div className="relative glass rounded-2xl border border-neon-blue/20 p-6 w-full max-w-sm"
            style={{ boxShadow: '0 0 60px rgba(0,102,204,0.12)' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-neon-blue/20 border border-neon-blue/30 flex items-center justify-center">
                  <UserCog className="w-4 h-4 text-neon-blue" />
                </div>
                <h2 className="text-base font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Add User
                </h2>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-dark-muted hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-dark-muted mb-1.5">Email *</label>
                <input
                  ref={addEmailRef}
                  type="email"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  required
                  placeholder="colleague@company.com"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-dark-muted mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="Full name (optional)"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-dark-muted mb-1.5">Role</label>
                <select
                  value={addRole}
                  onChange={e => setAddRole(e.target.value as 'user' | 'admin')}
                  className={`${inputCls} appearance-none`}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {addError && (
                <p className="text-red-400 text-xs px-1">{addError}</p>
              )}

              <p className="text-[11px] text-dark-muted">
                A temporary password is auto-generated. The user can sign in via Google or use "Forgot password" to set their own.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-dark-border text-dark-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-neon-blue text-white disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark-base" onClick={() => setConfirmDelete(null)} />
          <div className="relative glass rounded-2xl border border-red-500/20 p-6 w-full max-w-sm"
            style={{ boxShadow: '0 0 40px rgba(239,68,68,0.1)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Delete User</h2>
                <p className="text-xs text-dark-muted">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-dark-muted mb-1">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">
                {confirmDelete.display_name ?? confirmDelete.email}
              </span>?
            </p>
            <p className="text-xs text-red-400/80 mb-5">
              This will delete all their predictions and fantasy teams too.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-dark-border text-dark-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteUser}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
