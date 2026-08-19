'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { wajibLogin, cocokPin, hashPin } from '@/lib/auth'
import { catatAudit } from '@/lib/audit'
import { gantiPinSchema, laporanBayarSchema } from '@/lib/validasi'
import { JENIS_TRANSAKSI, STATUS } from '@/lib/constants'
import { labelPeriode, rupiah } from '@/lib/format'

export interface HasilAksi {
  ok?: boolean
  pesan?: string
  galat?: string
}

/** Parsing array alokasi dari FormData bernama alokasi[i][field]. */
function bacaAlokasi(formData: FormData) {
  const hasil: { periode: string; jenisIuran: string; nominal: number }[] = []
  for (const [key, value] of formData.entries()) {
    const m = key.match(/^alokasi\[(\d+)\]\[periode\]$/)
    if (!m) continue
    const i = m[1]
    const jenisIuran = String(formData.get(`alokasi[${i}][jenisIuran]`) ?? '')
    const nominal = Number(formData.get(`alokasi[${i}][nominal]`) ?? 0)
    if (!jenisIuran || !Number.isFinite(nominal) || nominal <= 0) continue
    hasil.push({ periode: String(value), jenisIuran, nominal })
  }
  return hasil
}

/**
 * Warga melaporkan pembayaran (F-01, F-02).
 * Selalu masuk berstatus PENDING — tidak pernah langsung memengaruhi saldo (F-03).
 */
export async function aksiLaporBayar(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibLogin()
  if (!sesi.unitId) return { galat: 'Akun Anda belum terhubung ke unit rumah. Hubungi bendahara.' }

  const parsed = laporanBayarSchema.safeParse({
    tanggal: formData.get('tanggal'),
    nominal: formData.get('nominal'),
    metode: formData.get('metode'),
    remark: formData.get('remark') ?? '',
    buktiUrl: formData.get('buktiUrl') ?? '',
    alokasi: bacaAlokasi(formData),
  })

  if (!parsed.success) {
    return { galat: parsed.error.issues[0].message }
  }
  const data = parsed.data

  const unit = await db.unit.findUnique({
    where: { id: sesi.unitId },
    select: { kode: true, namaWarga: true, aktif: true },
  })
  if (!unit) return { galat: 'Unit rumah tidak ditemukan.' }
  if (!unit.aktif) return { galat: 'Unit Anda tercatat tidak aktif. Hubungi bendahara.' }

  const trx = await db.transaction.create({
    data: {
      jenis: JENIS_TRANSAKSI.MASUK,
      tanggal: data.tanggal,
      nominal: data.nominal,
      uraian: `Iuran ${unit.kode} - ${unit.namaWarga}`,
      metode: data.metode,
      unitId: sesi.unitId,
      remark: data.remark || null,
      buktiUrl: data.buktiUrl || null,
      status: STATUS.PENDING,
      submittedById: sesi.userId,
      alokasi: { create: data.alokasi },
    },
    select: { id: true },
  })

  const ringkasPeriode = [...new Set(data.alokasi.map((a) => labelPeriode(a.periode)))].join(', ')

  await catatAudit({
    aktor: sesi,
    aksi: 'LAPOR_BAYAR',
    entitas: 'Transaction',
    entitasId: trx.id,
    ringkasan: `${unit.kode} melaporkan pembayaran ${rupiah(data.nominal)} untuk ${ringkasPeriode}`,
    detail: { nominal: data.nominal, tanggal: data.tanggal, metode: data.metode, alokasi: data.alokasi },
  })

  revalidatePath('/warga')
  revalidatePath('/warga/riwayat')
  revalidatePath('/pengurus')
  revalidatePath('/pengurus/verifikasi')

  return {
    ok: true,
    pesan: `Laporan ${rupiah(data.nominal)} untuk ${ringkasPeriode} berhasil dikirim dan menunggu verifikasi bendahara.`,
  }
}

/** Warga membatalkan laporannya sendiri, hanya selama masih PENDING. */
export async function aksiBatalkanLaporan(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibLogin()
  const id = String(formData.get('id') ?? '')
  if (!id) return { galat: 'Laporan tidak ditemukan.' }

  const trx = await db.transaction.findUnique({
    where: { id },
    select: { id: true, unitId: true, status: true, nominal: true, dibatalkanPada: true },
  })
  if (!trx) return { galat: 'Laporan tidak ditemukan.' }

  // NF-01: warga hanya boleh menyentuh datanya sendiri.
  if (trx.unitId !== sesi.unitId) return { galat: 'Anda tidak berhak membatalkan laporan ini.' }
  if (trx.status !== STATUS.PENDING) {
    return { galat: 'Laporan yang sudah diverifikasi tidak bisa dibatalkan sendiri. Hubungi bendahara.' }
  }
  if (trx.dibatalkanPada) return { galat: 'Laporan ini sudah dibatalkan.' }

  // NF-04: pembatalan bukan penghapusan — barisnya tetap ada dengan jejaknya.
  await db.transaction.update({
    where: { id },
    data: {
      status: STATUS.VOID,
      dibatalkanPada: new Date(),
      alasanPembatalan: 'Dibatalkan sendiri oleh warga sebelum diverifikasi',
    },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'BATAL_LAPORAN',
    entitas: 'Transaction',
    entitasId: id,
    ringkasan: `Laporan ${rupiah(trx.nominal)} dibatalkan oleh warga sendiri`,
  })

  revalidatePath('/warga')
  revalidatePath('/warga/riwayat')
  revalidatePath('/pengurus/verifikasi')
  return { ok: true, pesan: 'Laporan dibatalkan.' }
}

/** Ganti PIN sendiri. PIN bawaan hasil seed wajib diganti warga. */
export async function aksiGantiPin(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibLogin()

  const parsed = gantiPinSchema.safeParse({
    pinLama: formData.get('pinLama'),
    pinBaru: formData.get('pinBaru'),
    konfirmasi: formData.get('konfirmasi'),
  })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }

  const user = await db.user.findUnique({ where: { id: sesi.userId }, select: { pinHash: true } })
  if (!user) return { galat: 'Akun tidak ditemukan.' }

  if (!(await cocokPin(parsed.data.pinLama, user.pinHash))) {
    return { galat: 'PIN lama tidak sesuai.' }
  }

  await db.user.update({
    where: { id: sesi.userId },
    data: { pinHash: await hashPin(parsed.data.pinBaru) },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'GANTI_PIN',
    entitas: 'User',
    entitasId: sesi.userId,
    ringkasan: `${sesi.nama} mengganti PIN sendiri`,
  })

  return { ok: true, pesan: 'PIN berhasil diganti.' }
}
