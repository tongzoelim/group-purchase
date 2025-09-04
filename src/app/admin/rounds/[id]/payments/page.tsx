'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Round = { id: string; title: string; deadline: string; status: 'open'|'closed' }
type Profile = { is_admin: boolean }

type Row = {
  order_id: string
  user_id: string
  name: string | null
  email: string | null
  total_qty: number
  total_amount: number
  payment_status: 'unpaid'|'partial'|'paid'
  payment_amount: number | null
  paid_at: string | null
  payment_note: string | null
  updated_at: string
}

export default function AdminPaymentsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [round, setRound] = useState<Round | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all'|'unpaid'|'partial'|'paid'>('all')

  const filtered = useMemo(
    () => rows.filter(r => filter === 'all' ? true : r.payment_status === filter),
    [rows, filter]
  )

  const totals = useMemo(() => {
    const sel = filtered
    const people = sel.length
    const amount = sel.reduce((s, r) => s + (r.total_amount || 0), 0)
    const qty = sel.reduce((s, r) => s + (r.total_qty || 0), 0)
    const paid = sel.reduce((s, r) => s + (r.payment_status === 'paid' ? (r.payment_amount ?? r.total_amount ?? 0) : 0), 0)
    return { people, qty, amount, paid }
  }, [filtered])

  useEffect(() => {
    const run = async () => {
      if (!id) return
      setLoading(true)
      setError(null)

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

  const updatePayment = async (order_id: string, status: 'unpaid'|'partial'|'paid', amount: number | null, note: string | null) => {
    const { error } = await supabase.rpc('admin_set_payment', {
      p_order: order_id,
      p_status: status,
      p_amount: amount,
      p_note: note,
      p_paid_at: null // 상태가 paid면 서버에서 now()로 처리
    })
    if (error) throw error
    // 로컬 반영
    setRows(prev => prev.map(r => r.order_id === order_id
      ? { ...r, payment_status: status, payment_amount: amount, payment_note: note, paid_at: status === 'paid' ? new Date().toISOString() : null }
      : r
    ))
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
          <Link href={`/admin/rounds/${round.id}`} className="underline text-sm">← 회차 대시보드</Link>
        </div>
      </div>

      {/* 요약 카드 */}
      <section className="rounded border p-4 grid md:grid-cols-4 gap-3 text-sm">
        <div><div className="text-gray-500">선택된 인원</div><div className="text-lg font-semibold">{totals.people}명</div></div>
        <div><div className="text-gray-500">총 수량</div><div className="text-lg font-semibold">{totals.qty}</div></div>
        <div><div className="text-gray-500">총 금액</div><div className="text-lg font-semibold">{totals.amount.toLocaleString()}원</div></div>
        <div><div className="text-gray-500">완납 합계</div><div className="text-lg font-semibold">{totals.paid.toLocaleString()}원</div></div>
      </section>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">상태 필터:</span>
        {(['all','unpaid','partial','paid'] as const).map(k => (
          <button key={k}
            className={`text-sm rounded border px-3 py-1 ${filter===k ? 'bg-black text-white' : ''}`}
            onClick={()=>setFilter(k)}
          >{k}</button>
        ))}
      </div>

      {/* 테이블 */}
      <section className="rounded border p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-600">해당 조건의 데이터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">이름</th>
                  <th className="text-left p-2">이메일</th>
                  <th className="text-right p-2">총 수량</th>
                  <th className="text-right p-2">총 금액(원)</th>
                  <th className="text-left p-2">상태</th>
                  <th className="text-right p-2">입금액(원)</th>
                  <th className="text-left p-2">메모</th>
                  <th className="text-left p-2">처리</th>
                  <th className="text-left p-2">최종갱신</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <PaymentRow key={r.order_id} row={r} onUpdate={updatePayment} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function PaymentRow({ row, onUpdate }: {
  row: Row
  onUpdate: (order_id: string, status: 'unpaid'|'partial'|'paid', amount: number | null, note: string | null) => Promise<void>
}) {
  const [status, setStatus]   = useState<Row['payment_status']>(row.payment_status)
  const [amount, setAmount]   = useState<string>(row.payment_amount != null ? String(row.payment_amount) : '')
  const [note, setNote]       = useState<string>(row.payment_note ?? '')
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const amt = amount.trim() === '' ? null : Number(amount)
      if (amt != null && Number.isNaN(amt)) throw new Error('금액이 올바르지 않습니다.')
      await onUpdate(row.order_id, status, amt, note.trim() || null)
      setMsg('저장됨')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
      setTimeout(()=>setMsg(null), 1500)
    }
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
          onChange={(e)=>setStatus(e.target.value as any)}
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
          onChange={(e)=>setAmount(e.target.value)}
          min={0}
        />
      </td>
      <td className="p-2">
        <input
          className="w-56 border rounded px-2 py-1"
          placeholder="메모(송금자명, 계좌 등)"
          value={note}
          onChange={(e)=>setNote(e.target.value)}
        />
      </td>
      <td className="p-2">
        <button className="rounded border px-3 py-1 text-sm" disabled={saving} onClick={save}>
          {saving ? '저장중…' : '저장'}
        </button>
        {msg && <div className="text-xs text-gray-600 mt-1">{msg}</div>}
      </td>
      <td className="p-2 text-xs text-gray-600">{new Date(row.updated_at).toLocaleString()}</td>
    </tr>
  )
}
