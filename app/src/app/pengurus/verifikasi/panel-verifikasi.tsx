'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiSetujui, aksiTolak, type HasilAksi } from '../actions'
import { KELAS_INPUT, Peringatan, Tombol } from '@/components/ui'

/// Batas yang sama dipakai di server (aksiTolak) — cukup panjang untuk memaksa
/// keterangan yang benar-benar bisa dipahami warga, bukan "salah" atau "ok".
const MIN_ALASAN = 10

/// Alasan yang paling sering dipakai, supaya kewajiban mengisi keterangan tidak
/// terasa seperti hambatan dan bendahara tidak menulis alasan seadanya.
const ALASAN_UMUM = [
  'Transfer tidak ditemukan di mutasi rekening kas pada tanggal tersebut.',
  'Nominal yang ditransfer tidak sama dengan nominal yang dilaporkan.',
  'Bukti transfer tidak terlampir atau tidak terbaca. Mohon lampirkan ulang.',
  'Bulan yang ditandai tidak sesuai dengan tunggakan yang ada.',
  'Total alokasi bulan melebihi nominal yang ditransfer.',
  'Pembayaran ini sudah tercatat pada laporan sebelumnya (dobel lapor).',
]

function TombolSetuju({ nonaktif }: { nonaktif: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending || nonaktif}>
      {pending ? 'Menyetujui…' : 'Setujui & masukkan ke kas'}
    </Tombol>
  )
}

function TombolTolak({ nonaktif }: { nonaktif: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" variasi="bahaya" disabled={pending || nonaktif}>
      {pending ? 'Menolak…' : 'Tolak laporan'}
    </Tombol>
  )
}

export default function PanelVerifikasi({ id, bolehSetujui }: { id: string; bolehSetujui: boolean }) {
  const [hasilSetuju, aksiSetuju] = useActionState<HasilAksi | null, FormData>(aksiSetujui, null)
  const [hasilTolak, aksiTolakForm] = useActionState<HasilAksi | null, FormData>(aksiTolak, null)
  const [formTolak, setFormTolak] = useState(false)
  const [alasan, setAlasan] = useState('')

  const galat = hasilSetuju?.galat ?? hasilTolak?.galat
  const cukup = alasan.trim().length >= MIN_ALASAN

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
            Keterangan penolakan <span className="text-kritis">*</span>
          </label>
          <p className="text-xs text-ink-2">
            Wajib diisi. Warga hanya melihat keterangan ini untuk tahu apa yang harus diperbaiki, jadi
            tulis yang jelas — bukan hanya &ldquo;tidak sesuai&rdquo;.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {ALASAN_UMUM.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAlasan(a)}
                className="rounded-md bg-plane px-2 py-1 text-left text-xs text-ink-2 ring-1 ring-inset ring-hairline hover:bg-white hover:text-ink"
              >
                {a.length > 46 ? `${a.slice(0, 44)}…` : a}
              </button>
            ))}
          </div>

          <textarea
            name="alasan"
            rows={3}
            required
            minLength={MIN_ALASAN}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Contoh: transfer Rp150.000 tidak ditemukan di mutasi rekening kas pada 12 Agu 2026. Mohon kirim ulang bukti transfernya."
            className={KELAS_INPUT}
          />
          <p className={`text-xs ${cukup ? 'text-ink-muted' : 'text-[#8a5d00]'}`}>
            {cukup
              ? 'Keterangan ini akan tampil di halaman riwayat warga.'
              : `Minimal ${MIN_ALASAN} karakter — baru ${alasan.trim().length}.`}
          </p>

          <div className="flex gap-2">
            <TombolTolak nonaktif={!cukup} />
            <Tombol variasi="polos" type="button" onClick={() => setFormTolak(false)}>
              Batal
            </Tombol>
          </div>
        </form>
      )}
    </div>
  )
}
