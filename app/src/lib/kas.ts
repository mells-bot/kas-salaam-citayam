import { db } from './db'
import { JENIS_TRANSAKSI, STATUS, SETTING_SALDO_AWAL } from './constants'
import { periodeDariTanggal, periodeSekarang, rentangPeriode, tambahBulan } from './periode'

/// Hanya transaksi disetujui & tidak dibatalkan yang masuk saldo resmi (F-06, NF-04).
export const FILTER_RESMI = { status: STATUS.APPROVED, dibatalkanPada: null } as const

export async function saldoAwal(): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: SETTING_SALDO_AWAL } })
  const n = Number(s?.value ?? 0)
  return Number.isFinite(n) ? Math.round(n) : 0
}

export interface RingkasanKas {
  saldoAwal: number
  totalMasuk: number
  totalKeluar: number
  saldoAkhir: number
}

/// Ringkasan kas kumulatif sejak awal. Opsional dibatasi sampai tanggal tertentu.
export async function ringkasanKas(hingga?: Date): Promise<RingkasanKas> {
  const where = { ...FILTER_RESMI, ...(hingga ? { tanggal: { lte: hingga } } : {}) }
  const [awal, agg] = await Promise.all([
    saldoAwal(),
    db.transaction.groupBy({
      by: ['jenis'],
      where,
      _sum: { nominal: true },
    }),
  ])
  const totalMasuk = agg.find((a) => a.jenis === JENIS_TRANSAKSI.MASUK)?._sum.nominal ?? 0
  const totalKeluar = agg.find((a) => a.jenis === JENIS_TRANSAKSI.KELUAR)?._sum.nominal ?? 0
  return { saldoAwal: awal, totalMasuk, totalKeluar, saldoAkhir: awal + totalMasuk - totalKeluar }
}

export interface BarisArusKas {
  periode: string
  masuk: number
  keluar: number
  bersih: number
  /// Saldo kas pada akhir periode ini (kumulatif, termasuk saldo awal).
  saldoAkhir: number
}

/// Arus kas per bulan untuk grafik dashboard (F-09).
/// `jumlahBulan` menentukan panjang jendela yang ditampilkan, tapi saldo kumulatif
/// tetap dihitung dari seluruh riwayat agar angkanya benar, bukan cuma jendela ini.
export async function arusKasBulanan(jumlahBulan = 12): Promise<BarisArusKas[]> {
  const akhir = periodeSekarang()
  const mulaiJendela = tambahBulan(akhir, -(jumlahBulan - 1))

  const trx = await db.transaction.findMany({
    where: FILTER_RESMI,
    select: { jenis: true, nominal: true, tanggal: true },
    orderBy: { tanggal: 'asc' },
  })

  const perPeriode = new Map<string, { masuk: number; keluar: number }>()
  for (const t of trx) {
    const p = periodeDariTanggal(t.tanggal)
    const cur = perPeriode.get(p) ?? { masuk: 0, keluar: 0 }
    if (t.jenis === JENIS_TRANSAKSI.MASUK) cur.masuk += t.nominal
    else cur.keluar += t.nominal
    perPeriode.set(p, cur)
  }

  // Saldo berjalan dihitung dari periode paling awal yang ada datanya,
  // supaya saldoAkhir pada baris pertama jendela sudah mencerminkan riwayat sebelumnya.
  const semuaPeriode = [...perPeriode.keys()].sort()
  const awalHitung = semuaPeriode.length > 0 && semuaPeriode[0] < mulaiJendela
    ? semuaPeriode[0]
    : mulaiJendela

  let saldo = await saldoAwal()
  const hasil: BarisArusKas[] = []
  for (const periode of rentangPeriode(awalHitung, akhir)) {
    const { masuk, keluar } = perPeriode.get(periode) ?? { masuk: 0, keluar: 0 }
    saldo += masuk - keluar
    if (periode >= mulaiJendela) {
      hasil.push({ periode, masuk, keluar, bersih: masuk - keluar, saldoAkhir: saldo })
    }
  }
  return hasil
}

/// Ledger dengan kolom saldo berjalan, meniru format buku kas Google Sheets
/// yang sudah dikenal bendahara.
export async function ledgerBerjalan(opts: {
  dari?: Date
  sampai?: Date
  jenis?: string
  unitId?: string
  kategori?: string
} = {}) {
  const where: Record<string, unknown> = { ...FILTER_RESMI }
  if (opts.dari || opts.sampai) {
    where.tanggal = { ...(opts.dari ? { gte: opts.dari } : {}), ...(opts.sampai ? { lte: opts.sampai } : {}) }
  }
  if (opts.jenis) where.jenis = opts.jenis
  if (opts.unitId) where.unitId = opts.unitId
  if (opts.kategori) where.kategori = opts.kategori

  // Saldo berjalan harus akurat, jadi mulai dari saldo sebelum baris pertama.
  const [awal, sebelumnya] = await Promise.all([
    saldoAwal(),
    opts.dari
      ? db.transaction.groupBy({
          by: ['jenis'],
          where: { ...FILTER_RESMI, tanggal: { lt: opts.dari } },
          _sum: { nominal: true },
        })
      : Promise.resolve([]),
  ])

  const masukSebelum = sebelumnya.find((a) => a.jenis === JENIS_TRANSAKSI.MASUK)?._sum.nominal ?? 0
  const keluarSebelum = sebelumnya.find((a) => a.jenis === JENIS_TRANSAKSI.KELUAR)?._sum.nominal ?? 0

  const rows = await db.transaction.findMany({
    where,
    orderBy: [{ tanggal: 'asc' }, { createdAt: 'asc' }],
    include: {
      unit: { select: { kode: true, namaWarga: true } },
      alokasi: { orderBy: [{ periode: 'asc' }, { jenisIuran: 'asc' }] },
    },
  })

  let saldo = awal + masukSebelum - keluarSebelum
  const saldoPembuka = saldo
  const baris = rows.map((t) => {
    const debit = t.jenis === JENIS_TRANSAKSI.MASUK ? t.nominal : 0
    const kredit = t.jenis === JENIS_TRANSAKSI.KELUAR ? t.nominal : 0
    saldo += debit - kredit
    return { ...t, debit, kredit, saldo }
  })

  return { saldoPembuka, baris, saldoPenutup: saldo }
}
