import { db } from './db'
import { JENIS_IURAN, STATUS } from './constants'
import { periodeSekarang, rentangPeriode } from './periode'

export type StatusPeriode = 'LUNAS' | 'SEBAGIAN' | 'BELUM'

export interface RincianJenis {
  wajib: number
  dibayar: number
  kurang: number
}

export interface BarisPeriode {
  periode: string
  status: StatusPeriode
  totalWajib: number
  totalDibayar: number
  totalKurang: number
  sampah: RincianJenis
  security: RincianJenis
}

export interface KartuIuranUnit {
  unitId: string
  kode: string
  namaWarga: string
  blok: string
  nomor: string
  baris: BarisPeriode[]
  totalTunggakan: number
  jumlahBulanTunggak: number
  /// Kelebihan bayar: alokasi yang melampaui tarif pada periode tertentu.
  totalKelebihan: number
  periodeTerakhirLunas: string | null
}

type UnitRingkas = {
  id: string
  kode: string
  blok: string
  nomor: string
  namaWarga: string
  tarifSampah: number
  tarifSecurity: number
  mulaiPeriode: string
}

/// Menjumlahkan alokasi yang SUDAH DISETUJUI, dikelompokkan per unit+periode+jenis.
/// Hanya status APPROVED yang dihitung — laporan pending tidak boleh mengubah
/// status lunas seorang warga (F-03).
async function ambilAlokasiDisetujui(unitIds: string[]) {
  const rows = await db.allocation.findMany({
    where: {
      transaction: {
        status: STATUS.APPROVED,
        dibatalkanPada: null,
        unitId: { in: unitIds },
      },
    },
    select: {
      periode: true,
      jenisIuran: true,
      nominal: true,
      transaction: { select: { unitId: true } },
    },
  })

  // key: `${unitId}|${periode}|${jenisIuran}`
  const peta = new Map<string, number>()
  for (const r of rows) {
    const unitId = r.transaction.unitId
    if (!unitId) continue
    const key = `${unitId}|${r.periode}|${r.jenisIuran}`
    peta.set(key, (peta.get(key) ?? 0) + r.nominal)
  }
  return peta
}

function hitungRincian(wajib: number, dibayar: number): RincianJenis {
  return { wajib, dibayar, kurang: Math.max(0, wajib - dibayar) }
}

function bangunKartu(
  unit: UnitRingkas,
  peta: Map<string, number>,
  hinggaPeriode: string,
): KartuIuranUnit {
  const periodeList = rentangPeriode(unit.mulaiPeriode, hinggaPeriode)
  const baris: BarisPeriode[] = []
  let totalTunggakan = 0
  let totalKelebihan = 0
  let periodeTerakhirLunas: string | null = null

  for (const periode of periodeList) {
    const bayarSampah = peta.get(`${unit.id}|${periode}|${JENIS_IURAN.SAMPAH}`) ?? 0
    const bayarSecurity = peta.get(`${unit.id}|${periode}|${JENIS_IURAN.SECURITY}`) ?? 0

    const sampah = hitungRincian(unit.tarifSampah, bayarSampah)
    const security = hitungRincian(unit.tarifSecurity, bayarSecurity)

    const totalWajib = sampah.wajib + security.wajib
    const totalDibayar = bayarSampah + bayarSecurity
    // Kurang dihitung per jenis, bukan dari selisih total. Kalau tidak, kelebihan
    // bayar security bisa menutupi kekurangan sampah dan menyembunyikan tunggakan.
    const totalKurang = sampah.kurang + security.kurang

    let status: StatusPeriode
    if (totalKurang === 0) status = 'LUNAS'
    else if (totalDibayar > 0) status = 'SEBAGIAN'
    else status = 'BELUM'

    if (status === 'LUNAS') periodeTerakhirLunas = periode
    totalTunggakan += totalKurang
    totalKelebihan += Math.max(0, bayarSampah - sampah.wajib) + Math.max(0, bayarSecurity - security.wajib)

    baris.push({ periode, status, totalWajib, totalDibayar, totalKurang, sampah, security })
  }

  return {
    unitId: unit.id,
    kode: unit.kode,
    namaWarga: unit.namaWarga,
    blok: unit.blok,
    nomor: unit.nomor,
    baris,
    totalTunggakan,
    jumlahBulanTunggak: baris.filter((b) => b.totalKurang > 0).length,
    totalKelebihan,
    periodeTerakhirLunas,
  }
}

/// Kartu iuran untuk satu unit (dipakai di dashboard warga, F-07).
export async function kartuIuranUnit(
  unitId: string,
  hinggaPeriode = periodeSekarang(),
): Promise<KartuIuranUnit | null> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true, kode: true, blok: true, nomor: true, namaWarga: true,
      tarifSampah: true, tarifSecurity: true, mulaiPeriode: true,
    },
  })
  if (!unit) return null
  const peta = await ambilAlokasiDisetujui([unit.id])
  return bangunKartu(unit, peta, hinggaPeriode)
}

/// Kartu iuran seluruh unit aktif (dipakai di matriks pengurus, F-08).
/// Sengaja satu query alokasi untuk semua unit, bukan N+1 per unit.
export async function kartuIuranSemuaUnit(
  hinggaPeriode = periodeSekarang(),
): Promise<KartuIuranUnit[]> {
  const units = await db.unit.findMany({
    where: { aktif: true },
    orderBy: [{ urutan: 'asc' }, { kode: 'asc' }],
    select: {
      id: true, kode: true, blok: true, nomor: true, namaWarga: true,
      tarifSampah: true, tarifSecurity: true, mulaiPeriode: true,
    },
  })
  if (units.length === 0) return []
  const peta = await ambilAlokasiDisetujui(units.map((u) => u.id))
  return units.map((u) => bangunKartu(u, peta, hinggaPeriode))
}

/// Ringkasan status seluruh unit untuk satu periode tertentu (kartu dashboard).
export function ringkasPeriode(kartu: KartuIuranUnit[], periode: string) {
  let lunas = 0, sebagian = 0, belum = 0, kurang = 0
  for (const k of kartu) {
    const b = k.baris.find((x) => x.periode === periode)
    if (!b) continue
    if (b.status === 'LUNAS') lunas++
    else if (b.status === 'SEBAGIAN') sebagian++
    else belum++
    kurang += b.totalKurang
  }
  return { periode, lunas, sebagian, belum, totalKurang: kurang, totalUnit: kartu.length }
}

/// Periode yang belum lunas untuk sebuah unit — dipakai memandu warga saat
/// mengisi form laporan agar tidak salah pilih bulan.
export async function periodeBelumLunas(unitId: string, hinggaPeriode = periodeSekarang()) {
  const kartu = await kartuIuranUnit(unitId, hinggaPeriode)
  if (!kartu) return []
  return kartu.baris
    .filter((b) => b.totalKurang > 0)
    .map((b) => ({
      periode: b.periode,
      kurangSampah: b.sampah.kurang,
      kurangSecurity: b.security.kurang,
      totalKurang: b.totalKurang,
    }))
}
