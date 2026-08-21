'use client'

import { useEffect, useState } from 'react'

/*
 * Penampil bukti pembayaran.
 *
 * Sebelumnya bukti hanya tampil sebagai <img> kecil di dalam <details>, jadi
 * nominal pada struk sering tidak terbaca — padahal itu satu-satunya alasan
 * bukti disimpan. Di sini gambar dibuka sebagai lapisan penuh layar yang bisa
 * di-zoom, dan bisa dibuka di tab baru (dikonversi ke blob URL karena data URL
 * panjang diblokir sebagian peramban saat dibuka langsung).
 */

export default function LihatBukti({
  url,
  label = 'Lihat bukti',
  keterangan,
  ukuran = 'sedang',
}: {
  url: string
  label?: string
  keterangan?: string
  ukuran?: 'kecil' | 'sedang'
}) {
  const [buka, setBuka] = useState(false)
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    if (!buka) return
    function tekan(e: KeyboardEvent) {
      if (e.key === 'Escape') setBuka(false)
    }
    document.addEventListener('keydown', tekan)
    // Cegah halaman di belakang ikut menggulir saat lapisan terbuka.
    const overflowAsli = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tekan)
      document.body.style.overflow = overflowAsli
    }
  }, [buka])

  function bukaTabBaru() {
    try {
      const [meta, base64] = url.split(',')
      if (!base64) {
        window.open(url, '_blank', 'noopener')
        return
      }
      const tipe = meta.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
      const biner = atob(base64)
      const buf = new Uint8Array(biner.length)
      for (let i = 0; i < biner.length; i++) buf[i] = biner.charCodeAt(i)
      const blobUrl = URL.createObjectURL(new Blob([buf], { type: tipe }))
      window.open(blobUrl, '_blank', 'noopener')
      // Biarkan tab baru selesai memuat sebelum URL dilepas.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch {
      window.open(url, '_blank', 'noopener')
    }
  }

  const kelasTombol =
    ukuran === 'kecil'
      ? 'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-[#1c5cab] hover:bg-[#2a78d6]/8'
      : 'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[#1c5cab] ring-1 ring-inset ring-[#2a78d6]/30 hover:bg-[#2a78d6]/8'

  return (
    <>
      <button type="button" onClick={() => setBuka(true)} className={`no-print ${kelasTombol}`}>
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M1.6 8s2.4-4.2 6.4-4.2S14.4 8 14.4 8s-2.4 4.2-6.4 4.2S1.6 8 1.6 8Z" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        {label}
      </button>

      {buka && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bukti pembayaran"
          className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3 sm:p-6"
          onClick={() => setBuka(false)}
        >
          <div
            className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-xl bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-grid px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Bukti pembayaran</p>
                {keterangan && <p className="mt-0.5 truncate text-xs text-ink-muted">{keterangan}</p>}
              </div>
              <button
                type="button"
                onClick={() => setBuka(false)}
                aria-label="Tutup"
                className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-ink-2 hover:bg-black/5"
              >
                Tutup
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-plane p-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Bukti pembayaran"
                onClick={() => setZoom((z) => !z)}
                className={
                  zoom
                    ? 'max-w-none cursor-zoom-out rounded-lg'
                    : 'mx-auto max-h-full max-w-full cursor-zoom-in rounded-lg object-contain'
                }
                style={zoom ? { width: '200%' } : undefined}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-grid px-3 py-2.5">
              <p className="text-xs text-ink-muted">Ketuk gambar untuk {zoom ? 'memperkecil' : 'memperbesar'}.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={bukaTabBaru}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-ink ring-1 ring-inset ring-baseline hover:bg-plane"
                >
                  Buka di tab baru
                </button>
                <a
                  href={url}
                  download="bukti-pembayaran.jpg"
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-ink ring-1 ring-inset ring-baseline hover:bg-plane"
                >
                  Unduh
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
