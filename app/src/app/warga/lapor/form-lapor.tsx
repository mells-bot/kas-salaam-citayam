'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiLaporBayar, type HasilAksi } from '../actions'
import { PemilihAlokasi, type BarisTertagih } from '@/components/form-alokasi'
import { UnggahBukti } from '@/components/unggah-bukti'
import FormKonfirmasi, { type BarisRingkas } from '@/components/form-konfirmasi'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'
import { JENIS_IURAN_LABEL } from '@/lib/constants'
import { labelPeriode, rupiah, tanggalSingkat } from '@/lib/format'

function TombolKirim({ nonaktif }: { nonaktif: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending || nonaktif} className="w-full">
      {pending ? 'Mengirim…' : 'Kirim laporan'}
    </Tombol>
  )
}

/**
 * Merangkum isian form untuk dibaca ulang warga sebelum dikirim.
 * Dibaca dari FormData agar yang dikonfirmasi persis sama dengan yang dikirim.
 */
export function ringkasLaporan(fd: FormData): BarisRingkas[] {
  const baris: BarisRingkas[] = []

  const tgl = String(fd.get('tanggal') ?? '')
  baris.push({ label: 'Tanggal bayar', nilai: tgl ? tanggalSingkat(tgl) : '—' })
  baris.push({ label: 'Metode', nilai: fd.get('metode') === 'TUNAI' ? 'Tunai' : 'Transfer bank' })

  // Alokasi dikirim sebagai alokasi[i][...]; kumpulkan per indeks.
  const alokasi: { periode: string; jenisIuran: string; nominal: number }[] = []
  for (const [key, value] of fd.entries()) {
    const m = key.match(/^alokasi\[(\d+)\]\[periode\]$/)
    if (!m) continue
    alokasi.push({
      periode: String(value),
      jenisIuran: String(fd.get(`alokasi[${m[1]}][jenisIuran]`) ?? ''),
      nominal: Number(fd.get(`alokasi[${m[1]}][nominal]`) ?? 0),
    })
  }

  const totalAlokasi = alokasi.reduce((s, a) => s + a.nominal, 0)
  const nominal = Number(fd.get('nominal') ?? 0)

  baris.push({
    label: 'Bulan yang dibayar',
    nilai:
      alokasi.length === 0
        ? 'Belum ada bulan ditandai'
        : alokasi
            .map(
              (a) =>
                `${labelPeriode(a.periode)} · ${JENIS_IURAN_LABEL[a.jenisIuran] ?? a.jenisIuran} ${rupiah(a.nominal)}`,
            )
            .join(' · '),
    nada: alokasi.length === 0 ? 'ingat' : 'netral',
  })

  baris.push({ label: 'Nominal ditransfer', nilai: rupiah(nominal) })

  const selisih = nominal - totalAlokasi
  if (selisih !== 0) {
    baris.push({
      label: selisih > 0 ? 'Belum dialokasikan ke bulan' : 'Kelebihan alokasi',
      nilai: rupiah(Math.abs(selisih)),
      nada: selisih > 0 ? 'ingat' : 'kritis',
    })
  }

  const bukti = String(fd.get('buktiUrl') ?? '')
  baris.push({
    label: 'Bukti transfer',
    nilai: bukti ? `Terlampir (± ${Math.round(bukti.length / 1024)} KB)` : 'Tidak dilampirkan',
    nada: bukti ? 'netral' : 'ingat',
  })

  const remark = String(fd.get('remark') ?? '').trim()
  if (remark) baris.push({ label: 'Catatan', nilai: remark })

  return baris
}

export default function FormLapor({ tertagih }: { tertagih: BarisTertagih[] }) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiLaporBayar, null)

  if (hasil?.ok) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#0ca30c]/12 text-[#0a7c0a]">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-ink">Laporan terkirim</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">{hasil.pesan}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/warga"
            className="rounded-lg bg-[#2a78d6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#256abf]"
          >
            Kembali ke status iuran
          </Link>
          <Link
            href="/warga/riwayat"
            className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink ring-1 ring-inset ring-baseline hover:bg-plane"
          >
            Lihat riwayat
          </Link>
        </div>
      </div>
    )
  }

  // Tanggal bawaan hari ini; dihitung di klien agar mengikuti zona waktu pengguna.
  const hariIni = new Date()
  const nilaiTanggal = `${hariIni.getFullYear()}-${String(hariIni.getMonth() + 1).padStart(2, '0')}-${String(
    hariIni.getDate(),
  ).padStart(2, '0')}`

  return (
    <FormKonfirmasi
      action={aksi}
      ringkas={ringkasLaporan}
      className="space-y-4"
      judul="Sudah sesuai?"
      catatan="Periksa bulan, nominal, dan buktinya sekali lagi. Setelah terkirim, laporan hanya bisa dibatalkan selama belum diverifikasi — tidak bisa diubah."
      labelKirim="Ya, kirim laporan"
    >
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label wajib>Tanggal bayar</Label>
          <input type="date" name="tanggal" required defaultValue={nilaiTanggal} max={nilaiTanggal} className={KELAS_INPUT} />
        </div>
        <div>
          <Label wajib>Metode</Label>
          <select name="metode" required defaultValue="TRANSFER" className={KELAS_INPUT}>
            <option value="TRANSFER">Transfer bank</option>
            <option value="TUNAI">Tunai</option>
          </select>
        </div>
      </div>

      <PemilihAlokasi tertagih={tertagih} />

      <UnggahBukti />

      <div>
        <Label>Catatan untuk bendahara (opsional)</Label>
        <textarea
          name="remark"
          rows={2}
          maxLength={500}
          placeholder="Contoh: transfer dari rekening atas nama istri"
          className={KELAS_INPUT}
        />
      </div>

      <TombolKirim nonaktif={tertagih.length === 0} />
    </FormKonfirmasi>
  )
}
