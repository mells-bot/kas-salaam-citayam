'use client'

import { useRouter } from 'next/navigation'
import { labelPeriode } from '@/lib/format'

/// Pemilih bulan + tombol cetak. Cetak memakai dialog peramban, sehingga
/// "simpan sebagai PDF" tersedia tanpa pustaka PDF apa pun.
export default function PemilihPeriodeLaporan({
  periode,
  tersedia,
}: {
  periode: string
  tersedia: string[]
}) {
  const router = useRouter()

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="periode" className="mb-1 block text-xs font-medium text-ink-2">
          Bulan laporan
        </label>
        <select
          id="periode"
          value={periode}
          onChange={(e) => router.push(`/pengurus/laporan?periode=${e.target.value}`)}
          className="rounded-lg border border-baseline bg-white px-2.5 py-1.5 text-sm"
        >
          {tersedia.map((p) => (
            <option key={p} value={p}>
              {labelPeriode(p)}
            </option>
          ))}
        </select>
      </div>

      <a
        href={`/api/ekspor/ledger?dari=${periode}-01&sampai=${akhirBulan(periode)}`}
        className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink ring-1 ring-inset ring-baseline hover:bg-plane"
      >
        Ekspor CSV
      </a>
      <a
        href={`/api/ekspor/tunggakan?periode=${periode}`}
        className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink ring-1 ring-inset ring-baseline hover:bg-plane"
      >
        CSV tunggakan
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-[#2a78d6] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#256abf]"
      >
        Cetak / simpan PDF
      </button>
    </div>
  )
}

function akhirBulan(periode: string) {
  const [y, m] = periode.split('-').map(Number)
  // Hari ke-0 bulan berikutnya adalah hari terakhir bulan ini.
  const d = new Date(y, m, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
