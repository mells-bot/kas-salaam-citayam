/// Utilitas periode iuran. Periode selalu string "YYYY-MM" agar bisa
/// diurutkan & dibandingkan secara leksikografis tanpa konversi tanggal.

export function periodeSekarang(now: Date = new Date()): string {
  return toPeriode(now.getFullYear(), now.getMonth() + 1)
}

export function toPeriode(tahun: number, bulan: number): string {
  return `${tahun}-${String(bulan).padStart(2, '0')}`
}

export function parsePeriode(periode: string): { tahun: number; bulan: number } {
  const [y, m] = periode.split('-')
  return { tahun: Number(y), bulan: Number(m) }
}

export function isPeriodeValid(periode: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(periode)) return false
  const { tahun, bulan } = parsePeriode(periode)
  return tahun >= 2015 && tahun <= 2100 && bulan >= 1 && bulan <= 12
}

export function tambahBulan(periode: string, delta: number): string {
  const { tahun, bulan } = parsePeriode(periode)
  const total = tahun * 12 + (bulan - 1) + delta
  return toPeriode(Math.floor(total / 12), (total % 12) + 1)
}

/// Daftar periode inklusif dari `dari` sampai `sampai`.
/// Mengembalikan [] jika `dari` lebih besar dari `sampai`.
export function rentangPeriode(dari: string, sampai: string): string[] {
  if (!isPeriodeValid(dari) || !isPeriodeValid(sampai) || dari > sampai) return []
  const hasil: string[] = []
  let p = dari
  // Batas aman 1200 bulan (100 tahun) supaya data kotor tak bikin loop tak berujung.
  for (let i = 0; i < 1200 && p <= sampai; i++) {
    hasil.push(p)
    p = tambahBulan(p, 1)
  }
  return hasil
}

/// Periode dari objek Date (dipakai saat mengelompokkan transaksi per bulan kas).
export function periodeDariTanggal(d: Date): string {
  return toPeriode(d.getFullYear(), d.getMonth() + 1)
}
