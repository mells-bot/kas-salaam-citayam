import Link from 'next/link'
import { wajibLogin } from '@/lib/auth'
import { db } from '@/lib/db'
import { kartuIuranUnit } from '@/lib/iuran'
import { periodeSekarang } from '@/lib/periode'
import { labelPeriode, rupiah, tanggalSingkat } from '@/lib/format'
import { STATUS } from '@/lib/constants'
import {
  Kartu,
  KartuAngka,
  JudulSeksi,
  LencanaStatus,
  LencanaStatusTransaksi,
  Kosong,
  Peringatan,
  Nominal,
} from '@/components/ui'

export const metadata = { title: 'Status Iuran · Kas Cluster' }

export default async function DashboardWarga() {
  const sesi = await wajibLogin()
  if (!sesi.unitId) return null

  const periodeIni = periodeSekarang()

  const [kartu, unit, menunggu, terakhir, ditolak] = await Promise.all([
    kartuIuranUnit(sesi.unitId, periodeIni),
    db.unit.findUnique({
      where: { id: sesi.unitId },
      select: { kode: true, namaWarga: true, blok: true, nomor: true, tarifSampah: true, tarifSecurity: true },
    }),
    db.transaction.count({
      where: { unitId: sesi.unitId, status: STATUS.PENDING, dibatalkanPada: null },
    }),
    db.transaction.findMany({
      where: { unitId: sesi.unitId, dibatalkanPada: null },
      orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      include: { alokasi: { orderBy: [{ periode: 'asc' }, { jenisIuran: 'asc' }] } },
    }),
    // Laporan yang ditolak ditonjolkan terpisah: warga perlu tahu alasannya
    // supaya bisa memperbaiki, bukan sekadar melihat statusnya berubah.
    db.transaction.findMany({
      where: { unitId: sesi.unitId, status: STATUS.REJECTED, dibatalkanPada: null },
      orderBy: [{ reviewedAt: 'desc' }],
      take: 3,
      select: { id: true, nominal: true, alasanTolak: true, reviewedAt: true },
    }),
  ])

  if (!kartu || !unit) return null

  const barisIni = kartu.baris.find((b) => b.periode === periodeIni)
  const tunggakan = kartu.baris.filter((b) => b.totalKurang > 0)
  // Bulan berjalan tidak disebut "tunggakan" — belum tentu terlambat.
  const tunggakanLampau = tunggakan.filter((b) => b.periode < periodeIni)
  const tagihanBulanan = unit.tarifSampah + unit.tarifSecurity

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">
          Unit {unit.kode} · {unit.namaWarga}
        </h1>
        <p className="mt-0.5 text-sm text-ink-2">
          Blok {unit.blok} No. {unit.nomor} · Iuran {rupiah(tagihanBulanan)}/bulan
        </p>
      </div>

      {menunggu > 0 && (
        <Peringatan nada="ingat" judul={`${menunggu} laporan Anda menunggu verifikasi`}>
          Laporan yang belum diverifikasi bendahara <strong>belum</strong> mengubah status lunas Anda.
          Status akan otomatis diperbarui setelah bendahara menyetujui.
        </Peringatan>
      )}

      {ditolak.length > 0 && (
        <Peringatan
          nada="kritis"
          judul={`${ditolak.length} laporan Anda ditolak bendahara`}
        >
          <ul className="mt-0.5 space-y-1">
            {ditolak.map((t) => (
              <li key={t.id}>
                <span className="tabular font-semibold">{rupiah(t.nominal)}</span>
                {t.reviewedAt && <span> ({tanggalSingkat(t.reviewedAt)})</span>} —{' '}
                {t.alasanTolak ?? 'alasan tidak tercatat, silakan hubungi bendahara'}
              </li>
            ))}
          </ul>
          <p className="mt-1.5">
            Perbaiki sesuai alasan di atas lalu{' '}
            <Link href="/warga/lapor" className="font-semibold underline">
              kirim laporan baru
            </Link>
            . Rinciannya ada di{' '}
            <Link href="/warga/riwayat" className="font-semibold underline">
              riwayat pembayaran
            </Link>
            .
          </p>
        </Peringatan>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Kartu>
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
            {labelPeriode(periodeIni)}
          </p>
          <div className="mt-2">
            {barisIni ? <LencanaStatus status={barisIni.status} /> : <span className="text-sm text-ink-muted">—</span>}
          </div>
          {barisIni && barisIni.totalKurang > 0 && (
            <p className="mt-2 text-xs text-ink-2">
              Kurang <span className="tabular font-semibold">{rupiah(barisIni.totalKurang)}</span>
            </p>
          )}
        </Kartu>

        <KartuAngka
          label="Total tunggakan"
          nilai={rupiah(kartu.totalTunggakan)}
          nada={kartu.totalTunggakan > 0 ? 'kritis' : 'baik'}
          catatan={
            kartu.totalTunggakan > 0
              ? `${kartu.jumlahBulanTunggak} bulan belum lunas${
                  tunggakanLampau.length > 0 ? ` (${tunggakanLampau.length} bulan terlambat)` : ''
                }`
              : 'Semua bulan sudah lunas. Terima kasih.'
          }
        />

        <KartuAngka
          label="Bulan lunas terakhir"
          nilai={kartu.periodeTerakhirLunas ? labelPeriode(kartu.periodeTerakhirLunas) : 'Belum ada'}
          catatan={`Dihitung sejak ${labelPeriode(kartu.baris[0]?.periode ?? periodeIni)}`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/warga/lapor"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2a78d6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#256abf]"
        >
          Lapor pembayaran
        </Link>
        <Link
          href="/warga/riwayat"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink ring-1 ring-inset ring-baseline hover:bg-plane"
        >
          Lihat seluruh riwayat
        </Link>
      </div>

      <Kartu>
        <JudulSeksi keterangan="Rincian per bulan. Sampah dan security dihitung terpisah agar pembayaran sebagian terlihat jelas.">
          Status per bulan
        </JudulSeksi>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-sm">
            <thead>
              <tr className="border-b border-grid text-left text-xs text-ink-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Bulan</th>
                <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Sampah</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Security</th>
                <th scope="col" className="py-2 text-right font-medium">Kurang</th>
              </tr>
            </thead>
            <tbody>
              {[...kartu.baris].reverse().map((b) => (
                <tr
                  key={b.periode}
                  className={`border-b border-grid last:border-0 ${
                    b.periode === periodeIni ? 'bg-[#2a78d6]/4' : ''
                  }`}
                >
                  <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap">
                    {labelPeriode(b.periode)}
                  </th>
                  <td className="py-2 pr-3">
                    <LencanaStatus status={b.status} />
                  </td>
                  <td className="tabular py-2 pr-3 text-right text-ink-2">
                    {b.sampah.wajib === 0 ? (
                      <span className="text-ink-muted">tidak ditagih</span>
                    ) : (
                      `${rupiah(b.sampah.dibayar)} / ${rupiah(b.sampah.wajib)}`
                    )}
                  </td>
                  <td className="tabular py-2 pr-3 text-right text-ink-2">
                    {b.security.wajib === 0 ? (
                      <span className="text-ink-muted">tidak ditagih</span>
                    ) : (
                      `${rupiah(b.security.dibayar)} / ${rupiah(b.security.wajib)}`
                    )}
                  </td>
                  <td className="tabular py-2 text-right font-medium">
                    {b.totalKurang > 0 ? (
                      <span className="text-kritis">{rupiah(b.totalKurang)}</span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {kartu.totalKelebihan > 0 && (
          <p className="mt-3 text-xs text-ink-2">
            Tercatat kelebihan bayar <span className="tabular font-semibold">{rupiah(kartu.totalKelebihan)}</span> pada
            beberapa periode. Konfirmasikan ke bendahara bila ini seharusnya dialihkan ke bulan lain.
          </p>
        )}
      </Kartu>

      <Kartu>
        <JudulSeksi
          aksi={
            <Link href="/warga/riwayat" className="text-xs font-medium text-[#1c5cab] hover:underline">
              Semua riwayat →
            </Link>
          }
        >
          Laporan terakhir
        </JudulSeksi>
        {terakhir.length === 0 ? (
          <Kosong
            pesan="Belum ada laporan pembayaran dari unit Anda."
            aksi={
              <Link
                href="/warga/lapor"
                className="text-sm font-medium text-[#1c5cab] hover:underline"
              >
                Buat laporan pertama
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-grid">
            {terakhir.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    <Nominal nilai={t.nominal} tanda="masuk" />
                    <LencanaStatusTransaksi status={t.status} />
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {tanggalSingkat(t.tanggal)} · {t.metode === 'TUNAI' ? 'Tunai' : 'Transfer'}
                    {t.alokasi.length > 0 && (
                      <> · untuk {[...new Set(t.alokasi.map((a) => labelPeriode(a.periode)))].join(', ')}</>
                    )}
                  </p>
                  {t.status === STATUS.REJECTED && (
                    <p className="mt-1 text-xs text-kritis">
                      Alasan ditolak:{' '}
                      {t.alasanTolak ?? 'tidak tercatat — silakan hubungi bendahara'}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Kartu>
    </div>
  )
}
