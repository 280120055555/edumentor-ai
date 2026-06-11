import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'

// Правильный импорт для файлов в одной папке
import './globals.css'

import { LanguageProvider } from '@/lib/language-context'
import { NavigationProvider } from '@/lib/navigation-context'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'EduMentor AI - Академический помощник студента',
  description: 'Интеллектуальная AI платформа для студентов',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#4d8ee6',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.className} font-sans antialiased`}>
        <NavigationProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </NavigationProvider>
        <Analytics />
      </body>
    </html>
  )
}