import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'AnonPay — Private USDC Payments',
  description: 'Send and receive USDC privately via usernames. No wallet addresses exposed.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a1a1a',
                color: '#f5f5f5',
                border: '1px solid #2a2a2a',
                fontFamily: 'var(--font-syne)',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#00ff87', secondary: '#080808' } },
              error:   { iconTheme: { primary: '#f87171', secondary: '#080808' } },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
