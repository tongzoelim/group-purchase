import './globals.css'
import type { Metadata } from 'next'
import Header from '@/components/Header'

export const metadata: Metadata = {
  title: '공동구매 포털',
  description: '학생 공동구매 및 편의 서비스',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Header />
        <div className="max-w-4xl mx-auto p-6">{children}</div>
      </body>
    </html>
  )
}
