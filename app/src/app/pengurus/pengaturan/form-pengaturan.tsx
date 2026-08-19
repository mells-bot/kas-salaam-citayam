'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiSimpanPengaturan, type HasilAksi } from '../actions'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

function Simpan() {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan pengaturan'}
    </Tombol>
  )
}

export default function FormPengaturan({
  saldoAwal,
  namaCluster,
  tanggalSaldoAwal,
}: {
  saldoAwal: number
  namaCluster: string
  tanggalSaldoAwal: string
}) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiSimpanPengaturan, null)

  return (
    <form action={aksi} className="space-y-3">
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}
      {hasil?.ok && <Peringatan nada="info">{hasil.pesan}</Peringatan>}

      <div>
        <Label wajib>Nama cluster</Label>
        <input name="namaCluster" required minLength={3} defaultValue={namaCluster} className={KELAS_INPUT} />
      </div>

      <div>
        <Label wajib>Saldo awal (Rp)</Label>
        <input
          type="number"
          name="saldoAwal"
          required
          step={1}
          defaultValue={saldoAwal}
          className={`${KELAS_INPUT} tabular`}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Saldo kas sebelum transaksi pertama dicatat di sistem ini. Boleh 0 bila mulai dari nol.
        </p>
      </div>

      <div>
        <Label>Tanggal saldo awal</Label>
        <input
          type="date"
          name="tanggalSaldoAwal"
          defaultValue={tanggalSaldoAwal}
          className={KELAS_INPUT}
        />
        <p className="mt-1 text-xs text-ink-muted">Sebagai keterangan di laporan, tidak memengaruhi perhitungan.</p>
      </div>

      <Simpan />
    </form>
  )
}
