'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiBuatTagihanTambahan, type HasilAksi } from './actions'
import { periodeSekarang } from '@/lib/periode'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

function Simpan() {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending}>
      {pending ? 'Membuat…' : 'Buat tagihan'}
    </Tombol>
  )
}

export default function FormTagihanBaru() {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiBuatTagihanTambahan, null)

  return (
    <form action={aksi} className="space-y-3">
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}
      {hasil?.ok && <Peringatan nada="info">{hasil.pesan}</Peringatan>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label wajib>Nama tagihan</Label>
          <input
            name="nama"
            required
            minLength={3}
            placeholder="Contoh: THR Ramadan 2027"
            className={KELAS_INPUT}
          />
        </div>
        <div>
          <Label wajib>Bulan berlaku</Label>
          <input
            name="periode"
            required
            placeholder="2027-03"
            pattern="\d{4}-\d{2}"
            defaultValue={periodeSekarang()}
            className={`${KELAS_INPUT} tabular`}
          />
        </div>
      </div>

      <div>
        <Label wajib>Nominal per unit</Label>
        <input
          type="number"
          name="nominalPerUnit"
          required
          min={1}
          placeholder="175000"
          className={`${KELAS_INPUT} tabular`}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Berlaku sama untuk semua unit aktif. Contoh: THR biasanya sama dengan iuran satu bulan
          penuh (sampah + security).
        </p>
      </div>

      <div>
        <Label>Keterangan (opsional)</Label>
        <textarea name="keterangan" rows={2} maxLength={500} className={KELAS_INPUT} />
      </div>

      <Simpan />
    </form>
  )
}
