'use client'

import { useRef, useState } from 'react'
import { Label } from './ui'

/*
 * Bukti transfer dikompres di peramban sebelum dikirim, lalu disimpan sebagai
 * data URL di database. Untuk 34 unit, ini menghindari kebutuhan object storage
 * berbayar sepenuhnya. Batas ~1280px / kualitas 0.72 menghasilkan berkas
 * sekitar 100-200 KB — cukup untuk membaca nominal & tanggal pada struk.
 *
 * Dua jalur pilih berkas disediakan sengaja: `capture="environment"` memaksa
 * kamera terbuka di HP, jadi warga yang sudah menyimpan struk m-banking di
 * galeri tidak bisa memakainya. Input kedua tanpa `capture` membuka pemilih
 * berkas/galeri seperti biasa.
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
  const refKamera = useRef<HTMLInputElement>(null)
  const refGaleri = useRef<HTMLInputElement>(null)

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setGalat('')

    // Sebagian peramban Android mengirim type kosong untuk berkas dari galeri,
    // jadi ekstensi dipakai sebagai jaring pengaman sebelum berkas ditolak.
    const namaBerkas = file.name.toLowerCase()
    const sepertiGambar =
      file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/.test(namaBerkas)
    if (!sepertiGambar) {
      setGalat('Berkas harus berupa gambar (JPG/PNG/HEIC). Tangkapan layar m-banking juga bisa.')
      return
    }
    if (file.size > BATAS_ASLI) {
      setGalat('Ukuran gambar melebihi 12 MB. Gunakan foto dengan resolusi lebih kecil.')
      return
    }

    setSibuk(true)
    try {
      setDataUrl(await kompres(file))
    } catch {
      setGalat(
        'Gambar ini tidak bisa dibaca peramban Anda (biasanya format HEIC dari iPhone). Buka gambarnya di galeri, simpan/bagikan sebagai JPG, lalu coba lagi.',
      )
    } finally {
      setSibuk(false)
      // Reset supaya memilih berkas yang sama dua kali tetap memicu onChange.
      e.target.value = ''
    }
  }

  function hapus() {
    setDataUrl('')
    setGalat('')
    if (refKamera.current) refKamera.current.value = ''
    if (refGaleri.current) refGaleri.current.value = ''
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
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-baseline px-3 py-4 text-sm text-ink-2 hover:bg-plane">
            <input
              ref={refKamera}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={pilih}
              className="sr-only"
              disabled={sibuk}
            />
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 8.5h2.2l1.3-2h9l1.3 2H20v10H4v-10Z M12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {sibuk ? 'Memproses…' : 'Ambil foto'}
          </label>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-baseline px-3 py-4 text-sm text-ink-2 hover:bg-plane">
            <input
              ref={refGaleri}
              type="file"
              accept="image/*"
              onChange={pilih}
              className="sr-only"
              disabled={sibuk}
            />
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 5.5h16v13H4v-13Zm0 9.5 4.5-4.5 3.5 3.5 3-3 5 5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="9" r="1.4" fill="currentColor" />
            </svg>
            {sibuk ? 'Memproses…' : 'Pilih dari galeri'}
          </label>
        </div>
      )}

      {galat && <p className="mt-1 text-xs text-kritis">{galat}</p>}
      <p className="mt-1 text-xs text-ink-muted">
        Boleh foto struk maupun tangkapan layar m-banking dari galeri. Gambar dikompres otomatis di HP Anda
        sebelum dikirim, jadi hemat kuota.
      </p>
    </div>
  )
}
