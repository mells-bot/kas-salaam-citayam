'use client'

import { useRef, useState } from 'react'
import { Label } from './ui'

/*
 * Bukti transfer dikompres di peramban sebelum dikirim, lalu disimpan sebagai
 * data URL di database. Untuk 34 unit, ini menghindari kebutuhan object storage
 * berbayar sepenuhnya. Batas ~1280px / kualitas 0.72 menghasilkan berkas
 * sekitar 100-200 KB — cukup untuk membaca nominal & tanggal pada struk.
 */

const LEBAR_MAKS = 1280
const KUALITAS = 0.72
const BATAS_ASLI = 12 * 1024 * 1024 // tolak berkas raksasa sebelum dibaca
const BATAS_HASIL = 1_500_000 // sisakan jarak dari batas 3 MB di skema validasi

async function kompres(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const skala = Math.min(1, LEBAR_MAKS / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * skala)
  const h = Math.round(bitmap.height * skala)

  const kanvas = document.createElement('canvas')
  kanvas.width = w
  kanvas.height = h
  const ctx = kanvas.getContext('2d')
  if (!ctx) throw new Error('Peramban tidak mendukung pemrosesan gambar.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  let kualitas = KUALITAS
  let hasil = kanvas.toDataURL('image/jpeg', kualitas)
  // Turunkan kualitas bertahap bila masih terlalu besar (foto struk resolusi tinggi).
  while (hasil.length > BATAS_HASIL && kualitas > 0.35) {
    kualitas -= 0.12
    hasil = kanvas.toDataURL('image/jpeg', kualitas)
  }
  if (hasil.length > BATAS_HASIL) {
    throw new Error('Gambar masih terlalu besar setelah dikompres. Coba foto ulang dengan resolusi lebih kecil.')
  }
  return hasil
}

export function UnggahBukti({ nama = 'buktiUrl' }: { nama?: string }) {
  const [dataUrl, setDataUrl] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setGalat('')

    if (!file.type.startsWith('image/')) {
      setGalat('Berkas harus berupa gambar (JPG/PNG/HEIC).')
      return
    }
    if (file.size > BATAS_ASLI) {
      setGalat('Ukuran gambar melebihi 12 MB. Gunakan foto dengan resolusi lebih kecil.')
      return
    }

    setSibuk(true)
    try {
      setDataUrl(await kompres(file))
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal memproses gambar.')
    } finally {
      setSibuk(false)
    }
  }

  function hapus() {
    setDataUrl('')
    setGalat('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <Label>Bukti transfer (opsional)</Label>
      <input type="hidden" name={nama} value={dataUrl} />

      {dataUrl ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt="Pratinjau bukti transfer"
            className="h-24 w-24 rounded-lg object-cover ring-1 ring-hairline"
          />
          <div className="text-xs text-ink-2">
            <p>Gambar siap dikirim (± {Math.round(dataUrl.length / 1024)} KB).</p>
            <button type="button" onClick={hapus} className="mt-1.5 font-medium text-kritis hover:underline">
              Hapus & pilih ulang
            </button>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-baseline px-4 py-5 text-sm text-ink-2 hover:bg-plane">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={pilih}
            className="sr-only"
            disabled={sibuk}
          />
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 16V5m0 0L8 9m4-4 4 4M5 17v2h14v-2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {sibuk ? 'Memproses gambar…' : 'Ambil foto atau pilih gambar'}
        </label>
      )}

      {galat && <p className="mt-1 text-xs text-kritis">{galat}</p>}
      <p className="mt-1 text-xs text-ink-muted">
        Gambar dikompres otomatis di HP Anda sebelum dikirim, jadi hemat kuota.
      </p>
    </div>
  )
}
