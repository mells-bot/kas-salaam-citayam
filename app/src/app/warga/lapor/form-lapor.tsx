'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiLaporBayar, type HasilAksi } from '../actions'
import { PemilihAlokasi, type BarisTertagih } from '@/components/form-alokasi'
import { UnggahBukti } from '@/components/unggah-bukti'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

function TombolKirim({ nonaktif }: { nonaktif: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending || nonaktif} className="w-full">
      {pending ? 'Mengirim…' : 'Kirim laporan'}
    </Tombol>
  )
}

export default function FormLapor({ tertagih }: { tertagih: BarisTertagih[] }) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiLaporBayar, null)

  if (hasil?.ok) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#0ca30c]/12 text-[#0a7c0a]">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-ink">Laporan terkirim</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">{hasil.pesan}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/warga"
            className="rounded-lg bg-[#2a78d6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#256abf]"
          >
            Kembali ke status iuran
          </Link>
          <Link
            href="/warga/riwayat"
            className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink ring-1 ring-inset ring-baseline hover:bg-plane"
          >
            Lihat riwayat
          </Link>
        </div>
      </div>
    )
  }

  // Tanggal bawaan hari ini; dihitung di klien agar mengikuti zona waktu pengguna.
  const hariIni = new Date()
  const nilaiTanggal = `${hariIni.getFullYear()}-${String(hariIni.getMonth() + 1).padStart(2, '0')}-${String(
    hariIni.getDate(),
  ).padStart(2, '0')}`

  return (
    <form action={aksi} className="space-y-4">
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label wajib>Tanggal bayar</Label>
          <input type="date" name="tanggal" required defaultValue={nilaiTanggal} max={nilaiTanggal} className={KELAS_INPUT} />
        </div>
        <div>
          <Label wajib>Metode</Label>
          <select name="metode" required defaultValue="TRANSFER" className={KELAS_INPUT}>
            <option value="TRANSFER">Transfer bank</option>
            <option value="TUNAI">Tunai</option>
          </select>
        </div>
      </div>

      <PemilihAlokasi tertagih={tertagih} />

      <UnggahBukti />

      <div>
        <Label>Catatan untuk bendahara (opsional)</Label>
        <textarea
          name="remark"
          rows={2}
          maxLength={500}
          placeholder="Contoh: transfer dari rekening atas nama istri"
          className={KELAS_INPUT}
        />
      </div>

      <TombolKirim nonaktif={tertagih.length === 0} />
    </form>
  )
}
