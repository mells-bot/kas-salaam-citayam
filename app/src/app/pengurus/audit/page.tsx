import Link from 'next/link'
import { db } from '@/lib/db'
import { wajibPengurus } from '@/lib/auth'
import { waktu } from '@/lib/format'
import { Kartu, Kosong, Peringatan } from '@/components/ui'

export const metadata = { title: 'Jejak Audit · Kas Cluster' }

const PER_HALAMAN = 60

const LABEL_AKSI: Record<string, string> = {
  LOGIN: 'Masuk',
  LOGIN_GAGAL: 'Gagal masuk',
  LAPOR_BAYAR: 'Lapor bayar',
  BATAL_LAPORAN: 'Batal laporan',
  SETUJUI: 'Setujui',
  TOLAK: 'Tolak',
  BATALKAN_TRANSAKSI: 'Batalkan transaksi',
  INPUT_PENGELUARAN: 'Input pengeluaran',
  INPUT_PEMASUKAN_LAIN: 'Input pemasukan lain',
  INPUT_IURAN_ATAS_NAMA_WARGA: 'Input iuran warga',
  TAMBAH_UNIT: 'Tambah unit',
  UBAH_UNIT: 'Ubah unit',
  RESET_PIN: 'Reset PIN',
  GANTI_PIN: 'Ganti PIN',
  UBAH_PENGATURAN: 'Ubah pengaturan',
  SEED: 'Data awal',
}

/** Aksi yang mengubah uang atau hak akses diberi penanda visual. */
const AKSI_PENTING = new Set([
  'SETUJUI',
  'TOLAK',
  'BATALKAN_TRANSAKSI',
  'INPUT_PENGELUARAN',
  'INPUT_PEMASUKAN_LAIN',
  'INPUT_IURAN_ATAS_NAMA_WARGA',
  'RESET_PIN',
  'UBAH_PENGATURAN',
])

interface Params {
  searchParams: Promise<{ hal?: string; aksi?: string }>
}

export default async function HalamanAudit({ searchParams }: Params) {
  await wajibPengurus()
  const sp = await searchParams

  const halaman = Math.max(1, Number(sp.hal) || 1)
  const filterAksi = sp.aksi && sp.aksi in LABEL_AKSI ? sp.aksi : undefined
  const where = filterAksi ? { aksi: filterAksi } : {}

  const [log, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
    }),
    db.auditLog.count({ where }),
  ])

  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Jejak audit</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {total.toLocaleString('id-ID')} catatan · halaman {halaman} dari {totalHalaman}
        </p>
      </div>

      <Peringatan nada="info">
        Setiap input, persetujuan, penolakan, dan pembatalan tercatat di sini beserta pelakunya dan waktunya.
        Catatan audit tidak bisa diubah atau dihapus dari dalam aplikasi.
      </Peringatan>

      <Kartu padat className="no-print">
        <form className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="aksi" className="mb-1 block text-xs font-medium text-ink-2">
              Jenis aksi
            </label>
            <select
              id="aksi"
              name="aksi"
              defaultValue={filterAksi ?? ''}
              className="rounded-lg border border-baseline bg-white px-2.5 py-1.5 text-sm"
            >
              <option value="">Semua aksi</option>
              {Object.entries(LABEL_AKSI).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#2a78d6] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#256abf]"
          >
            Terapkan
          </button>
          <Link
            href="/pengurus/audit"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 ring-1 ring-inset ring-baseline hover:bg-plane"
          >
            Reset
          </Link>
        </form>
      </Kartu>

      <Kartu padat>
        {log.length === 0 ? (
          <Kosong pesan="Tidak ada catatan audit yang cocok." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-grid text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 pr-3 pl-1 font-medium">Waktu</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Pelaku</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Aksi</th>
                  <th scope="col" className="py-2 font-medium">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id} className="border-b border-grid align-top last:border-0 hover:bg-plane">
                    <td className="py-2 pr-3 pl-1 whitespace-nowrap text-ink-2">{waktu(l.createdAt)}</td>
                    <td className="py-2 pr-3">
                      <span className="block max-w-[13rem] truncate">{l.actorNama}</span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                          AKSI_PENTING.has(l.aksi)
                            ? 'bg-[#2a78d6]/10 text-[#1c5cab]'
                            : 'bg-black/5 text-ink-2'
                        }`}
                      >
                        {LABEL_AKSI[l.aksi] ?? l.aksi}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="block">{l.ringkasan}</span>
                      {l.detail && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink-2">
                            Detail teknis
                          </summary>
                          <pre className="mt-1 max-w-[42rem] overflow-x-auto rounded bg-plane p-2 text-[11px] whitespace-pre-wrap text-ink-2">
                            {formatDetail(l.detail)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kartu>

      {totalHalaman > 1 && (
        <nav className="no-print flex items-center justify-between">
          {halaman > 1 ? (
            <Link
              href={`/pengurus/audit?hal=${halaman - 1}${filterAksi ? `&aksi=${filterAksi}` : ''}`}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 ring-1 ring-inset ring-baseline hover:bg-plane"
            >
              ← Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ink-muted">
            Halaman {halaman} / {totalHalaman}
          </span>
          {halaman < totalHalaman ? (
            <Link
              href={`/pengurus/audit?hal=${halaman + 1}${filterAksi ? `&aksi=${filterAksi}` : ''}`}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 ring-1 ring-inset ring-baseline hover:bg-plane"
            >
              Berikutnya →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}

/** Detail disimpan sebagai JSON string; tampilkan rapi bila valid. */
function formatDetail(detail: string) {
  try {
    return JSON.stringify(JSON.parse(detail), null, 2)
  } catch {
    return detail
  }
}
