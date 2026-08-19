import { wajibLogin } from '@/lib/auth'
import { db } from '@/lib/db'
import { rupiah } from '@/lib/format'
import { labelPeriode } from '@/lib/format'
import { Kartu, JudulSeksi } from '@/components/ui'
import FormGantiPin from './form-ganti-pin'

export const metadata = { title: 'Akun · Kas Cluster' }

export default async function HalamanAkun() {
  const sesi = await wajibLogin()
  const unit = sesi.unitId
    ? await db.unit.findUnique({
        where: { id: sesi.unitId },
        select: { kode: true, blok: true, nomor: true, namaWarga: true, kontak: true, tarifSampah: true, tarifSecurity: true, mulaiPeriode: true },
      })
    : null

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-ink">Akun saya</h1>

      {unit && (
        <Kartu>
          <JudulSeksi keterangan="Perubahan data unit hanya bisa dilakukan bendahara.">Data unit</JudulSeksi>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-2">Kode unit</dt>
            <dd className="tabular font-medium text-ink">{unit.kode}</dd>
            <dt className="text-ink-2">Nama warga</dt>
            <dd className="font-medium text-ink">{unit.namaWarga}</dd>
            <dt className="text-ink-2">Alamat</dt>
            <dd className="text-ink">Blok {unit.blok} No. {unit.nomor}</dd>
            <dt className="text-ink-2">Kontak</dt>
            <dd className="text-ink">{unit.kontak || <span className="text-ink-muted">belum diisi</span>}</dd>
            <dt className="text-ink-2">Iuran sampah</dt>
            <dd className="tabular text-ink">{rupiah(unit.tarifSampah)} / bulan</dd>
            <dt className="text-ink-2">Iuran security</dt>
            <dd className="tabular text-ink">{rupiah(unit.tarifSecurity)} / bulan</dd>
            <dt className="text-ink-2">Ditagih sejak</dt>
            <dd className="text-ink">{labelPeriode(unit.mulaiPeriode)}</dd>
          </dl>
        </Kartu>
      )}

      <Kartu>
        <JudulSeksi keterangan="Gunakan PIN yang tidak mudah ditebak dan jangan pakai PIN bawaan.">
          Ganti PIN
        </JudulSeksi>
        <FormGantiPin />
      </Kartu>
    </div>
  )
}
