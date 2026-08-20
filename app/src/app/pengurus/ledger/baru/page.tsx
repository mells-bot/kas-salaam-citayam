import Link from 'next/link'
import { db } from '@/lib/db'
import { wajibPengurus } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { kartuIuranSemuaUnit } from '@/lib/iuran'
import { periodeSekarang } from '@/lib/periode'
import { daftarKategoriAktif } from '@/lib/kategori'
import { Kartu, Peringatan } from '@/components/ui'
import FormTransaksiBaru from './form-transaksi-baru'

export const metadata = { title: 'Catat Transaksi · Kas Cluster' }

export default async function HalamanTransaksiBaru() {
  const sesi = await wajibPengurus()

  if (sesi.role !== ROLES.BENDAHARA) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Peringatan nada="kritis" judul="Tidak berwenang">
          Hanya Bendahara yang dapat mencatat transaksi. Peran Ketua RT bersifat memantau dan menyetujui.
        </Peringatan>
        <Link href="/pengurus/ledger" className="text-sm font-medium text-[#1c5cab] hover:underline">
          ← Kembali ke buku kas
        </Link>
      </div>
    )
  }

  const periodeIni = periodeSekarang()
  const kartu = await kartuIuranSemuaUnit(periodeIni)

  // Bawa serta rincian tunggakan per unit supaya bendahara tidak perlu menghitung
  // manual saat mencatat pembayaran atas nama warga.
  const unitDenganTagihan = kartu.map((k) => ({
    id: k.unitId,
    kode: k.kode,
    namaWarga: k.namaWarga,
    tertagih: k.baris
      .filter((b) => b.totalKurang > 0)
      .map((b) => ({
        periode: b.periode,
        kurangSampah: b.sampah.kurang,
        kurangSecurity: b.security.kurang,
        totalKurang: b.totalKurang,
      })),
  }))

  const [jumlahUnitAda, kategori] = await Promise.all([
    db.unit.count({ where: { aktif: true } }),
    daftarKategoriAktif(),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/pengurus/ledger" className="text-xs font-medium text-[#1c5cab] hover:underline">
          ← Buku kas
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-ink">Catat transaksi</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          Transaksi yang Anda catat langsung masuk ke saldo kas resmi tanpa verifikasi tambahan.
        </p>
      </div>

      {jumlahUnitAda === 0 && (
        <Peringatan nada="ingat" judul="Belum ada unit aktif">
          Tambahkan data warga terlebih dahulu agar pencatatan iuran bisa dikaitkan ke unit.
        </Peringatan>
      )}

      {kategori.length === 0 && (
        <Peringatan nada="kritis" judul="Belum ada kategori pengeluaran">
          Tambahkan minimal satu kategori lewat menu Pengaturan sebelum mencatat pengeluaran.
        </Peringatan>
      )}

      <Kartu>
        <FormTransaksiBaru unit={unitDenganTagihan} kategori={kategori.map((k) => k.nama)} />
      </Kartu>
    </div>
  )
}
