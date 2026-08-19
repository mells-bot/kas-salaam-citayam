'use client'

import { useId, useState } from 'react'
import { labelPeriode, labelPeriodeSingkat, rupiah, rupiahRingkas } from '@/lib/format'

/*
 * Grafik dibangun tanpa pustaka charting: bar memakai elemen HTML (responsif
 * sempurna, hover mudah, teks tidak terdistorsi) dan garis memakai SVG dengan
 * label tetap di lapisan HTML. Nol dependensi tambahan, nol biaya.
 *
 * Warna: slot kategorikal 1 (#2a78d6) & 2 (#eb6834) — sudah divalidasi,
 * pemisahan CVD ΔE 24.7 terhadap surface #fcfcfb.
 */

const SERI_MASUK = '#2a78d6'
const SERI_KELUAR = '#eb6834'

export interface TitikArusKas {
  periode: string
  masuk: number
  keluar: number
  bersih: number
  saldoAkhir: number
}

function Legenda({ item }: { item: { warna: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {item.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.warna }} aria-hidden="true" />
          {i.label}
        </span>
      ))}
    </div>
  )
}

function TombolTabel({ aktif, onClick }: { aktif: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 ring-1 ring-inset ring-baseline hover:bg-plane"
    >
      {aktif ? 'Lihat grafik' : 'Lihat tabel'}
    </button>
  )
}

/**
 * Arus kas bulanan: pemasukan vs pengeluaran (F-09).
 * Dua seri berdampingan pada SATU skala — bukan dua sumbu-Y, karena keduanya
 * dalam satuan rupiah yang sama dan harus bisa dibandingkan langsung.
 */
export function GrafikArusKas({ data }: { data: TitikArusKas[] }) {
  const [tabel, setTabel] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">Belum ada data arus kas.</p>
  }

  const maks = Math.max(1, ...data.flatMap((d) => [d.masuk, d.keluar]))
  // Sumbu dibulatkan ke atas ke 500 ribu terdekat supaya garis bantu jadi angka bulat.
  const batas = Math.ceil(maks / 500_000) * 500_000
  const garisBantu = [0, 0.25, 0.5, 0.75, 1].map((f) => f * batas)

  if (tabel) {
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <TombolTabel aktif onClick={() => setTabel(false)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Arus kas bulanan</caption>
            <thead>
              <tr className="border-b border-grid text-left text-xs text-ink-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Bulan</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Masuk</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Keluar</th>
                <th scope="col" className="py-2 text-right font-medium">Selisih</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.map((d) => (
                <tr key={d.periode} className="border-b border-grid last:border-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">{labelPeriode(d.periode)}</th>
                  <td className="py-1.5 pr-3 text-right">{rupiah(d.masuk)}</td>
                  <td className="py-1.5 pr-3 text-right">{rupiah(d.keluar)}</td>
                  <td className="py-1.5 text-right">{rupiah(d.bersih)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Legenda
          item={[
            { warna: SERI_MASUK, label: 'Pemasukan' },
            { warna: SERI_KELUAR, label: 'Pengeluaran' },
          ]}
        />
        <TombolTabel aktif={false} onClick={() => setTabel(true)} />
      </div>

      <div className="flex gap-2">
        {/* Sumbu nilai */}
        <div className="relative w-11 shrink-0" style={{ height: 200 }} aria-hidden="true">
          {garisBantu.map((g) => (
            <span
              key={g}
              className="tabular absolute right-0 -translate-y-1/2 text-[10px] text-ink-muted"
              style={{ bottom: `${(g / batas) * 100}%` }}
            >
              {g === 0 ? '0' : rupiahRingkas(g)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: 200 }}>
            {/* Garis bantu resesif */}
            {garisBantu.map((g) => (
              <span
                key={g}
                className="absolute inset-x-0 border-t"
                style={{
                  bottom: `${(g / batas) * 100}%`,
                  borderColor: g === 0 ? 'var(--color-baseline)' : 'var(--color-grid)',
                }}
                aria-hidden="true"
              />
            ))}

            <div className="absolute inset-0 flex items-end">
              {data.map((d, i) => (
                <div
                  key={d.periode}
                  className="group relative flex h-full flex-1 items-end justify-center gap-[2px] px-[3px]"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${labelPeriode(d.periode)}: masuk ${rupiah(d.masuk)}, keluar ${rupiah(d.keluar)}`}
                >
                  {/* Ujung batang dibulatkan 4px, dijangkarkan ke garis dasar */}
                  <span
                    className="w-full max-w-[14px] rounded-t-[4px]"
                    style={{ height: `${(d.masuk / batas) * 100}%`, background: SERI_MASUK, minHeight: d.masuk > 0 ? 2 : 0 }}
                  />
                  <span
                    className="w-full max-w-[14px] rounded-t-[4px]"
                    style={{ height: `${(d.keluar / batas) * 100}%`, background: SERI_KELUAR, minHeight: d.keluar > 0 ? 2 : 0 }}
                  />

                  {hover === i && (
                    <div className="pointer-events-none absolute bottom-full z-20 mb-2 w-max min-w-[150px] rounded-lg bg-ink px-2.5 py-2 text-xs text-white shadow-lg">
                      <p className="font-semibold">{labelPeriode(d.periode)}</p>
                      <p className="tabular mt-1 flex justify-between gap-3">
                        <span className="text-white/70">Masuk</span>
                        <span>{rupiah(d.masuk)}</span>
                      </p>
                      <p className="tabular flex justify-between gap-3">
                        <span className="text-white/70">Keluar</span>
                        <span>{rupiah(d.keluar)}</span>
                      </p>
                      <p className="tabular mt-1 flex justify-between gap-3 border-t border-white/20 pt-1">
                        <span className="text-white/70">Selisih</span>
                        <span>{rupiah(d.bersih)}</span>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sumbu bulan — label diselang bila terlalu rapat */}
          <div className="mt-1.5 flex">
            {data.map((d, i) => (
              <div key={d.periode} className="min-w-0 flex-1 text-center">
                <span
                  className={`block truncate text-[10px] text-ink-muted ${
                    data.length > 8 && i % 2 === 1 ? 'sm:inline hidden' : ''
                  }`}
                >
                  {labelPeriodeSingkat(d.periode)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Tren saldo kas. Satu seri, jadi tidak perlu legenda — judulnya sudah menamai.
 */
export function GrafikSaldo({ data }: { data: TitikArusKas[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const clipId = useId()

  if (data.length < 2) {
    return <p className="py-8 text-center text-sm text-ink-muted">Butuh minimal dua bulan data untuk menampilkan tren.</p>
  }

  const nilai = data.map((d) => d.saldoAkhir)
  const min = Math.min(...nilai, 0)
  const maks = Math.max(...nilai)
  const rentang = maks - min || 1
  // Beri ruang 10% di atas & bawah agar garis tidak menempel tepi.
  const bawah = min - rentang * 0.1
  const atas = maks + rentang * 0.1
  const span = atas - bawah

  const x = (i: number) => (i / (data.length - 1)) * 100
  const y = (v: number) => 100 - ((v - bawah) / span) * 100

  const titik = data.map((d, i) => `${x(i)},${y(d.saldoAkhir)}`).join(' ')
  const area = `0,100 ${titik} 100,100`
  const aktif = hover ?? data.length - 1

  return (
    <div>
      <div className="relative" style={{ height: 180 }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`grad-${clipId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERI_MASUK} stopOpacity="0.18" />
              <stop offset="100%" stopColor={SERI_MASUK} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#grad-${clipId})`} />
          {/* vector-effect menjaga ketebalan garis tetap 2px meski viewBox dipaksa non-uniform */}
          <polyline
            points={titik}
            fill="none"
            stroke={SERI_MASUK}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Penanda & area hover di lapisan HTML agar ukurannya tidak terdistorsi */}
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <div
              key={d.periode}
              className="relative min-w-0 flex-1"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              role="img"
              aria-label={`Saldo akhir ${labelPeriode(d.periode)}: ${rupiah(d.saldoAkhir)}`}
            >
              {(hover === i || i === data.length - 1) && (
                <>
                  <span
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                    style={{
                      left: `${(i / (data.length - 1)) * 100}%`,
                      top: `${y(d.saldoAkhir)}%`,
                      width: 9,
                      height: 9,
                      background: SERI_MASUK,
                      // Cincin 2px sewarna surface memisahkan penanda dari garis.
                      boxShadow: '0 0 0 2px var(--color-surface)',
                    }}
                  />
                  {hover === i && (
                    <div
                      className="pointer-events-none absolute z-20 w-max -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
                      style={{
                        left: `${(i / (data.length - 1)) * 100}%`,
                        top: `${y(d.saldoAkhir)}%`,
                        marginTop: -46,
                      }}
                    >
                      <span className="text-white/70">{labelPeriode(d.periode)} · </span>
                      <span className="tabular font-semibold">{rupiah(d.saldoAkhir)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-ink-muted">
        <span>{labelPeriodeSingkat(data[0].periode)}</span>
        <span className="tabular">
          Saldo {labelPeriodeSingkat(data[aktif].periode)}: {rupiah(data[aktif].saldoAkhir)}
        </span>
        <span>{labelPeriodeSingkat(data[data.length - 1].periode)}</span>
      </div>
    </div>
  )
}

/**
 * Komposisi status iuran satu periode. Satu batang bertumpuk lebih tepat
 * daripada donat: yang dibaca adalah "berapa dari 34", bukan sudut.
 * Memakai status palette + ikon + label, bukan warna saja.
 */
export function BatangStatusIuran({
  lunas,
  sebagian,
  belum,
}: {
  lunas: number
  sebagian: number
  belum: number
}) {
  const total = lunas + sebagian + belum
  if (total === 0) return <p className="text-sm text-ink-muted">Belum ada unit terdaftar.</p>

  const segmen = [
    { label: 'Lunas', jumlah: lunas, warna: '#0ca30c' },
    { label: 'Sebagian', jumlah: sebagian, warna: '#fab219' },
    { label: 'Belum bayar', jumlah: belum, warna: '#d03b3b' },
  ].filter((s) => s.jumlah > 0)

  return (
    <div>
      {/* Celah 2px sewarna surface memisahkan segmen yang bersebelahan */}
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {segmen.map((s) => (
          <span
            key={s.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.jumlah / total) * 100}%`, background: s.warna }}
            title={`${s.label}: ${s.jumlah} unit`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segmen.map((s) => (
          <span key={s.label} className="inline-flex items-baseline gap-1.5 text-xs text-ink-2">
            <span className="h-2.5 w-2.5 translate-y-0.5 rounded-sm" style={{ background: s.warna }} aria-hidden="true" />
            {s.label}
            <span className="tabular font-semibold text-ink">{s.jumlah}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
