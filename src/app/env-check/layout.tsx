export const dynamic = 'force-dynamic'

export default function Layout({ children }: { children: React.ReactNode }) {
  // 헤더 없이, 이 페이지에 한해서만 미니 레이아웃
  return (
    <html lang="ko">
      <body>
        <div style={{maxWidth: 720, margin: '0 auto', padding: 16}}>{children}</div>
      </body>
    </html>
  )
}
