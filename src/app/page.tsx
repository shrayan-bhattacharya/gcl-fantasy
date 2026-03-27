import { redirect } from 'next/navigation'

// Root "/" always redirects — middleware handles auth check
export default function RootPage() {
  redirect('/login')
}
