'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiLaporTambahan, type HasilAksi } from './actions'
import { UnggahBukti } from '@/components/unggah-bukti'
import { rupiah } from '@/lib/format'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

function Kirim() {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending}>
      {pending ? 'Mengirim…' : 'Kirim laporan'}
    </Tombol>
  )
}

function tanggalHariIni() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FormLaporTambahan({
  tagihanTambahanId,
  kurang,
}: {
  tagihanTambahanId: string
  kurang: number
}) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiLaporTambahan, null)
  const [buka, setBuka] = useState(false)
  const hariIni = tanggalHariIni()

  if (hasil?.ok) {
    return <Peringatan nada="info">{hasil.pesan}</Peringatan>
  }

  if (!buka) {
    return <Tombol onClick={() => setBuka(true)}>Lapor bayar ({rupiah(kurang)})</Tombol>
  }

  return (
    <form action={aksi} className="space-y-3 border-t border-grid pt-3">
      <input type="hidden" name="tagihanTambahanId" value={tagihanTambahanId} />
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label wajib>Tanggal bayar</Label>
          <input type="date" name="tanggal" required defaultValue={hariIni} max={hariIni} className={KELAS_INPUT} />
        </div>
        <div>
          <Label wajib>Metode</Label>
          <select name="metode" required defaultValue="TRANSFER" className={KELAS_INPUT}>
            <option value="TRANSFER">Transfer bank</option>
            <option value="TUNAI">Tunai</option>
          </select>
        </div>
      </div>

      <div>
        <Label wajib>Nominal</Label>
        <input
          type="number"
          name="nominal"
          required
          min={1}
          defaultValue={kurang}
          inputMode="numeric"
          className={`${KELAS_INPUT} tabular`}
        />
        <p className="mt-1 text-xs text-ink-muted">Kekurangan saat ini: {rupiah(kurang)}.</p>
      </div>

      <UnggahBukti />

      <div>
        <Label>Catatan (opsional)</Label>
        <textarea name="remark" rows={2} maxLength={500} className={KELAS_INPUT} />
      </div>

      <div className="flex gap-2">
        <Kirim />
        <Tombol variasi="polos" type="button" onClick={() => setBuka(false)}>
          Batal
        </Tombol>
      </div>
    </form>
  )
}
