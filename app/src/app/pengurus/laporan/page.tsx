import { db } from '@/lib/db'
import { wajibPengurus } from '@/lib/auth'
import { ledgerBerjalan } from '@/lib/kas'
import { kartuIuranSemuaUnit, ringkasPeriode } from '@/lib/iuran'
import { isPeriodeValid, parsePeriode, periodeSekarang, tambahBulan } from '@/lib/periode'
import { labelPeriode, rupiah, tanggal, tanggalSingkat } from '@/lib/format'
import { JENIS_TRANSAKSI } from '@/lib/constants'
import { ambilSetting, namaCluster } from '@/lib/setting'
import { Kartu, JudulSeksi, Kosong, Nominal } from '@/components/ui'
import PemilihPeriodeLaporan from './pemilih-periode'

export const metadata = { title: 'Laporan Bulanan · Kas Cluster' }

interface Params {
  searchParams: Promise<{ periode?: string }>
}

/** Batas awal & akhir sebuah periode "YYYY-MM" dalam waktu lokal. */
function rentangBulan(periode: string) {
  const { tahun, bulan } = parsePeriode(periode)
  return {
    awal: new Date(tahun, bulan - 1, 1, 0, 0, 0, 0),
    akhir: new Date(tahun, bulan, 0, 23, 59, 59, 999),
  }
}

export default async function HalamanLaporan({ searchParams }: Params) {
  await wajibPengurus()
  const sp = await searchParams

  const periode = sp.periode && isPeriodeValid(sp.periode) ? sp.periode : periodeSekarang()
  const { awal, akhir } = rentangBulan(periode)

  const [{ saldoPembuka, baris, saldoPenutup }, kartu, cluster, tanggalSaldoAwal, periodeTersedia] =
    await Promise.all([
      ledgerBerjalan({ dari: awal, sampai: akhir }),
      kartuIuranSemuaUnit(periode),
      namaCluster(),
      ambilSetting('tanggal_saldo_awal'),
      daftarPeriodeTersedia(),
    ])

  const masuk = baris.filter((b) => b.jenis === JENIS_TRANSAKSI.MASUK)
  const keluar = baris.filter((b) => b.jenis === JENIS_TRANSAKSI.KELUAR)
  const totalMasuk = masuk.reduce((s, b) => s + b.nominal, 0)
  const totalKeluar = keluar.reduce((s, b) => s + b.nominal, 0)

  const status = ringkasPeriode(kartu, periode)
  const totalTunggakanKumulatif = kartu.reduce((s, k) => s + k.totalTunggakan, 0)

  // Rekap pengeluaran per kategori — pertanyaan pertama tiap rapat warga
  // biasanya "uangnya habis untuk apa".
  const perKategori = new Map<string, number>()
  for (const k of keluar) {
    const key = k.kategori ?? 'Lain-lain'
    perKategori.set(key, (perKategori.get(key) ?? 0) + k.nominal)
  }
  const kategoriTerurut = [...perKategori.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Laporan bulanan</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            Siap dicetak atau disimpan sebagai PDF untuk dibagikan ke warga.
          </p>
        </div>
        <PemilihPeriodeLaporan periode={periode} tersedia={periodeTersedia} />
      </div>

      {/* Kepala laporan — hanya tampil saat dicetak */}
      <div className="print-only mb-4 text-center">
        <h1 className="text-lg font-bold">Laporan Keuangan Iuran Warga</h1>
        <p className="text-sm">{cluster}</p>
        <p className="text-sm">Periode {labelPeriode(periode)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kartu padat>
          <p className="text-xs text-ink-muted">Saldo awal bulan</p>
          <p className="tabular mt-1 text-lg font-semibold">{rupiah(saldoPembuka)}</p>
        </Kartu>
        <Kartu padat>
          <p className="text-xs text-ink-muted">Total pemasukan</p>
          <p className="tabular mt-1 text-lg font-semibold text-sukses-teks">{rupiah(totalMasuk)}</p>
        </Kartu>
        <Kartu padat>
          <p className="text-xs text-ink-muted">Total pengeluaran</p>
          <p className="tabular mt-1 text-lg font-semibold text-kritis">{rupiah(totalKeluar)}</p>
        </Kartu>
        <Kartu padat>
          <p className="text-xs text-ink-muted">Saldo akhir bulan</p>
          <p className="tabular mt-1 text-lg font-semibold">{rupiah(saldoPenutup)}</p>
        </Kartu>
      </div>

      <Kartu>
        <JudulSeksi keterangan={`Dihitung dari ${status.totalUnit} unit aktif.`}>
          Kepatuhan iuran {labelPeriode(periode)}
        </JudulSeksi>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-ink-muted">Lunas</p>
            <p className="tabular text-lg font-semibold text-sukses-teks">{status.lunas} unit</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Bayar sebagian</p>
            <p className="tabular text-lg font-semibold text-[#8a5d00]">{status.sebagian} unit</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Belum bayar</p>
            <p className="tabular text-lg font-semibold text-kritis">{status.belum} unit</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Kurang bulan ini</p>
            <p className="tabular text-lg font-semibold">{rupiah(status.totalKurang)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-2">
          Total tunggakan kumulatif seluruh unit sampai {labelPeriode(periode)}:{' '}
          <span className="tabular font-semibold text-kritis">{rupiah(totalTunggakanKumulatif)}</span>
        </p>
      </Kartu>

      <Kartu>
        <JudulSeksi keterangan="Dikelompokkan agar mudah dibacakan di forum warga.">
          Pengeluaran per kategori
        </JudulSeksi>
        {kategoriTerurut.length === 0 ? (
          <Kosong pesan="Tidak ada pengeluaran pada bulan ini." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grid text-left text-xs text-ink-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Kategori</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Nominal</th>
                <th scope="col" className="py-2 text-right font-medium">Porsi</th>
              </tr>
            </thead>
            <tbody>
              {kategoriTerurut.map(([k, v]) => (
                <tr key={k} className="border-b border-grid last:border-0">
                  <td className="py-2 pr-3">{k}</td>
                  <td className="tabular py-2 pr-3 text-right">{rupiah(v)}</td>
                  <td className="tabular py-2 text-right text-ink-2">
                    {totalKeluar > 0 ? `${Math.round((v / totalKeluar) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2 pr-3">Total</td>
                <td className="tabular py-2 pr-3 text-right">{rupiah(totalKeluar)}</td>
                <td className="py-2 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Kartu>

      <Kartu>
        <JudulSeksi keterangan={`${baris.length} transaksi resmi pada ${labelPeriode(periode)}.`}>
          Rincian transaksi
        </JudulSeksi>
        {baris.length === 0 ? (
          <Kosong pesan="Tidak ada transaksi pada bulan ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-grid text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 pr-2 font-medium">Tgl</th>
                  <th scope="col" className="py-2 pr-2 font-medium">Uraian</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">Debit</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">Kredit</th>
                  <th scope="col" className="py-2 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <tr key={b.id} className="border-b border-grid last:border-0">
                    <td className="py-1.5 pr-2 whitespace-nowrap text-ink-2">{tanggalSingkat(b.tanggal)}</td>
                    <td className="py-1.5 pr-2">
                      {b.uraian}
                      {b.kategori && <span className="ml-1.5 text-xs text-ink-muted">({b.kategori})</span>}
                    </td>
                    <td className="tabular py-1.5 pr-2 text-right">
                      {b.debit > 0 ? <Nominal nilai={b.debit} /> : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="tabular py-1.5 pr-2 text-right">
                      {b.kredit > 0 ? <Nominal nilai={b.kredit} /> : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="tabular py-1.5 text-right font-medium">{rupiah(b.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kartu>

      <div className="print-only mt-8 text-xs">
        <p>
          Saldo awal sistem {tanggalSaldoAwal ? `per ${tanggalSaldoAwal}` : ''}. Laporan ini dihasilkan otomatis
          oleh sistem pada {tanggal(new Date())} dan hanya memuat transaksi yang sudah diverifikasi.
        </p>
        <div className="mt-10 flex justify-between">
          <div className="text-center">
            <p>Bendahara</p>
            <p className="mt-12">(……………………………)</p>
          </div>
          <div className="text-center">
            <p>Ketua RT</p>
            <p className="mt-12">(……………………………)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Periode yang punya transaksi, untuk mengisi dropdown pemilih bulan. */
async function daftarPeriodeTersedia(): Promise<string[]> {
  const batas = await db.transaction.aggregate({
    where: { dibatalkanPada: null },
    _min: { tanggal: true },
    _max: { tanggal: true },
  })
  const sekarang = periodeSekarang()
  if (!batas._min.tanggal) return [sekarang]

  const min = batas._min.tanggal
  const awal = `${min.getFullYear()}-${String(min.getMonth() + 1).padStart(2, '0')}`

  const hasil: string[] = []
  for (let p = sekarang; p >= awal && hasil.length < 120; p = tambahBulan(p, -1)) hasil.push(p)
  return hasil
}
