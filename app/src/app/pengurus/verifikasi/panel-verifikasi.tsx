'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiSetujui, aksiTolak, type HasilAksi } from '../actions'
import { KELAS_INPUT, Peringatan, Tombol } from '@/components/ui'

function TombolSetuju({ nonaktif }: { nonaktif: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending || nonaktif}>
      {pending ? 'Menyetujui…' : 'Setujui & masukkan ke kas'}
    </Tombol>
  )
}

function TombolTolak() {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" variasi="bahaya" disabled={pending}>
      {pending ? 'Menolak…' : 'Tolak laporan'}
    </Tombol>
  )
}

export default function PanelVerifikasi({ id, bolehSetujui }: { id: string; bolehSetujui: boolean }) {
  const [hasilSetuju, aksiSetuju] = useActionState<HasilAksi | null, FormData>(aksiSetujui, null)
  const [hasilTolak, aksiTolakForm] = useActionState<HasilAksi | null, FormData>(aksiTolak, null)
  const [formTolak, setFormTolak] = useState(false)

  const galat = hasilSetuju?.galat ?? hasilTolak?.galat

  return (
    <div className="space-y-3">
      {galat && <Peringatan nada="kritis">{galat}</Peringatan>}

      {!formTolak ? (
        <div className="flex flex-wrap items-center gap-2">
          <form action={aksiSetuju}>
            <input type="hidden" name="id" value={id} />
            <TombolSetuju nonaktif={!bolehSetujui} />
          </form>
          <Tombol variasi="sekunder" onClick={() => setFormTolak(true)}>
            Tolak
          </Tombol>
          {!bolehSetujui && (
            <span className="text-xs text-ink-muted">
              Persetujuan dikunci karena alokasi melebihi nominal.
            </span>
          )}
        </div>
      ) : (
        <form action={aksiTolakForm} className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <label className="block text-sm font-medium text-ink">
            Alasan penolakan <span className="text-kritis">*</span>
          </label>
          <textarea
            name="alasan"
            rows={2}
            required
            minLength={5}
            placeholder="Contoh: transfer tidak ditemukan di rekening kas pada tanggal tersebut"
            className={KELAS_INPUT}
          />
          <p className="text-xs text-ink-muted">Alasan ini akan terlihat oleh warga di halaman riwayatnya.</p>
          <div className="flex gap-2">
            <TombolTolak />
            <Tombol variasi="polos" type="button" onClick={() => setFormTolak(false)}>
              Batal
            </Tombol>
          </div>
        </form>
      )}
    </div>
  )
}
