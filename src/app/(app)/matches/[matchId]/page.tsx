import { redirect } from 'next/navigation'

// Individual match page — redirect back to matches list for now
export default function MatchDetailPage() {
  redirect('/matches')
}
