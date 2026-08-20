'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiBuatTagihanTambahan, type HasilAksi } from './actions'
import { periodeSekarang } from '@/lib/periode'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

type Cakupan = 'FLAT' | 'SECURITY' | 'PENUH'

function Simpan() {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending}>
      {pending ? 'Membuat…' : 'Buat tagihan'}
    </Tombol>
  )
}

const OPSI_CAKUPAN: { nilai: Cakupan; label: string; keterangan: string }[] = [
  {
    nilai: 'PENUH',
    label: 'Penuh (sampah + security)',
    keterangan: 'Otomatis mengikuti tarif sampah+security tiap unit — sama seperti iuran bulan normal.',
  },
  {
    nilai: 'SECURITY',
    label: 'Security saja',
    keterangan:
      'Otomatis mengikuti tarif security tiap unit. Cocok kalau THR/tagihan ini hanya untuk komponen security.',
  },
  {
    nilai: 'FLAT',
    label: 'Nominal sama rata',
    keterangan: 'Anda tentukan sendiri satu angka yang berlaku sama untuk semua unit aktif.',
  },
]

export default function FormTagihanBaru() {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiBuatTagihanTambahan, null)
  const [cakupan, setCakupan] = useState<Cakupan>('PENUH')

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
        <Label wajib>Berapa yang ditagih ke tiap unit?</Label>
        <div className="space-y-2">
          {OPSI_CAKUPAN.map((opsi) => (
            <label
              key={opsi.nilai}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                cakupan === opsi.nilai ? 'border-[#2a78d6] bg-[#2a78d6]/4' : 'border-baseline bg-white'
              }`}
            >
              <input
                type="radio"
                name="cakupan"
                value={opsi.nilai}
                checked={cakupan === opsi.nilai}
                onChange={() => setCakupan(opsi.nilai)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#2a78d6]"
              />
              <span>
                <span className="block text-sm font-medium text-ink">{opsi.label}</span>
                <span className="block text-xs text-ink-2">{opsi.keterangan}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {cakupan === 'FLAT' && (
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
        </div>
      )}

      <div>
        <Label>Keterangan (opsional)</Label>
        <textarea name="keterangan" rows={2} maxLength={500} className={KELAS_INPUT} />
      </div>

      <Simpan />
    </form>
  )
}
