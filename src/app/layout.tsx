import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/Providers'

export const metadata: Metadata = {
  title: 'GCL Fantasy',
  description: 'GreyChain League Fantasy Cricket — Predictions + Fantasy Team',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'GCL Fantasy',
    description: 'Predict matches, build your squad, climb the leaderboard.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Prevent flash of wrong theme on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('gcl-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full bg-dark-base text-white antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
