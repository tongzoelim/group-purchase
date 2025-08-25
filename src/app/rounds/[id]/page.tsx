'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Round = { id: string; title: string; deadline: string; status: 'open' | 'closed' }

type AvailabilityRow = {
  product_id: string
  round_id: string
  name: string
  price: number
  stock_remaining: number            // 현재 “다른 사람들 포함” 남은 수량 (내 주문분 제외)
}

type OrderItem = { product_id: string; qty: number; unit_price: number }
type ExistingOrder = {
  id: string
  status: 'submitted'
  order_items: OrderItem[] | null
}

export default function RoundDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [round, setRound] = useState<Round | null>(null)

  const [rows, setRows] = useState<AvailabilityRow[]>([])             // 현재 회차의 상품 & 남은 수량
  const [qty, setQty] = useState<Record<string, number>>({})          // 화면에 표시되는 수량(입력값)

  const [prevQty, setPrevQty] = useState<Record<string, number>>({})  // “내가 예전에 제출한 수량” 맵
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 가격 맵 (제출 payload 구성용)
  const priceMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) m[r.product_id] = r.price
    return m
  }, [rows])

  // 합계
  const totalQty = useMemo(
    () => Object.values(qty).reduce((a, b) => a + (b || 0), 0),
    [qty]
  )
  const totalAmount = useMemo(
    () =>
      Object.entries(qty).reduce(
        (sum, [pid, q]) => sum + (q || 0) * (priceMap[pid] || 0),
        0
      ),
    [qty, priceMap]
  )

  // 초기 로딩: 회차/상품/기존 제출 주문
  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // 1) 로그인 확인 + 유저
        const { data: userRes } = await supabase.auth.getUser()
        if (!userRes.user) {
          router.replace('/login')
          return
        }

        // 2) 회차 정보
        const r1 = await supabase
          .from('rounds')
          .select('id,title,deadline,status')
          .eq('id', String(id))
          .single()
        if (r1.error) throw r1.error
        setRound(r1.data as Round)

        // 3) 가용 수량(뷰) 조회
        const r2 = await supabase
          .from('product_availability')
          .select('product_id, round_id, name, price, stock_remaining')
          .eq('round_id', String(id))
          .order('name', { ascending: true })
        if (r2.error) throw r2.error
        const avail = (r2.data ?? []) as AvailabilityRow[]
        setRows(avail)

        // 4) “내가 이 회차에 제출한 주문”이 있으면 로드(자동 프리필)
        const r3 = await supabase
          .from('orders')
          .select('id, status, order_items(product_id, qty, unit_price)')
          .eq('user_id', userRes.user.id)
          .eq('round_id', String(id))
          .eq('status', 'submitted')
          .maybeSingle<ExistingOrder>()

        const initQty: Record<string, number> = {}
        for (const a of avail) initQty[a.product_id] = 0

        if (r3.data) {
          setExistingOrderId(r3.data.id)
          const prev: Record<string, number> = {}
          for (const it of r3.data.order_items ?? []) {
            prev[it.product_id] = it.qty
            initQty[it.product_id] = it.qty     // 화면을 “이전에 제출한 수량”으로 프리필
          }
          setPrevQty(prev)
        } else {
          setExistingOrderId(null)
          setPrevQty({})
        }
        setQty(initQty)
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 오류'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id, router])

  // 입력값 clamp: 최대 선택 가능 수량 = “현재 남은 수량 + 내가 이전에 잡아둔 수량”
  const maxSelectableFor = (pid: string): number => {
    const baseRemaining = rows.find(r => r.product_id === pid)?.stock_remaining ?? 0
    const myPrev = prevQty[pid] ?? 0
    return baseRemaining + myPrev
  }

  const onChangeQty = (pid: string, nextStr: string) => {
    const next = Number.isFinite(parseInt(nextStr, 10)) ? parseInt(nextStr, 10) : 0
    const maxSel = maxSelectableFor(pid)
    const clamped = Math.max(0, Math.min(maxSel, next))
    setQty(prev => ({ ...prev, [pid]: clamped }))
  }

  // 신규 제출
  const handleSubmit = async () => {
    if (!id || totalQty <= 0) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = Object.entries(qty)
        .filter(([, q]) => (q || 0) > 0)
        .map(([product_id, q]) => ({
          product_id,
          qty: q,
          unit_price: priceMap[product_id] ?? 0,
        }))

      const { error } = await supabase.rpc('submit_order', {
        p_round: String(id),
        p_items: payload,
      })

      if (error) {
        const msg = String(error.message || '')
        if (msg.startsWith('OUT_OF_STOCK')) {
          setError('선택하신 수량 중 일부가 이미 소진되었습니다. 남은 수량을 확인하고 다시 시도해 주세요.')
        } else setError(`제출 오류: ${error.message}`)
        return
      }
      router.replace('/') // 성공시 대시보드
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // 재제출(수정)
  const handleResubmit = async () => {
    if (!existingOrderId) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = Object.entries(qty)
        .filter(([, q]) => (q || 0) >= 0) // 0도 허용(해당 품목 삭제)
        .map(([product_id, q]) => ({
          product_id,
          qty: q,
          unit_price: priceMap[product_id] ?? 0,
        }))

      const { error } = await supabase.rpc('resubmit_order', {
        p_order: existingOrderId,
        p_items: payload,
      })

      if (error) {
        const msg = String(error.message || '')
        if (msg.startsWith('OUT_OF_STOCK')) {
          setError('수정 수량 중 일부가 이미 소진되었습니다. 남은 수량으로 조정해 주세요.')
        } else setError(`수정 오류: ${error.message}`)
        return
      }
      router.replace('/') // 성공시 대시보드
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="p-6">불러오는 중…</main>

  if (error) {
    return (
      <main className="p-6">
        <div className="mb-4">
          <Link href="/rounds" className="underline text-sm">← 회차 목록</Link>
        </div>
        <p className="text-red-600">오류: {error}</p>
      </main>
    )
  }

  if (!round) {
    return (
      <main className="p-6">
        <div className="mb-4">
          <Link href="/rounds" className="underline text-sm">← 회차 목록</Link>
        </div>
        해당 회차를 찾을 수 없습니다.
      </main>
    )
  }

  const isEdit = Boolean(existingOrderId)
  const disabled =
    round.status !== 'open' || submitting || (!isEdit && totalQty <= 0)

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{round.title}</h1>
          <p className="text-sm text-gray-600">
            마감: {new Date(round.deadline).toLocaleString()} · 상태: {round.status === 'open' ? '진행중' : '마감'}
          </p>
        </div>
        <Link href="/rounds" className="underline text-sm">← 회차 목록</Link>
      </div>

      {rows.length === 0 ? (
        <p>이 회차에 표시할 상품이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          <ul className="grid md:grid-cols-2 gap-4">
            {rows.map(row => {
              const pid = row.product_id
              const prev = prevQty[pid] ?? 0
              const maxSel = maxSelectableFor(pid) // 남은수량 + 내 이전수량
              return (
                <li key={pid} className="rounded border p-4">
                  <div className="font-semibold">{row.name}</div>
                  <div className="text-sm text-gray-600 mt-1">{row.price.toLocaleString()}원</div>
                  <div className="text-xs text-gray-600 mt-1">
                    남은 수량: {row.stock_remaining}
                    {prev > 0 && <span className="ml-2 text-gray-500">(내 이전 수량: {prev})</span>}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={maxSel}
                      className="w-24 border rounded px-2 py-1"
                      value={qty[pid] ?? 0}
                      onChange={(e) => onChangeQty(pid, e.target.value)}
                      disabled={round.status !== 'open'}
                    />
                    <button
                      type="button"
                      className="border rounded px-3 py-1"
                      onClick={() => onChangeQty(pid, String((qty[pid] ?? 0) - 1))}
                      disabled={(qty[pid] ?? 0) <= 0 || round.status !== 'open'}
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      className="border rounded px-3 py-1"
                      onClick={() => onChangeQty(pid, String((qty[pid] ?? 0) + 1))}
                      disabled={(qty[pid] ?? 0) >= maxSel || round.status !== 'open'}
                    >
                      +1
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">최대 선택 가능: {maxSel}</div>
                </li>
              )
            })}
          </ul>

          <div className="rounded border p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">합계</div>
              <div className="text-sm text-gray-700">
                수량 {totalQty} · 금액 {totalAmount.toLocaleString()}원
              </div>
            </div>

            <button
              className={`mt-3 rounded px-4 py-2 ${disabled ? 'bg-gray-300 text-gray-600' : 'bg-black text-white'}`}
              onClick={isEdit ? handleResubmit : handleSubmit}
              disabled={disabled}
            >
              {submitting
                ? (isEdit ? '저장 중…' : '제출 중…')
                : (isEdit ? '변경사항 저장' : '신청 제출')}
            </button>

            {round.status !== 'open' && (
              <p className="text-xs text-gray-600 mt-2">이 회차는 마감되었습니다.</p>
            )}
            {error && <p className="text-red-600 mt-2">{error}</p>}
          </div>
        </div>
      )}
    </main>
  )
}
