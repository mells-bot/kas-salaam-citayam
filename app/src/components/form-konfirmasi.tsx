'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Tombol } from './ui'

/*
 * Form dengan langkah konfirmasi sebelum dikirim.
 *
 * Laporan pembayaran tidak bisa diedit warga setelah terkirim (hanya bisa
 * dibatalkan selama masih PENDING), dan salah bulan/nominal berarti kerja
 * bolak-balik dengan bendahara. Jadi sebelum benar-benar mengirim, isian
 * dirangkum kembali dalam bahasa manusia untuk dibaca ulang.
 *
 * Ringkasan dibaca dari FormData form itu sendiri, bukan dari state komponen
 * anak — jadi yang ditampilkan persis apa yang akan dikirim ke server.
 */

export interface BarisRingkas {
  label: string
  nilai: string
  nada?: 'netral' | 'ingat' | 'kritis'
}

export default function FormKonfirmasi({
  action,
  ringkas,
  children,
  className = '',
  judul = 'Sudah sesuai?',
  catatan,
  labelKirim = 'Ya, kirim',
  labelPeriksa = 'Periksa lagi',
}: {
  action: (formData: FormData) => void
  ringkas: (formData: FormData) => BarisRingkas[]
  children: ReactNode
  className?: string
  judul?: string
  catatan?: string
  labelKirim?: string
  labelPeriksa?: string
}) {
  const [ringkasan, setRingkasan] = useState<BarisRingkas[] | null>(null)
  const refForm = useRef<HTMLFormElement>(null)
  // Menandai bahwa submit berikutnya datang dari tombol konfirmasi, bukan dari
  // pengguna yang menekan "Kirim" pertama kali.
  const sudahDikonfirmasi = useRef(false)

  function saatSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (sudahDikonfirmasi.current) {
      sudahDikonfirmasi.current = false
      return
    }
    e.preventDefault()
    setRingkasan(ringkas(new FormData(e.currentTarget)))
  }

  function kirim() {
    sudahDikonfirmasi.current = true
    setRingkasan(null)
    refForm.current?.requestSubmit()
  }

  return (
    <>
      <form ref={refForm} action={action} onSubmit={saatSubmit} className={className}>
        {children}
      </form>

      {ringkasan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={judul}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center"
          onClick={() => setRingkasan(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-ink">{judul}</p>
            <p className="mt-0.5 text-xs text-ink-2">
              {catatan ?? 'Periksa sekali lagi. Setelah terkirim, laporan hanya bisa dibatalkan — tidak bisa diubah.'}
            </p>

            <dl className="mt-3 divide-y divide-grid rounded-lg bg-plane px-3">
              {ringkasan.map((b, i) => (
                <div key={`${b.label}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <dt className="text-xs text-ink-2">{b.label}</dt>
                  <dd
                    className={`text-right text-sm font-medium ${
                      b.nada === 'kritis' ? 'text-kritis' : b.nada === 'ingat' ? 'text-[#8a5d00]' : 'text-ink'
                    }`}
                  >
                    {b.nilai}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row-reverse">
              <Tombol type="button" onClick={kirim} className="w-full sm:w-auto">
                {labelKirim}
              </Tombol>
              <Tombol
                type="button"
                variasi="sekunder"
                onClick={() => setRingkasan(null)}
                className="w-full sm:w-auto"
              >
                {labelPeriksa}
              </Tombol>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
