import type { Metadata } from 'next'
import { Inter, Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'KaamKart - Connect with Labor Workers',
  description: 'Platform connecting labor workers with end users',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${notoSansDevanagari.variable} font-sans`}>
        <ErrorBoundary>
          <LanguageProvider>
            {children}
            <Toaster 
              position="top-right"
              reverseOrder={false}
              gutter={8}
              toastOptions={{
                duration: 4000,
                error: {
                  duration: 5000,
                  style: {
                    background: '#fee2e2',
                    color: '#991b1b',
                  },
                },
                style: {
                  borderRadius: '10px',
                  background: '#fff',
                  color: '#363636',
                },
              }}
              containerStyle={{
                top: 20,
                right: 20,
              }}
            />
          </LanguageProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}

