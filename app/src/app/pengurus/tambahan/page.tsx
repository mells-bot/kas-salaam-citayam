import { db } from '@/lib/db'
import { wajibPengurus } from '@/lib/auth'
import { statusTagihanTambahan } from '@/lib/tambahan'
import { ROLES } from '@/lib/constants'
import { labelPeriode, rupiah, waktu } from '@/lib/format'
import { Kartu, JudulSeksi, Kosong, LencanaStatus, Peringatan } from '@/components/ui'
import FormTagihanBaru from './form-tagihan-baru'
import TombolNonaktifkan from './tombol-nonaktifkan'

export const metadata = { title: 'Tagihan Tambahan · Kas Cluster' }

export default async function HalamanTagihanTambahan() {
  const sesi = await wajibPengurus()
  const bendahara = sesi.role === ROLES.BENDAHARA

  const daftar = await db.tagihanTambahan.findMany({
    orderBy: { createdAt: 'desc' },
    include: { dibuatOleh: { select: { nama: true } } },
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Tagihan tambahan</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          THR Ramadan, iuran 17 Agustus, dan tagihan sekali/berkala lain di luar iuran bulanan rutin.
        </p>
      </div>

      <Peringatan nada="info">
        Pembayaran tagihan tambahan tetap melalui alur verifikasi yang sama (Menunggu verifikasi →
        Disetujui/Ditolak di menu <strong>Verifikasi</strong>), dan otomatis masuk saldo kas begitu
        disetujui.
      </Peringatan>

      {bendahara ? (
        <Kartu>
          <JudulSeksi>Buat tagihan baru</JudulSeksi>
          <FormTagihanBaru />
        </Kartu>
      ) : (
        <Peringatan nada="ingat">Hanya Bendahara yang bisa membuat tagihan baru.</Peringatan>
      )}

      {daftar.length === 0 ? (
        <Kartu>
          <Kosong pesan="Belum ada tagihan tambahan yang pernah dibuat." />
        </Kartu>
      ) : (
        <div className="space-y-3">
          {daftar.map((t) => (
            <TagihanCard key={t.id} tagihan={t} bendahara={bendahara} />
          ))}
        </div>
      )}
    </div>
  )
}

async function TagihanCard({
  tagihan,
  bendahara,
}: {
  tagihan: {
    id: string
    nama: string
    periode: string
    cakupan: string
    nominalPerUnit: number | null
    keterangan: string | null
    aktif: boolean
    createdAt: Date
    dibuatOleh: { nama: string } | null
  }
  bendahara: boolean
}) {
  const status = await statusTagihanTambahan(tagihan.id)
  const lunas = status.filter((s) => s.status === 'LUNAS').length
  const sebagian = status.filter((s) => s.status === 'SEBAGIAN').length
  const belum = status.filter((s) => s.status === 'BELUM').length
  const totalTerkumpul = status.reduce((s, x) => s + x.dibayar, 0)
  const totalTarget = status.reduce((s, x) => s + x.wajib, 0)

  const labelCakupan =
    tagihan.cakupan === 'SECURITY'
      ? 'sesuai tarif security tiap unit'
      : tagihan.cakupan === 'PENUH'
        ? 'sesuai tarif penuh tiap unit'
        : `${rupiah(tagihan.nominalPerUnit ?? 0)}/unit (sama rata)`

  return (
    <Kartu>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2">
            <span className="font-semibold text-ink">{tagihan.nama}</span>
            {!tagihan.aktif && (
              <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-xs text-ink-muted">Nonaktif</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {labelPeriode(tagihan.periode)} · {labelCakupan} · dibuat{' '}
            {waktu(tagihan.createdAt)}
            {tagihan.dibuatOleh && ` oleh ${tagihan.dibuatOleh.nama}`}
          </p>
          {tagihan.keterangan && <p className="mt-1 text-xs text-ink-2">{tagihan.keterangan}</p>}
        </div>
        {bendahara && tagihan.aktif && <TombolNonaktifkan id={tagihan.id} />}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-ink-muted">Terkumpul</p>
          <p className="tabular text-sm font-semibold text-ink">
            {rupiah(totalTerkumpul)}{' '}
            <span className="font-normal text-ink-muted">/ {rupiah(totalTarget)}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Lunas</p>
          <p className="tabular text-sm font-semibold text-[--color-sukses-teks]">{lunas} unit</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Sebagian</p>
          <p className="tabular text-sm font-semibold">{sebagian} unit</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Belum bayar</p>
          <p className="tabular text-sm font-semibold text-kritis">{belum} unit</p>
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-[#1c5cab] hover:underline">
          Lihat rincian per unit
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-grid text-left text-xs text-ink-muted">
                <th scope="col" className="py-1.5 pr-3 font-medium">Unit</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Nama</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Status</th>
                <th scope="col" className="py-1.5 text-right font-medium">Kurang</th>
              </tr>
            </thead>
            <tbody>
              {status.map((s) => (
                <tr key={s.unitId} className="border-b border-grid last:border-0">
                  <td className="tabular py-1.5 pr-3 font-medium">{s.kode}</td>
                  <td className="py-1.5 pr-3 text-ink-2">
                    <span className="block max-w-[12rem] truncate">{s.namaWarga}</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <LencanaStatus status={s.status} />
                  </td>
                  <td className="tabular py-1.5 text-right">
                    {s.kurang > 0 ? (
                      <span className="font-medium text-kritis">{rupiah(s.kurang)}</span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Kartu>
  )
}
