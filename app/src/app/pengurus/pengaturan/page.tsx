import { redirect } from 'next/navigation'
import { wajibPengurus } from '@/lib/auth'
import { ROLES, SETTING_SALDO_AWAL } from '@/lib/constants'
import { ambilSetting } from '@/lib/setting'
import { ringkasanKas } from '@/lib/kas'
import { daftarSemuaKategori } from '@/lib/kategori'
import { rupiah } from '@/lib/format'
import { Kartu, JudulSeksi, Peringatan } from '@/components/ui'
import FormPengaturan from './form-pengaturan'
import PanelKategori from './panel-kategori'
import FormSesuaikanSaldo from './form-sesuaikan-saldo'

export const metadata = { title: 'Pengaturan · Kas Cluster' }

export default async function HalamanPengaturan() {
  const sesi = await wajibPengurus()
  // Pengaturan mengubah angka saldo dasar, jadi dibatasi ke bendahara saja.
  if (sesi.role !== ROLES.BENDAHARA) redirect('/pengurus')

  const [saldoAwal, nama, tanggalSaldoAwal, kas, kategori] = await Promise.all([
    ambilSetting(SETTING_SALDO_AWAL, '0'),
    ambilSetting('nama_cluster', 'Cluster Salaam Citayam'),
    ambilSetting('tanggal_saldo_awal', ''),
    ringkasanKas(),
    daftarSemuaKategori(),
  ])

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Pengaturan</h1>
        <p className="mt-0.5 text-sm text-ink-2">Hanya bendahara yang dapat mengubah pengaturan ini.</p>
      </div>

      <Peringatan nada="ingat" judul="Saldo awal menentukan seluruh angka saldo">
        PRD menyarankan memulai sistem ini dengan saldo akhir dari Google Sheets sebagai saldo awal, dan
        mengarsipkan riwayat lama secara terpisah. Isi angka ini sekali dengan benar sebelum sistem dipakai
        sungguhan — mengubahnya nanti akan menggeser seluruh riwayat saldo.
      </Peringatan>

      <Kartu>
        <JudulSeksi>Data dasar</JudulSeksi>
        <FormPengaturan
          saldoAwal={Number(saldoAwal) || 0}
          namaCluster={nama}
          tanggalSaldoAwal={tanggalSaldoAwal}
        />
      </Kartu>

      <Kartu>
        <JudulSeksi keterangan="Kategori nonaktif tidak muncul lagi di form pengeluaran baru, tapi transaksi lama yang memakainya tetap tersimpan apa adanya.">
          Kategori pengeluaran
        </JudulSeksi>
        <PanelKategori kategori={kategori} />
      </Kartu>

      <Kartu>
        <JudulSeksi keterangan="Dihitung ulang setiap kali halaman dibuka, dari transaksi yang sudah disetujui.">
          Rekap saldo saat ini
        </JudulSeksi>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
          <dt className="text-ink-2">Saldo awal</dt>
          <dd className="tabular text-right font-medium">{rupiah(kas.saldoAwal)}</dd>
          <dt className="text-ink-2">Total pemasukan disetujui</dt>
          <dd className="tabular text-right font-medium text-sukses-teks">+{rupiah(kas.totalMasuk)}</dd>
          <dt className="text-ink-2">Total pengeluaran</dt>
          <dd className="tabular text-right font-medium text-kritis">-{rupiah(kas.totalKeluar)}</dd>
          <dt className="border-t border-grid pt-2 font-semibold text-ink">Saldo kas</dt>
          <dd className="tabular border-t border-grid pt-2 text-right font-semibold">
            {rupiah(kas.saldoAkhir)}
          </dd>
        </dl>

        <div className="mt-3">
          <FormSesuaikanSaldo saldoTerhitung={kas.saldoAkhir} />
        </div>
      </Kartu>

      <Kartu>
        <JudulSeksi keterangan="Salinan berkala mencegah kehilangan data kas (NF-05).">Pencadangan data</JudulSeksi>
        <p className="text-sm text-ink-2">
          Unduh seluruh buku kas sebagai CSV untuk disimpan di luar sistem. Untuk pencadangan penuh termasuk
          data warga dan jejak audit, gunakan pencadangan database sesuai petunjuk di README.
        </p>
        <a
          href="/api/ekspor/ledger"
          className="mt-3 inline-block rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink ring-1 ring-inset ring-baseline hover:bg-plane"
        >
          Unduh seluruh buku kas (CSV)
        </a>
      </Kartu>
    </div>
  )
}
