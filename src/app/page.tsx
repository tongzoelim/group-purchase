'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Profile = { name: string | null; student_id: string | null }
type OrderRow = {
  id: string
  status: 'draft' | 'submitted'
  total_qty: number
  total_amount: number
  updated_at: string
  roundsTitle: string | null   // ← 단일 문자열로 정규화
}
type Round = { id: string; title: string; deadline: string; status: 'open' | 'closed' }

export default function Dashboard() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [rounds, setRounds] = useState<Round[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setError(null)

      // 세션 확인
      const { data: { user }, error: uErr } = await supabase.auth.getUser()
      if (uErr || !user) {
        setIsAuthed(false)
        setLoading(false)
        return
      }
      setIsAuthed(true)

      // 병렬 로딩
      const p1 = supabase
        .from('profiles')
        .select('name, student_id')
        .eq('id', user.id)
        .single()

      // 최근 주문 5개 (라운드 제목 포함) — rounds(title)는 배열일 수도 있으니 정규화 필요
      const p2 = supabase
        .from('orders')
        .select('id, status, total_qty, total_amount, updated_at, rounds(title)')
        .order('updated_at', { ascending: false })
        .limit(5)

      // 열린 회차 최대 3개
      const p3 = supabase
        .from('rounds')
        .select('id, title, deadline, status')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(3)

      const [pRes, oRes, rRes] = await Promise.all([p1, p2, p3])

      if (pRes.error) setError(pRes.error.message)
      else setProfile(pRes.data)

      if (oRes.error) {
        setError(oRes.error.message)
      } else {
        const rows = (oRes.data ?? []).map((o: any): OrderRow => {
          // rounds 가 배열로 오기도, 객체로 오기도 함 → 단일 제목으로 정규화
          let roundsTitle: string | null = null
          if (Array.isArray(o.rounds)) {
            roundsTitle = o.rounds[0]?.title ?? null
          } else if (o.rounds && typeof o.rounds === 'object') {
            roundsTitle = o.rounds.title ?? null
          }
          return {
            id: String(o.id),
            status: (o.status ?? 'draft') as 'draft' | 'submitted',
            total_qty: Number(o.total_qty ?? 0),
            total_amount: Number(o.total_amount ?? 0),
            updated_at: String(o.updated_at ?? new Date().toISOString()),
            roundsTitle,
          }
        })
        setOrders(rows)
      }

      if (rRes.error) setError(rRes.error.message)
      else setRounds(rRes.data ?? [])

      setLoading(false)
    }

    init()

    // 로그인/로그아웃 실시간 반영
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) {
        setIsAuthed(false)
        setProfile(null)
        setOrders(null)
      } else {
        ;(async () => {
          const { data } = await supabase
            .from('profiles')
            .select('name, student_id')
            .eq('id', session.user.id)
            .single()
          setProfile(data ?? null)
        })()
        setIsAuthed(true)
      }
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  if (loading) {
    return <main className="p-6">로딩 중…</main>
  }

  // 미로그인 화면
  if (isAuthed === false) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold mb-2">대시보드</h1>
        <p className="text-gray-700 mb-6">로그인이 필요한 서비스입니다.</p>
        <div className="flex gap-3">
          <Link href="/login" className="rounded bg-black text-white px-4 py-2">로그인</Link>
          <Link href="/signup" className="rounded border px-4 py-2">회원가입</Link>
        </div>

        <section className="mt-10">
          <h2 className="font-semibold mb-2">열린 회차 미리보기</h2>
          <OpenRoundsPreview />
        </section>
      </main>
    )
  }

  // 로그인 상태 화면
  return (
    <main className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">대시보드</h1>
      {error && <p className="text-red-600">{error}</p>}

      {/* 내 정보 */}
      <section className="rounded border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">내 정보</h2>
          <Link href="/me" className="text-sm underline">자세히 보기</Link>
        </div>
        <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
          <div>이름: <span className="font-medium">{profile?.name ?? '-'}</span></div>
          <div>학번: <span className="font-medium">{profile?.student_id ?? '-'}</span></div>
        </div>
      </section>

      {/* 내 주문 상태 */}
      <section className="rounded border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">내 주문 상태</h2>
          <Link href="/rounds" className="text-sm underline">회차 선택하기</Link>
        </div>
        {orders && orders.length > 0 ? (
          <ul className="mt-3 divide-y">
            {orders.map(o => (
              <li key={o.id} className="py-2 flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.roundsTitle ?? '회차'}</div>
                  <div className="text-gray-600">
                    수량 {o.total_qty} · 금액 {o.total_amount.toLocaleString()}원 · {o.status === 'submitted' ? '제출됨' : '작성중'}
                  </div>
                </div>
                <div className="text-xs text-gray-500">{new Date(o.updated_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-600">최근 주문이 없습니다.</p>
        )}
      </section>

      {/* 회차 목록(열린 회차) */}
      <section className="rounded border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">열린 회차</h2>
          <Link href="/rounds" className="text-sm underline">모두 보기</Link>
        </div>
        {rounds && rounds.length > 0 ? (
          <ul className="mt-3 grid md:grid-cols-3 gap-3">
            {rounds.map(r => (
              <li key={r.id} className="rounded border p-3">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-gray-600 mt-1">마감: {new Date(r.deadline).toLocaleString()}</div>
                <Link href={`/rounds/${r.id}`} className="mt-2 inline-block text-sm underline">참여하기</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-600">현재 열린 회차가 없습니다.</p>
        )}
      </section>
    </main>
  )
}

function OpenRoundsPreview() {
  const [items, setItems] = useState<Round[] | null>(null)
  useEffect(() => {
    supabase.from('rounds')
      .select('id, title, deadline, status')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setItems(data ?? []))
  }, [])
  if (!items || items.length === 0) return <p className="text-sm text-gray-600">열린 회차가 없습니다.</p>
  return (
    <ul className="grid md:grid-cols-3 gap-3">
      {items.map(r => (
        <li key={r.id} className="rounded border p-3">
          <div className="font-medium">{r.title}</div>
          <div className="text-xs text-gray-600 mt-1">마감: {new Date(r.deadline).toLocaleString()}</div>
        </li>
      ))}
    </ul>
  )
}
