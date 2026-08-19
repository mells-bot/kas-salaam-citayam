'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiBatalkanLaporan, type HasilAksi } from '../actions'

function Tekan() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm('Batalkan laporan ini? Laporan akan tetap tercatat sebagai dibatalkan.')) {
          e.preventDefault()
        }
      }}
      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#b02f2f] ring-1 ring-inset ring-[#d03b3b]/35 hover:bg-[#d03b3b]/8 disabled:opacity-50"
    >
      {pending ? 'Membatalkan…' : 'Batalkan'}
    </button>
  )
}

export default function TombolBatal({ id }: { id: string }) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiBatalkanLaporan, null)
  return (
    <form action={aksi} className="shrink-0 text-right">
      <input type="hidden" name="id" value={id} />
      <Tekan />
      {hasil?.galat && <p className="mt-1 text-xs text-[#b02f2f]">{hasil.galat}</p>}
    </form>
  )
}
