import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ShieldCheck, Calendar, Users, BarChart2, RefreshCw, UserCog } from 'lucide-react'

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: ShieldCheck },
  { href: '/admin/sync', label: 'ESPN Sync', icon: RefreshCw },
  { href: '/admin/matches', label: 'Matches', icon: Calendar },
  { href: '/admin/players', label: 'Players', icon: Users },
  { href: '/admin/results', label: 'Enter Results', icon: BarChart2 },
  { href: '/admin/users', label: 'Users', icon: UserCog },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="flex min-h-screen bg-dark-base pitch-bg">
      {/* Admin sidebar */}
      <aside className="w-52 shrink-0 glass border-r border-dark-border flex flex-col py-4 sticky top-0 h-screen">
        <div className="px-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neon-orange/20 border border-neon-orange/40 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-neon-orange" />
            </div>
            <div>
              <p className="text-sm font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>Admin Panel</p>
              <p className="text-[10px] text-dark-muted">IPL Fantasy 2026</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {ADMIN_NAV.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-muted hover:text-white hover:bg-white/5 transition-all">
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
          <Link href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-muted hover:text-white hover:bg-white/5 transition-all mt-4">
            ← Back to App
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  )
}
