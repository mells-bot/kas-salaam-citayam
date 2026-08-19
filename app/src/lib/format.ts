const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/// Semua nominal berupa Int rupiah penuh, jadi tidak ada desimal.
export function rupiah(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}Rp${Math.abs(Math.round(n)).toLocaleString('id-ID')}`
}

/// Varian ringkas untuk label grafik: 1.750.000 -> "1,75 jt"
export function rupiahRingkas(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} rb`
  return `${sign}${abs}`
}

export function tanggal(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return `${dt.getDate()} ${NAMA_BULAN[dt.getMonth()]} ${dt.getFullYear()}`
}

export function tanggalSingkat(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function waktu(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return `${tanggalSingkat(dt)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

/// "2026-01" -> "Januari 2026"
export function labelPeriode(periode: string): string {
  const [y, m] = periode.split('-')
  const idx = Number(m) - 1
  if (!NAMA_BULAN[idx]) return periode
  return `${NAMA_BULAN[idx]} ${y}`
}

/// "2026-01" -> "Jan 26"
export function labelPeriodeSingkat(periode: string): string {
  const [y, m] = periode.split('-')
  const idx = Number(m) - 1
  if (!NAMA_BULAN[idx]) return periode
  return `${NAMA_BULAN[idx].slice(0, 3)} ${y.slice(2)}`
}

export { NAMA_BULAN }
