'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiBatalkanTransaksi, type HasilAksi } from '../actions'
import { rupiah } from '@/lib/format'
import { KELAS_INPUT, Tombol } from '@/components/ui'

function Kirim() {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" variasi="bahaya" ukuran="kecil" disabled={pending}>
      {pending ? 'Membatalkan…' : 'Batalkan'}
    </Tombol>
  )
}

/**
 * Pembatalan transaksi resmi. Selalu meminta alasan tertulis: transaksi tidak
 * pernah dihapus (NF-04), jadi alasannya adalah satu-satunya penjelasan yang
 * tersedia saat data ini ditinjau ulang nanti.
 */
export default function TombolBatalkan({
  id,
  uraian,
  nominal,
}: {
  id: string
  uraian: string
  nominal: number
}) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiBatalkanTransaksi, null)
  const [buka, setBuka] = useState(false)

  if (!buka) {
    return (
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-[#d03b3b]/8 hover:text-[#b02f2f]"
      >
        Batalkan
      </button>
    )
  }

  return (
    <form action={aksi} className="w-56 space-y-1.5 text-left">
      <input type="hidden" name="id" value={id} />
      <p className="text-xs text-ink-2">
        Batalkan <span className="tabular font-medium">{rupiah(nominal)}</span> — {uraian}?
      </p>
      <textarea
        name="alasan"
        rows={2}
        required
        minLength={5}
        placeholder="Alasan pembatalan (wajib)"
        className={`${KELAS_INPUT} py-1.5 text-xs`}
      />
      {hasil?.galat && <p className="text-xs text-[#b02f2f]">{hasil.galat}</p>}
      <div className="flex gap-1.5">
        <Kirim />
        <Tombol variasi="polos" ukuran="kecil" type="button" onClick={() => setBuka(false)}>
          Tutup
        </Tombol>
      </div>
    </form>
  )
}
