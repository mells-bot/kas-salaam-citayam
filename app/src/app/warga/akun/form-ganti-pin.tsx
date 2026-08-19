'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiGantiPin, type HasilAksi } from '../actions'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

function Kirim() {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan PIN baru'}
    </Tombol>
  )
}

export default function FormGantiPin() {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiGantiPin, null)

  return (
    <form action={aksi} className="space-y-3">
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}
      {hasil?.ok && <Peringatan nada="info">{hasil.pesan}</Peringatan>}

      <div>
        <Label wajib>PIN lama</Label>
        <input type="password" name="pinLama" required autoComplete="current-password" className={KELAS_INPUT} />
      </div>
      <div>
        <Label wajib>PIN baru</Label>
        <input type="password" name="pinBaru" required minLength={6} autoComplete="new-password" className={KELAS_INPUT} />
        <p className="mt-1 text-xs text-ink-muted">Minimal 6 karakter.</p>
      </div>
      <div>
        <Label wajib>Ulangi PIN baru</Label>
        <input type="password" name="konfirmasi" required autoComplete="new-password" className={KELAS_INPUT} />
      </div>
      <Kirim />
    </form>
  )
}
