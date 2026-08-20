'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiNonaktifkanTagihan, type HasilAksi } from './actions'

function Kirim() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm('Nonaktifkan tagihan ini? Warga tidak akan bisa melapor bayar lagi, tapi riwayat yang sudah ada tetap tersimpan.')) {
          e.preventDefault()
        }
      }}
      className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-baseline hover:bg-plane disabled:opacity-50"
    >
      {pending ? 'Menonaktifkan…' : 'Nonaktifkan'}
    </button>
  )
}

export default function TombolNonaktifkan({ id }: { id: string }) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiNonaktifkanTagihan, null)
  return (
    <form action={aksi}>
      <input type="hidden" name="id" value={id} />
      <Kirim />
      {hasil?.galat && <p className="mt-1 text-xs text-[#b02f2f]">{hasil.galat}</p>}
    </form>
  )
}
