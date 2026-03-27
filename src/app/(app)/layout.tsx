import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('display_name, role, total_score, prediction_score, fantasy_score')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen bg-dark-base pitch-bg">
      <Sidebar
        userRole={profile?.role}
        displayName={profile?.display_name ?? user.email?.split('@')[0]}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          displayName={profile?.display_name ?? user.email?.split('@')[0]}
          email={user.email}
          totalScore={profile?.total_score ?? 0}
        />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
