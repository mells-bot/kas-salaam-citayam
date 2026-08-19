import Link from 'next/link'
import { db } from '@/lib/db'
import { arusKasBulanan, ringkasanKas } from '@/lib/kas'
import { kartuIuranSemuaUnit, ringkasPeriode } from '@/lib/iuran'
import { periodeSekarang, tambahBulan } from '@/lib/periode'
import { labelPeriode, rupiah, tanggalSingkat } from '@/lib/format'
import { STATUS } from '@/lib/constants'
import { ambilSetting } from '@/lib/setting'
import { Kartu, KartuAngka, JudulSeksi, Kosong, Nominal, Peringatan } from '@/components/ui'
import { BatangStatusIuran, GrafikArusKas, GrafikSaldo } from '@/components/grafik'

export const metadata = { title: 'Dashboard · Kas Cluster' }

export default async function DashboardPengurus() {
  const periodeIni = periodeSekarang()
  const periodeLalu = tambahBulan(periodeIni, -1)

  const [kas, arus, kartu, menunggu, tanggalSaldoAwal] = await Promise.all([
    ringkasanKas(),
    arusKasBulanan(12),
    kartuIuranSemuaUnit(periodeIni),
    db.transaction.findMany({
      where: { status: STATUS.PENDING, dibatalkanPada: null },
      orderBy: { createdAt: 'asc' },
      take: 5,
      include: { unit: { select: { kode: true, namaWarga: true } } },
    }),
    ambilSetting('tanggal_saldo_awal'),
  ])

  const statusIni = ringkasPeriode(kartu, periodeIni)
  const statusLalu = ringkasPeriode(kartu, periodeLalu)

  const penunggak = kartu
    .filter((k) => k.totalTunggakan > 0)
    .sort((a, b) => b.totalTunggakan - a.totalTunggakan)
    .slice(0, 8)

  const totalTunggakan = kartu.reduce((s, k) => s + k.totalTunggakan, 0)
  const bulanIni = arus.at(-1)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-ink">Dashboard kas</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            Per {labelPeriode(periodeIni)} · {kartu.length} unit aktif
          </p>
        </div>
        {menunggu.length > 0 && (
          <Link
            href="/pengurus/verifikasi"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2a78d6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#256abf]"
          >
            Verifikasi {menunggu.length} laporan
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KartuAngka
          label="Saldo kas saat ini"
          nilai={rupiah(kas.saldoAkhir)}
          nada={kas.saldoAkhir < 0 ? 'kritis' : 'netral'}
          catatan={`Saldo awal ${rupiah(kas.saldoAwal)}${tanggalSaldoAwal ? ` per ${tanggalSaldoAwal}` : ''}`}
        />
        <KartuAngka
          label={`Masuk ${labelPeriode(periodeIni)}`}
          nilai={rupiah(bulanIni?.masuk ?? 0)}
          nada="baik"
          catatan={`Keluar ${rupiah(bulanIni?.keluar ?? 0)}`}
        />
        <KartuAngka
          label="Total tunggakan"
          nilai={rupiah(totalTunggakan)}
          nada={totalTunggakan > 0 ? 'kritis' : 'baik'}
          catatan={`${kartu.filter((k) => k.totalTunggakan > 0).length} unit punya tunggakan`}
        />
        <KartuAngka
          label={`Lunas ${labelPeriode(periodeIni)}`}
          nilai={`${statusIni.lunas}`}
          satuan={`/ ${statusIni.totalUnit} unit`}
          catatan={`${labelPeriode(periodeLalu)}: ${statusLalu.lunas}/${statusLalu.totalUnit} unit`}
        />
      </div>

      {kas.saldoAkhir < 0 && (
        <Peringatan nada="kritis" judul="Saldo kas negatif">
          Total pengeluaran melebihi pemasukan dan saldo awal. Periksa apakah saldo awal sudah diisi benar di
          menu Pengaturan.
        </Peringatan>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Kartu className="lg:col-span-2">
          <JudulSeksi keterangan="Dua belas bulan terakhir. Keduanya dalam rupiah pada skala yang sama, jadi tingginya bisa dibandingkan langsung.">
            Arus kas bulanan
          </JudulSeksi>
          <GrafikArusKas data={arus} />
        </Kartu>

        <Kartu>
          <JudulSeksi keterangan="Saldo kas pada akhir tiap bulan.">Tren saldo</JudulSeksi>
          <GrafikSaldo data={arus} />
        </Kartu>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Kartu>
          <JudulSeksi keterangan={`Status ${statusIni.totalUnit} unit untuk ${labelPeriode(periodeIni)}.`}>
            Status iuran bulan ini
          </JudulSeksi>
          <BatangStatusIuran
            lunas={statusIni.lunas}
            sebagian={statusIni.sebagian}
            belum={statusIni.belum}
          />
          <p className="mt-3 text-xs text-ink-2">
            Kekurangan bulan ini:{' '}
            <span className="tabular font-semibold text-ink">{rupiah(statusIni.totalKurang)}</span>
          </p>
          <Link
            href="/pengurus/tunggakan"
            className="mt-3 inline-block text-xs font-medium text-[#1c5cab] hover:underline"
          >
            Lihat matriks seluruh unit →
          </Link>
        </Kartu>

        <Kartu className="lg:col-span-2">
          <JudulSeksi
            keterangan="Diurutkan dari tunggakan terbesar."
            aksi={
              <Link href="/pengurus/tunggakan" className="text-xs font-medium text-[#1c5cab] hover:underline">
                Semua →
              </Link>
            }
          >
            Warga menunggak
          </JudulSeksi>

          {penunggak.length === 0 ? (
            <Kosong pesan="Tidak ada tunggakan. Seluruh unit lunas sampai bulan ini." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grid text-left text-xs text-ink-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">Unit</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Nama</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Bulan</th>
                    <th scope="col" className="py-2 text-right font-medium">Tunggakan</th>
                  </tr>
                </thead>
                <tbody>
                  {penunggak.map((k) => (
                    <tr key={k.unitId} className="border-b border-grid last:border-0">
                      <td className="tabular py-2 pr-3 font-medium">{k.kode}</td>
                      <td className="py-2 pr-3 text-ink-2">
                        <span className="block max-w-[14rem] truncate">{k.namaWarga}</span>
                      </td>
                      <td className="tabular py-2 pr-3 text-right text-ink-2">{k.jumlahBulanTunggak}</td>
                      <td className="tabular py-2 text-right font-medium text-kritis">
                        {rupiah(k.totalTunggakan)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Kartu>
      </div>

      <Kartu>
        <JudulSeksi
          keterangan="Laporan warga yang belum diverifikasi tidak memengaruhi saldo kas."
          aksi={
            <Link href="/pengurus/verifikasi" className="text-xs font-medium text-[#1c5cab] hover:underline">
              Buka antrean →
            </Link>
          }
        >
          Menunggu verifikasi
        </JudulSeksi>

        {menunggu.length === 0 ? (
          <Kosong pesan="Antrean verifikasi kosong." />
        ) : (
          <ul className="divide-y divide-grid">
            {menunggu.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    <span className="tabular">{t.unit?.kode ?? '—'}</span>{' '}
                    <span className="font-normal text-ink-2">{t.unit?.namaWarga}</span>
                  </p>
                  <p className="text-xs text-ink-muted">
                    {tanggalSingkat(t.tanggal)} · {t.metode === 'TUNAI' ? 'Tunai' : 'Transfer'}
                  </p>
                </div>
                <Nominal nilai={t.nominal} tanda="masuk" className="text-sm font-semibold" />
              </li>
            ))}
          </ul>
        )}
      </Kartu>
    </div>
  )
}
