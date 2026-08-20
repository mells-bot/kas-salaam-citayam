'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { wajibBendahara } from '@/lib/auth'
import { catatAudit } from '@/lib/audit'
import { tagihanTambahanSchema } from '@/lib/validasi'
import { labelPeriode, rupiah } from '@/lib/format'

export interface HasilAksi {
  ok?: boolean
  pesan?: string
  galat?: string
}

/// Bendahara membuat tagihan tambahan baru (THR, iuran 17 Agustus, dsb).
export async function aksiBuatTagihanTambahan(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()

  const parsed = tagihanTambahanSchema.safeParse({
    nama: formData.get('nama'),
    periode: formData.get('periode'),
    nominalPerUnit: formData.get('nominalPerUnit'),
    keterangan: formData.get('keterangan') ?? '',
  })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }
  const d = parsed.data

  const tagihan = await db.tagihanTambahan.create({
    data: {
      nama: d.nama,
      periode: d.periode,
      nominalPerUnit: d.nominalPerUnit,
      keterangan: d.keterangan || null,
      dibuatOlehId: sesi.userId,
    },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'BUAT_TAGIHAN_TAMBAHAN',
    entitas: 'TagihanTambahan',
    entitasId: tagihan.id,
    ringkasan: `Membuat tagihan tambahan "${d.nama}" (${labelPeriode(d.periode)}) sebesar ${rupiah(d.nominalPerUnit)}/unit`,
    detail: d,
  })

  revalidatePath('/pengurus/tambahan')
  revalidatePath('/warga/tambahan')
  return { ok: true, pesan: `Tagihan "${d.nama}" dibuat. Warga sudah bisa melaporkan pembayaran.` }
}

/// Menutup tagihan tambahan (tidak lagi muncul di form warga) tanpa menghapus riwayatnya.
export async function aksiNonaktifkanTagihan(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()
  const id = String(formData.get('id') ?? '')

  const tagihan = await db.tagihanTambahan.findUnique({ where: { id } })
  if (!tagihan) return { galat: 'Tagihan tidak ditemukan.' }
  if (!tagihan.aktif) return { galat: 'Tagihan ini sudah nonaktif.' }

  await db.tagihanTambahan.update({ where: { id }, data: { aktif: false } })

  await catatAudit({
    aktor: sesi,
    aksi: 'NONAKTIFKAN_TAGIHAN_TAMBAHAN',
    entitas: 'TagihanTambahan',
    entitasId: id,
    ringkasan: `Menonaktifkan tagihan tambahan "${tagihan.nama}"`,
  })

  revalidatePath('/pengurus/tambahan')
  revalidatePath('/warga/tambahan')
  return { ok: true, pesan: 'Tagihan dinonaktifkan. Riwayat pembayaran yang sudah ada tetap tersimpan.' }
}
