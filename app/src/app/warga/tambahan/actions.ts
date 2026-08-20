'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { wajibLogin } from '@/lib/auth'
import { catatAudit } from '@/lib/audit'
import { laporanTambahanSchema } from '@/lib/validasi'
import { JENIS_TRANSAKSI, STATUS } from '@/lib/constants'
import { rupiah } from '@/lib/format'

export interface HasilAksi {
  ok?: boolean
  pesan?: string
  galat?: string
}

/// Warga melaporkan pembayaran untuk satu tagihan tambahan (THR, dsb).
/// Selalu PENDING dulu, sama seperti laporan iuran bulanan (F-03).
export async function aksiLaporTambahan(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibLogin()
  if (!sesi.unitId) return { galat: 'Akun Anda belum terhubung ke unit rumah. Hubungi bendahara.' }

  const parsed = laporanTambahanSchema.safeParse({
    tagihanTambahanId: formData.get('tagihanTambahanId'),
    tanggal: formData.get('tanggal'),
    nominal: formData.get('nominal'),
    metode: formData.get('metode'),
    remark: formData.get('remark') ?? '',
    buktiUrl: formData.get('buktiUrl') ?? '',
  })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }
  const d = parsed.data

  const [tagihan, unit] = await Promise.all([
    db.tagihanTambahan.findUnique({ where: { id: d.tagihanTambahanId } }),
    db.unit.findUnique({ where: { id: sesi.unitId }, select: { kode: true, namaWarga: true, aktif: true } }),
  ])
  if (!tagihan || !tagihan.aktif) return { galat: 'Tagihan ini sudah tidak aktif atau tidak ditemukan.' }
  if (!unit) return { galat: 'Unit rumah tidak ditemukan.' }
  if (!unit.aktif) return { galat: 'Unit Anda tercatat tidak aktif. Hubungi bendahara.' }

  const trx = await db.transaction.create({
    data: {
      jenis: JENIS_TRANSAKSI.MASUK,
      tanggal: d.tanggal,
      nominal: d.nominal,
      uraian: `${tagihan.nama} - ${unit.kode} ${unit.namaWarga}`,
      metode: d.metode,
      unitId: sesi.unitId,
      remark: d.remark || null,
      buktiUrl: d.buktiUrl || null,
      status: STATUS.PENDING,
      submittedById: sesi.userId,
      alokasi: {
        create: [
          {
            periode: tagihan.periode,
            jenisIuran: 'TAMBAHAN',
            nominal: d.nominal,
            tagihanTambahanId: tagihan.id,
          },
        ],
      },
    },
    select: { id: true },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'LAPOR_TAMBAHAN',
    entitas: 'Transaction',
    entitasId: trx.id,
    ringkasan: `${unit.kode} melaporkan pembayaran ${rupiah(d.nominal)} untuk "${tagihan.nama}"`,
    detail: { tagihan: tagihan.nama, nominal: d.nominal, tanggal: d.tanggal, metode: d.metode },
  })

  revalidatePath('/warga/tambahan')
  revalidatePath('/pengurus/tambahan')
  revalidatePath('/pengurus/verifikasi')

  return { ok: true, pesan: `Laporan ${rupiah(d.nominal)} untuk "${tagihan.nama}" terkirim dan menunggu verifikasi bendahara.` }
}
