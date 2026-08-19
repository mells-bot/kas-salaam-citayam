import Link from 'next/link'
import { db } from '@/lib/db'
import { wajibPengurus } from '@/lib/auth'
import { ledgerBerjalan } from '@/lib/kas'
import { JENIS_IURAN_LABEL, JENIS_TRANSAKSI, KATEGORI_PENGELUARAN, ROLES, STATUS } from '@/lib/constants'
import { labelPeriode, rupiah, tanggalSingkat } from '@/lib/format'
import { Kartu, JudulSeksi, Kosong, Nominal, Peringatan } from '@/components/ui'
import TombolBatalkan from './tombol-batalkan'

export const metadata = { title: 'Buku Kas · Kas Cluster' }

interface Params {
  searchParams: Promise<{ dari?: string; sampai?: string; jenis?: string; kategori?: string; unit?: string }>
}

function tanggalAtauUndefined(s?: string) {
  if (!s) return undefined
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export default async function HalamanLedger({ searchParams }: Params) {
  const sesi = await wajibPengurus()
  const sp = await searchParams

  const dari = tanggalAtauUndefined(sp.dari)
  // Batas akhir digeser ke penghujung hari agar transaksi pada tanggal itu ikut.
  const sampaiMentah = tanggalAtauUndefined(sp.sampai)
  const sampai = sampaiMentah ? new Date(sampaiMentah.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined

  const jenis = sp.jenis === 'MASUK' || sp.jenis === 'KELUAR' ? sp.jenis : undefined
  const kategori = sp.kategori && KATEGORI_PENGELUARAN.includes(sp.kategori as never) ? sp.kategori : undefined

  const [{ saldoPembuka, baris, saldoPenutup }, unitList] = await Promise.all([
    ledgerBerjalan({ dari, sampai, jenis, kategori, unitId: sp.unit || undefined }),
    db.unit.findMany({ orderBy: [{ urutan: 'asc' }, { kode: 'asc' }], select: { id: true, kode: true, namaWarga: true } }),
  ])

  const totalMasuk = baris.reduce((s, b) => s + b.debit, 0)
  const totalKeluar = baris.reduce((s, b) => s + b.kredit, 0)
  const bendahara = sesi.role === ROLES.BENDAHARA

  const paramEkspor = new URLSearchParams()
  for (const [k, v] of Object.entries({ dari: sp.dari, sampai: sp.sampai, jenis, kategori, unit: sp.unit })) {
    if (v) paramEkspor.set(k, v)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-ink">Buku kas</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            {baris.length} transaksi resmi ditampilkan · saldo akhir{' '}
            <span className="tabular font-medium text-ink">{rupiah(saldoPenutup)}</span>
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <a
            href={`/api/ekspor/ledger?${paramEkspor.toString()}`}
            className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink ring-1 ring-inset ring-baseline hover:bg-plane"
          >
            Ekspor CSV
          </a>
          {bendahara && (
            <Link
              href="/pengurus/ledger/baru"
              className="rounded-lg bg-[#2a78d6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#256abf]"
            >
              Catat transaksi
            </Link>
          )}
        </div>
      </div>

      <Peringatan nada="info">
        Hanya transaksi yang <strong>sudah disetujui</strong> dan belum dibatalkan yang muncul di sini —
        inilah sumber kebenaran saldo kas. Laporan yang menunggu verifikasi ada di menu Verifikasi.
      </Peringatan>

      {/* Filter dalam satu baris di atas tabel */}
      <Kartu padat className="no-print">
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Dari tanggal</label>
            <input
              type="date"
              name="dari"
              defaultValue={sp.dari ?? ''}
              className="w-full rounded-lg border border-baseline bg-white px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Sampai tanggal</label>
            <input
              type="date"
              name="sampai"
              defaultValue={sp.sampai ?? ''}
              className="w-full rounded-lg border border-baseline bg-white px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Jenis</label>
            <select
              name="jenis"
              defaultValue={jenis ?? ''}
              className="w-full rounded-lg border border-baseline bg-white px-2.5 py-1.5 text-sm"
            >
              <option value="">Semua</option>
              <option value="MASUK">Pemasukan</option>
              <option value="KELUAR">Pengeluaran</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Kategori keluar</label>
            <select
              name="kategori"
              defaultValue={kategori ?? ''}
              className="w-full rounded-lg border border-baseline bg-white px-2.5 py-1.5 text-sm"
            >
              <option value="">Semua</option>
              {KATEGORI_PENGELUARAN.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Unit</label>
            <select
              name="unit"
              defaultValue={sp.unit ?? ''}
              className="w-full rounded-lg border border-baseline bg-white px-2.5 py-1.5 text-sm"
            >
              <option value="">Semua</option>
              {unitList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.kode} — {u.namaWarga}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[#2a78d6] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#256abf]"
            >
              Terapkan
            </button>
            <Link
              href="/pengurus/ledger"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 ring-1 ring-inset ring-baseline hover:bg-plane"
            >
              Reset
            </Link>
          </div>
        </form>
      </Kartu>

      <Kartu padat>
        {baris.length === 0 ? (
          <Kosong pesan="Tidak ada transaksi yang cocok dengan filter ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Buku kas dengan saldo berjalan</caption>
              <thead>
                <tr className="border-b border-grid text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 pr-2 pl-1 font-medium">Tanggal</th>
                  <th scope="col" className="py-2 pr-2 font-medium">Uraian</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">Debit</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">Kredit</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">Saldo</th>
                  {bendahara && <th scope="col" className="no-print py-2 pl-2 font-medium" />}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-grid bg-plane">
                  <td className="py-2 pr-2 pl-1 text-xs text-ink-muted" colSpan={4}>
                    Saldo pembuka {dari ? `sebelum ${tanggalSingkat(dari)}` : '(saldo awal sistem)'}
                  </td>
                  <td className="tabular py-2 pr-2 text-right font-medium">{rupiah(saldoPembuka)}</td>
                  {bendahara && <td className="no-print" />}
                </tr>

                {baris.map((b) => (
                  <tr key={b.id} className="border-b border-grid align-top hover:bg-plane">
                    <td className="py-2 pr-2 pl-1 whitespace-nowrap text-ink-2">{tanggalSingkat(b.tanggal)}</td>
                    <td className="py-2 pr-2">
                      <span className="block font-medium text-ink">{b.uraian}</span>
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {b.kategori && <span className="mr-1.5">{b.kategori}</span>}
                        {b.metode === 'TUNAI' ? 'Tunai' : 'Transfer'}
                        {b.alokasi.length > 0 && (
                          <>
                            {' · '}
                            {b.alokasi
                              .map(
                                (a) =>
                                  `${labelPeriode(a.periode)} ${JENIS_IURAN_LABEL[a.jenisIuran] ?? a.jenisIuran}`,
                              )
                              .join(', ')}
                          </>
                        )}
                      </span>
                      {b.remark && <span className="mt-0.5 block text-xs text-ink-2">{b.remark}</span>}
                    </td>
                    <td className="tabular py-2 pr-2 text-right">
                      {b.debit > 0 ? <Nominal nilai={b.debit} /> : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="tabular py-2 pr-2 text-right">
                      {b.kredit > 0 ? <Nominal nilai={b.kredit} /> : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="tabular py-2 pr-2 text-right font-medium">{rupiah(b.saldo)}</td>
                    {bendahara && (
                      <td className="no-print py-2 pl-2 text-right">
                        <TombolBatalkan id={b.id} uraian={b.uraian} nominal={b.nominal} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2 pr-2 pl-1 text-xs text-ink-2" colSpan={2}>
                    Total periode ditampilkan
                  </td>
                  <td className="tabular py-2 pr-2 text-right">{rupiah(totalMasuk)}</td>
                  <td className="tabular py-2 pr-2 text-right">{rupiah(totalKeluar)}</td>
                  <td className="tabular py-2 pr-2 text-right">{rupiah(saldoPenutup)}</td>
                  {bendahara && <td className="no-print" />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Kartu>

      <Kartu>
        <JudulSeksi keterangan="Transaksi yang dibatalkan tetap disimpan dan tidak pernah dihapus permanen.">
          Transaksi dibatalkan
        </JudulSeksi>
        <TabelDibatalkan />
      </Kartu>
    </div>
  )
}

/** Daftar transaksi yang dibatalkan — bukti bahwa tidak ada data yang hilang (NF-04). */
async function TabelDibatalkan() {
  const daftar = await db.transaction.findMany({
    where: { OR: [{ status: STATUS.VOID }, { dibatalkanPada: { not: null } }] },
    orderBy: { dibatalkanPada: 'desc' },
    take: 15,
    include: { unit: { select: { kode: true } } },
  })

  if (daftar.length === 0) {
    return <p className="text-sm text-ink-muted">Belum ada transaksi yang dibatalkan.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-grid text-left text-xs text-ink-muted">
            <th scope="col" className="py-2 pr-3 font-medium">Tanggal</th>
            <th scope="col" className="py-2 pr-3 font-medium">Uraian</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Nominal</th>
            <th scope="col" className="py-2 font-medium">Alasan</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((t) => (
            <tr key={t.id} className="border-b border-grid last:border-0">
              <td className="py-2 pr-3 whitespace-nowrap text-ink-2">{tanggalSingkat(t.tanggal)}</td>
              <td className="py-2 pr-3">
                {t.uraian}
                {t.unit && <span className="tabular ml-1.5 text-xs text-ink-muted">({t.unit.kode})</span>}
              </td>
              <td className="tabular py-2 pr-3 text-right text-ink-2 line-through">{rupiah(t.nominal)}</td>
              <td className="py-2 text-xs text-ink-2">
                {t.alasanPembatalan ?? t.alasanTolak ?? '—'}
                {t.jenis === JENIS_TRANSAKSI.KELUAR && ' '}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
