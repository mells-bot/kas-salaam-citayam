import { wajibLogin } from '@/lib/auth'
import { db } from '@/lib/db'
import { JENIS_IURAN_LABEL, STATUS } from '@/lib/constants'
import { labelPeriode, rupiah, tanggalSingkat, waktu } from '@/lib/format'
import { Kartu, JudulSeksi, Kosong, LencanaStatusTransaksi, Nominal } from '@/components/ui'
import LihatBukti from '@/components/lihat-bukti'
import TombolBatal from './tombol-batal'

export const metadata = { title: 'Riwayat Pembayaran · Kas Cluster' }

export default async function RiwayatWarga() {
  const sesi = await wajibLogin()
  if (!sesi.unitId) return null

  // NF-01: kueri dikunci ke unitId milik sesi, bukan diambil dari parameter URL.
  const daftar = await db.transaction.findMany({
    where: { unitId: sesi.unitId },
    orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
    include: {
      alokasi: { orderBy: [{ periode: 'asc' }, { jenisIuran: 'asc' }], include: { tagihanTambahan: { select: { nama: true } } } },
      reviewedBy: { select: { nama: true } },
    },
  })

  const disetujui = daftar.filter((t) => t.status === STATUS.APPROVED && !t.dibatalkanPada)
  const totalDibayar = disetujui.reduce((s, t) => s + t.nominal, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Riwayat pembayaran</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {disetujui.length} pembayaran disetujui · total{' '}
          <span className="tabular font-medium text-ink">{rupiah(totalDibayar)}</span>
        </p>
      </div>

      <Kartu>
        <JudulSeksi keterangan="Termasuk laporan yang masih menunggu verifikasi, ditolak, dan dibatalkan.">
          Semua laporan
        </JudulSeksi>

        {daftar.length === 0 ? (
          <Kosong pesan="Belum ada laporan pembayaran dari unit Anda." />
        ) : (
          <ul className="divide-y divide-grid">
            {daftar.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Nominal nilai={t.nominal} tanda="masuk" className="text-sm font-semibold" />
                      <LencanaStatusTransaksi status={t.dibatalkanPada ? STATUS.VOID : t.status} />
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Dibayar {tanggalSingkat(t.tanggal)} · {t.metode === 'TUNAI' ? 'Tunai' : 'Transfer'} · dilaporkan{' '}
                      {waktu(t.createdAt)}
                    </p>
                  </div>

                  {t.status === STATUS.PENDING && !t.dibatalkanPada && <TombolBatal id={t.id} />}
                </div>

                {t.alokasi.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {t.alokasi.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-md bg-plane px-2 py-1 text-xs text-ink-2 ring-1 ring-inset ring-hairline"
                      >
                        {a.tagihanTambahan
                          ? a.tagihanTambahan.nama
                          : `${labelPeriode(a.periode)} · ${JENIS_IURAN_LABEL[a.jenisIuran] ?? a.jenisIuran}`}{' '}
                        <span className="tabular font-medium text-ink">{rupiah(a.nominal)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {t.remark && <p className="mt-1.5 text-xs text-ink-2">Catatan: {t.remark}</p>}

                {t.status === STATUS.REJECTED && (
                  <div className="mt-2 rounded-md bg-[#d03b3b]/8 px-2.5 py-2 text-xs text-[#8f2626]">
                    <p className="font-semibold">
                      Ditolak bendahara{t.reviewedBy ? ` (${t.reviewedBy.nama})` : ''}
                      {t.reviewedAt ? ` · ${waktu(t.reviewedAt)}` : ''}
                    </p>
                    <p className="mt-0.5">
                      {t.alasanTolak
                        ? `Alasan: ${t.alasanTolak}`
                        : 'Alasan tidak tercatat pada laporan ini. Hubungi bendahara untuk penjelasannya.'}
                    </p>
                    <p className="mt-1 opacity-80">
                      Silakan perbaiki sesuai alasan di atas, lalu kirim laporan baru.
                    </p>
                  </div>
                )}
                {t.dibatalkanPada && t.alasanPembatalan && (
                  <p className="mt-1.5 text-xs text-ink-muted">{t.alasanPembatalan}</p>
                )}

                <div className="mt-2">
                  {t.buktiUrl ? (
                    <LihatBukti
                      url={t.buktiUrl}
                      label="Lihat bukti pembayaran"
                      keterangan={`${rupiah(t.nominal)} · dibayar ${tanggalSingkat(t.tanggal)}`}
                    />
                  ) : (
                    <p className="text-xs text-ink-muted">Tanpa lampiran bukti.</p>
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
