'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Round = { id: string; title: string; deadline: string; status: 'open'|'closed' }
type Profile = { is_admin: boolean }
type PaymentStatus = 'unpaid'|'partial'|'paid'

type Row = {
  order_id: string
  user_id: string
  name: string | null
  email: string | null
  total_qty: number
  total_amount: number
  payment_status: PaymentStatus
  payment_amount: number | null
  paid_at: string | null
  payment_note: string | null
  updated_at: string
}

type DirtyPatch = {
  payment_status?: PaymentStatus
  payment_amount?: number | null
  payment_note?: string | null
}

export default function AdminPaymentsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [round, setRound] = useState<Round | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  // ✅ 모드: 자동 저장 vs 일괄 저장
  const [autoSave, setAutoSave] = useState(true)
  // 일괄 저장 모드에서 변경된 행을 담아둠: key = order_id
  const [dirtyMap, setDirtyMap] = useState<Record<string, DirtyPatch>>({})

  const filtered = rows // 필터가 필요하면 여기에 추가
  const totals = useMemo(() => {
    const people = filtered.length
    const amount = filtered.reduce((s, r) => s + (r.total_amount || 0), 0)
    const qty = filtered.reduce((s, r) => s + (r.total_qty || 0), 0)
    const paid = filtered.reduce((s, r) => s + (r.payment_status === 'paid' ? (r.payment_amount ?? r.total_amount ?? 0) : 0), 0)
    return { people, qty, amount, paid }
  }, [filtered])

  useEffect(() => {
    const run = async () => {
      if (!id) return
      setLoading(true); setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const pr = await supabase.from('profiles').select('is_admin').eq('id', user.id).single<Profile>()
      if (pr.error || !pr.data?.is_admin) { setIsAdmin(false); setLoading(false); return }
      setIsAdmin(true)

      const r1 = await supabase.from('rounds').select('id,title,deadline,status').eq('id', String(id)).single<Round>()
      if (r1.error) { setError(r1.error.message); setLoading(false); return }
      setRound(r1.data)

      const list = await supabase.rpc('admin_round_payment_list', { p_round: String(id) })
      if (list.error) { setError(list.error.message); setLoading(false); return }
      setRows((list.data ?? []) as Row[])
      setLoading(false)
    }
    void run()
  }, [id, router])

  const callSetPayment = async (order_id: string, patch: DirtyPatch) => {
    const row = rows.find(r => r.order_id === order_id)
    if (!row) throw new Error('행을 찾을 수 없습니다.')

    const status: PaymentStatus = patch.payment_status ?? row.payment_status
    const amount: number | null = (patch.payment_amount !== undefined) ? patch.payment_amount : (row.payment_amount ?? null)
    const note: string | null = (patch.payment_note !== undefined) ? patch.payment_note : (row.payment_note ?? null)

    const { error: rpcErr } = await supabase.rpc('admin_set_payment', {
      p_order: order_id,
      p_status: status,
      p_amount: amount,
      p_note: note,
      p_paid_at: null, // paid면 서버에서 now()
    })
    if (rpcErr) throw new Error(rpcErr.message)

    // 로컬 반영
    setRows(prev => prev.map(r => r.order_id === order_id
      ? {
          ...r,
          payment_status: status,
          payment_amount: amount,
          payment_note: note,
          paid_at: status === 'paid' ? (r.paid_at ?? new Date().toISOString()) : null,
          updated_at: new Date().toISOString(),
        }
      : r
    ))
  }

  // 일괄 저장 실행
  const saveSelectedDirty = async () => {
    const entries = Object.entries(dirtyMap)
    if (entries.length === 0) return
    // 순차 실행 (수가 많으면 Promise.allSettled도 가능)
    for (const [order_id, patch] of entries) {
      await callSetPayment(order_id, patch)
    }
    setDirtyMap({})
  }

  if (loading) return <main className="p-6">불러오는 중…</main>
  if (!isAdmin) return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">결제 관리</h1>
      <p className="mt-2 text-red-600">접근 권한이 없습니다.</p>
    </main>
  )
  if (error) return (
    <main className="p-6">
      <div className="mb-4"><Link className="underline text-sm" href="/admin">← 관리자 홈</Link></div>
      <p className="text-red-600">{error}</p>
    </main>
  )
  if (!round) return (
    <main className="p-6">
      <div className="mb-4"><Link className="underline text-sm" href="/admin">← 관리자 홈</Link></div>
      <p>회차를 찾을 수 없습니다.</p>
    </main>
  )

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{round.title} · 결제 관리</h1>
          <p className="text-sm text-gray-600">상태: {round.status} · 마감: {new Date(round.deadline).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/admin/rounds/${String(id)}`} className="underline text-sm">← 회차 대시보드</Link>
        </div>
      </div>

      {/* 상단 컨트롤 */}
      <section className="rounded border p-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoSave}
            onChange={(e)=>setAutoSave(e.target.checked)}
          />
          자동 저장
        </label>
        {!autoSave && (
          <>
            <span className="text-gray-600">변경된 항목: {Object.keys(dirtyMap).length}건</span>
            <button
              className="rounded border px-3 py-1"
              onClick={saveSelectedDirty}
              disabled={Object.keys(dirtyMap).length === 0}
            >
              선택 항목 저장
            </button>
            <button
              className="rounded border px-3 py-1"
              onClick={()=>setDirtyMap({})}
              disabled={Object.keys(dirtyMap).length === 0}
            >
              변경 취소
            </button>
          </>
        )}
      </section>

      {/* 요약 */}
      <section className="rounded border p-4 grid md:grid-cols-4 gap-3 text-sm">
        <div><div className="text-gray-500">인원</div><div className="text-lg font-semibold">{totals.people}명</div></div>
        <div><div className="text-gray-500">총 수량</div><div className="text-lg font-semibold">{totals.qty}</div></div>
        <div><div className="text-gray-500">총 금액</div><div className="text-lg font-semibold">{totals.amount.toLocaleString()}원</div></div>
        <div><div className="text-gray-500">완납 합계</div><div className="text-lg font-semibold">{totals.paid.toLocaleString()}원</div></div>
      </section>

      {/* 테이블 */}
      <section className="rounded border p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-600">데이터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">이름</th>
                  <th className="text-left p-2">이메일</th>
                  <th className="text-right p-2">총 수량</th>
                  <th className="text-right p-2">총 금액(원)</th>
                  <th className="text-left p-2">상태</th>
                  <th className="text-right p-2">입금액(원)</th>
                  <th className="text-left p-2">메모</th>
                  <th className="text-left p-2">최근 업데이트</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <PaymentRow
                    key={r.order_id}
                    row={r}
                    autoSave={autoSave}
                    onSave={callSetPayment}
                    markDirty={(order_id, patch) => {
                      setDirtyMap(prev => ({ ...prev, [order_id]: { ...(prev[order_id] ?? {}), ...patch } }))
                      // 미리 보이는 값도 즉시 반영
                      setRows(prev => prev.map(x => x.order_id === order_id ? { ...x, ...patch } as Row : x))
                    }}
                    clearDirty={(order_id) => {
                      setDirtyMap(prev => {
                        const { [order_id]: _omit, ...rest } = prev
                        return rest
                      })
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function PaymentRow({
  row,
  autoSave,
  onSave,
  markDirty,
  clearDirty,
}: {
  row: Row
  autoSave: boolean
  onSave: (order_id: string, patch: DirtyPatch) => Promise<void>
  markDirty: (order_id: string, patch: DirtyPatch) => void
  clearDirty: (order_id: string) => void
}) {
  const [status, setStatus] = useState<PaymentStatus>(row.payment_status)
  const [amount, setAmount] = useState<string>(row.payment_amount != null ? String(row.payment_amount) : '')
  const [note, setNote]     = useState<string>(row.payment_note ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState<string | null>(null)

  // 디바운스 타이머
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }

  // 상태 변경 → 즉시 저장(자동 저장 모드일 때)
  useEffect(() => {
    if (!autoSave) {
      // 일괄 저장 모드: 더티마크만
      markDirty(row.order_id, { payment_status: status })
      return
    }
    // 자동 저장
    setSaving(true); setMsg(null)
    onSave(row.order_id, { payment_status: status })
      .then(() => {
        setMsg('저장됨')
        clearDirty(row.order_id)
      })
      .catch(e => setMsg(e instanceof Error ? e.message : '저장 실패'))
      .finally(() => {
        setSaving(false)
        setTimeout(()=>setMsg(null), 1000)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]) // status 변경 시

  // 금액/메모 입력 디바운스 자동 저장
  useEffect(() => {
    if (!autoSave) {
      // 일괄 저장 모드: 더티마크만
      const amt = amount.trim() === '' ? null : Number(amount)
      markDirty(row.order_id, { payment_amount: Number.isNaN(amt as number) ? null : amt, payment_note: note.trim() || null })
      return
    }
    // 자동 저장 모드: 디바운스 800ms
    clearTimer()
    timerRef.current = setTimeout(() => {
      const amt = amount.trim() === '' ? null : Number(amount)
      setSaving(true); setMsg(null)
      onSave(row.order_id, { payment_amount: Number.isNaN(amt as number) ? null : amt, payment_note: note.trim() || null })
        .then(() => {
          setMsg('저장됨')
          clearDirty(row.order_id)
        })
        .catch(e => setMsg(e instanceof Error ? e.message : '저장 실패'))
        .finally(() => {
          setSaving(false)
          setTimeout(()=>setMsg(null), 1000)
        })
    }, 800)
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, note, autoSave])

  const onBlurSave = async () => {
    if (autoSave) return // 자동 저장이면 디바운스로 충분
    // 일괄 저장 모드에선 blur에서도 저장하지 않음(모으기)
  }

  return (
    <tr className="border-b align-top">
      <td className="p-2">{row.name ?? '-'}</td>
      <td className="p-2">{row.email ?? '-'}</td>
      <td className="p-2 text-right">{row.total_qty}</td>
      <td className="p-2 text-right">{row.total_amount.toLocaleString()}</td>
      <td className="p-2">
        <select
          className="border rounded px-2 py-1"
          value={status}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setStatus(e.target.value as PaymentStatus)
          }
        >
          <option value="unpaid">미입금</option>
          <option value="partial">부분입금</option>
          <option value="paid">완납</option>
        </select>
        {row.paid_at && <div className="text-xs text-gray-500 mt-1">완납일: {new Date(row.paid_at).toLocaleString()}</div>}
      </td>
      <td className="p-2 text-right">
        <input
          type="number"
          className="w-32 border rounded px-2 py-1 text-right"
          placeholder={row.total_amount.toString()}
          value={amount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
          onBlur={onBlurSave}
          min={0}
          step="1"
        />
      </td>
      <td className="p-2">
        <input
          className="w-56 border rounded px-2 py-1"
          placeholder="메모(송금자명, 계좌 등)"
          value={note}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
          onBlur={onBlurSave}
        />
        <div className="text-xs text-gray-600 mt-1 h-4">{saving ? '저장중…' : (msg ?? '')}</div>
      </td>
      <td className="p-2 text-xs text-gray-600">{new Date(row.updated_at).toLocaleString()}</td>
    </tr>
  )
}
