import { db } from './db'
import { STATUS } from './constants'

/*
 * Tagihan tambahan: THR Ramadan, iuran 17 Agustus, dan tagihan sekali/berkala
 * lain di luar iuran bulanan rutin (sampah/security).
 *
 * Sengaja jalur terpisah dari lib/iuran.ts — memakai Transaction+Allocation
 * yang SAMA (jadi verifikasi, saldo kas, ledger, ekspor CSV semuanya otomatis
 * ikut, tanpa kode duplikat), tapi "wajib bayar"-nya dihitung dari
 * TagihanTambahan.nominalPerUnit, bukan dari Unit.tarifSampah/tarifSecurity.
 * Ini menghindari perubahan pada mesin hitung tunggakan bulanan yang sudah
 * berjalan di produksi.
 */

export interface StatusUnitTambahan {
  unitId: string
  kode: string
  namaWarga: string
  wajib: number
  dibayar: number
  kurang: number
  status: 'LUNAS' | 'SEBAGIAN' | 'BELUM'
}

/// Status bayar seluruh unit aktif untuk satu tagihan tambahan tertentu.
export async function statusTagihanTambahan(tagihanTambahanId: string): Promise<StatusUnitTambahan[]> {
  const [tagihan, units, alokasi] = await Promise.all([
    db.tagihanTambahan.findUnique({ where: { id: tagihanTambahanId } }),
    db.unit.findMany({
      where: { aktif: true },
      orderBy: [{ urutan: 'asc' }, { kode: 'asc' }],
      select: { id: true, kode: true, namaWarga: true },
    }),
    db.allocation.findMany({
      where: {
        tagihanTambahanId,
        transaction: { status: STATUS.APPROVED, dibatalkanPada: null },
      },
      select: { nominal: true, transaction: { select: { unitId: true } } },
    }),
  ])
  if (!tagihan) return []

  const dibayarPerUnit = new Map<string, number>()
  for (const a of alokasi) {
    const unitId = a.transaction.unitId
    if (!unitId) continue
    dibayarPerUnit.set(unitId, (dibayarPerUnit.get(unitId) ?? 0) + a.nominal)
  }

  return units.map((u) => {
    const dibayar = dibayarPerUnit.get(u.id) ?? 0
    const kurang = Math.max(0, tagihan.nominalPerUnit - dibayar)
    const status: StatusUnitTambahan['status'] = kurang === 0 ? 'LUNAS' : dibayar > 0 ? 'SEBAGIAN' : 'BELUM'
    return { unitId: u.id, kode: u.kode, namaWarga: u.namaWarga, wajib: tagihan.nominalPerUnit, dibayar, kurang, status }
  })
}

/// Ringkasan satu unit untuk satu tagihan tambahan (dipakai warga saat lapor bayar).
export async function statusUnitUntukTagihan(tagihanTambahanId: string, unitId: string): Promise<StatusUnitTambahan | null> {
  const semua = await statusTagihanTambahan(tagihanTambahanId)
  return semua.find((s) => s.unitId === unitId) ?? null
}

/// Tagihan tambahan yang masih aktif, dipakai untuk daftar pilihan di form warga.
export async function daftarTagihanAktif() {
  return db.tagihanTambahan.findMany({
    where: { aktif: true },
    orderBy: { createdAt: 'desc' },
  })
}
