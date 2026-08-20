import { db } from '@/lib/db'
import { wajibPengurus } from '@/lib/auth'
import { JENIS_IURAN_LABEL, ROLES, STATUS } from '@/lib/constants'
import { labelPeriode, rupiah, tanggalSingkat, waktu } from '@/lib/format'
import { Kartu, JudulSeksi, Kosong, LencanaStatusTransaksi, Nominal, Peringatan } from '@/components/ui'
import PanelVerifikasi from './panel-verifikasi'

export const metadata = { title: 'Verifikasi Laporan · Kas Cluster' }

export default async function HalamanVerifikasi() {
  const sesi = await wajibPengurus()

  const [menunggu, riwayat] = await Promise.all([
    db.transaction.findMany({
      where: { status: STATUS.PENDING, dibatalkanPada: null },
      orderBy: { createdAt: 'asc' },
      include: {
        unit: { select: { kode: true, namaWarga: true, tarifSampah: true, tarifSecurity: true } },
        alokasi: { orderBy: [{ periode: 'asc' }, { jenisIuran: 'asc' }], include: { tagihanTambahan: { select: { nama: true } } } },
        submittedBy: { select: { nama: true } },
      },
    }),
    db.transaction.findMany({
      where: { status: { in: [STATUS.APPROVED, STATUS.REJECTED] }, unitId: { not: null } },
      orderBy: { reviewedAt: 'desc' },
      take: 12,
      include: {
        unit: { select: { kode: true } },
        reviewedBy: { select: { nama: true } },
      },
    }),
  ])

  const bisaVerifikasi = sesi.role === ROLES.BENDAHARA || sesi.role === ROLES.KETUA

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Verifikasi laporan warga</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {menunggu.length === 0
            ? 'Tidak ada laporan yang menunggu.'
            : `${menunggu.length} laporan menunggu diperiksa.`}
        </p>
      </div>

      <Peringatan nada="info">
        Laporan di bawah ini <strong>belum</strong> memengaruhi saldo kas. Saldo baru berubah setelah Anda
        menyetujui. Periksa nominal, tanggal, dan bulan yang ditandai sebelum memutuskan.
      </Peringatan>

      {menunggu.length === 0 ? (
        <Kartu>
          <Kosong pesan="Antrean verifikasi kosong. Semua laporan warga sudah diperiksa." />
        </Kartu>
      ) : (
        <div className="space-y-3">
          {menunggu.map((t) => {
            const totalAlokasi = t.alokasi.reduce((s, a) => s + a.nominal, 0)
            const belumDialokasi = t.nominal - totalAlokasi
            return (
              <Kartu key={t.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-sm font-semibold text-ink">{t.unit?.kode ?? '—'}</span>
                      <span className="text-sm text-ink-2">{t.unit?.namaWarga}</span>
                      <LencanaStatusTransaksi status={t.status} />
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Dibayar {tanggalSingkat(t.tanggal)} · {t.metode === 'TUNAI' ? 'Tunai' : 'Transfer'} ·
                      dilaporkan {waktu(t.createdAt)}
                      {t.submittedBy && ` oleh ${t.submittedBy.nama}`}
                    </p>
                  </div>
                  <Nominal nilai={t.nominal} tanda="masuk" className="text-lg font-semibold" />
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-ink-muted uppercase">
                    Bulan yang ditandai
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
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

                  {belumDialokasi !== 0 && (
                    <div className="mt-2">
                      <Peringatan nada={belumDialokasi < 0 ? 'kritis' : 'ingat'}>
                        {belumDialokasi > 0 ? (
                          <>
                            <strong>{rupiah(belumDialokasi)}</strong> dari nominal ini belum ditandai untuk bulan
                            mana pun. Uangnya akan tetap masuk kas, tetapi tidak mengurangi tunggakan bulan
                            apa pun.
                          </>
                        ) : (
                          <>
                            Alokasi melebihi nominal sebesar <strong>{rupiah(-belumDialokasi)}</strong>. Laporan
                            ini tidak bisa disetujui sampai warga memperbaikinya — tolak dengan alasan yang jelas.
                          </>
                        )}
                      </Peringatan>
                    </div>
                  )}
                </div>

                {t.remark && (
                  <p className="mt-3 rounded-md bg-plane px-2.5 py-2 text-xs text-ink-2">
                    Catatan warga: {t.remark}
                  </p>
                )}

                {t.buktiUrl && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-[#1c5cab] hover:underline">
                      Lihat bukti transfer
                    </summary>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.buktiUrl}
                      alt={`Bukti transfer unit ${t.unit?.kode}`}
                      className="mt-2 max-w-sm rounded-lg ring-1 ring-hairline"
                    />
                  </details>
                )}

                {bisaVerifikasi ? (
                  <div className="mt-4 border-t border-grid pt-3">
                    <PanelVerifikasi id={t.id} bolehSetujui={belumDialokasi >= 0} />
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-ink-muted">Peran Anda tidak berwenang memverifikasi.</p>
                )}
              </Kartu>
            )
          })}
        </div>
      )}

      <Kartu>
        <JudulSeksi keterangan="Dua belas keputusan verifikasi terakhir.">Riwayat verifikasi</JudulSeksi>
        {riwayat.length === 0 ? (
          <Kosong pesan="Belum ada riwayat verifikasi." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-grid text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Waktu</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Unit</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Nominal</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Hasil</th>
                  <th scope="col" className="py-2 font-medium">Diperiksa oleh</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((t) => (
                  <tr key={t.id} className="border-b border-grid last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-ink-2">
                      {t.reviewedAt ? waktu(t.reviewedAt) : '—'}
                    </td>
                    <td className="tabular py-2 pr-3">{t.unit?.kode ?? '—'}</td>
                    <td className="tabular py-2 pr-3 text-right">{rupiah(t.nominal)}</td>
                    <td className="py-2 pr-3">
                      <LencanaStatusTransaksi status={t.dibatalkanPada ? STATUS.VOID : t.status} />
                    </td>
                    <td className="py-2 text-ink-2">{t.reviewedBy?.nama ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kartu>
    </div>
  )
}
