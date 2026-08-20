'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { wajibBendahara } from '@/lib/auth'
import { catatAudit } from '@/lib/audit'
import { gajianSchema, karyawanSchema, kasbonSchema } from '@/lib/validasi'
import { JENIS_TRANSAKSI, KATEGORI_GAJI, STATUS, STATUS_KASBON } from '@/lib/constants'
import { labelPeriode, rupiah, tanggalSingkat } from '@/lib/format'

export interface HasilAksi {
  ok?: boolean
  pesan?: string
  galat?: string
}

function segarkan() {
  revalidatePath('/pengurus/karyawan')
  revalidatePath('/pengurus/ledger')
  revalidatePath('/pengurus/laporan')
  revalidatePath('/pengurus')
}

// ---------------------------------------------------------------------------
// Data master karyawan
// ---------------------------------------------------------------------------

export async function aksiSimpanKaryawan(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()
  const id = String(formData.get('id') ?? '')

  const parsed = karyawanSchema.safeParse({
    nama: formData.get('nama'),
    jabatan: formData.get('jabatan'),
    gajiPokok: formData.get('gajiPokok'),
    aktif: formData.get('aktif') === 'on' || formData.get('aktif') === 'true',
    catatan: formData.get('catatan') ?? '',
  })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }
  const d = parsed.data

  const data = {
    nama: d.nama,
    jabatan: d.jabatan,
    gajiPokok: d.gajiPokok,
    aktif: d.aktif,
    catatan: d.catatan || null,
  }

  if (id) {
    const sebelum = await db.karyawan.findUnique({ where: { id } })
    if (!sebelum) return { galat: 'Karyawan tidak ditemukan.' }
    await db.karyawan.update({ where: { id }, data })
    await catatAudit({
      aktor: sesi,
      aksi: 'UBAH_KARYAWAN',
      entitas: 'Karyawan',
      entitasId: id,
      ringkasan: `Mengubah data karyawan ${d.nama}`,
      detail: { sebelum, sesudah: data },
    })
    segarkan()
    return { ok: true, pesan: `Data ${d.nama} disimpan.` }
  }

  const karyawan = await db.karyawan.create({ data })
  await catatAudit({
    aktor: sesi,
    aksi: 'TAMBAH_KARYAWAN',
    entitas: 'Karyawan',
    entitasId: karyawan.id,
    ringkasan: `Menambah karyawan ${d.nama} (${d.jabatan}), gaji pokok ${rupiah(d.gajiPokok)}`,
    detail: data,
  })
  segarkan()
  return { ok: true, pesan: `${d.nama} ditambahkan.` }
}

// ---------------------------------------------------------------------------
// Kasbon
// ---------------------------------------------------------------------------

export async function aksiCatatKasbon(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()

  const parsed = kasbonSchema.safeParse({
    karyawanId: formData.get('karyawanId'),
    tanggal: formData.get('tanggal'),
    nominal: formData.get('nominal'),
    keterangan: formData.get('keterangan') ?? '',
  })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }
  const d = parsed.data

  const karyawan = await db.karyawan.findUnique({ where: { id: d.karyawanId } })
  if (!karyawan) return { galat: 'Karyawan tidak ditemukan.' }

  const kasbon = await db.kasbon.create({
    data: {
      karyawanId: d.karyawanId,
      tanggal: d.tanggal,
      nominal: d.nominal,
      keterangan: d.keterangan || null,
      sisaBelumLunas: d.nominal,
      status: STATUS_KASBON.BELUM_LUNAS,
      dicatatOlehId: sesi.userId,
    },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'CATAT_KASBON',
    entitas: 'Kasbon',
    entitasId: kasbon.id,
    ringkasan: `Mencatat kasbon ${rupiah(d.nominal)} untuk ${karyawan.nama} (${tanggalSingkat(d.tanggal)})`,
    detail: d,
  })

  segarkan()
  return { ok: true, pesan: `Kasbon ${rupiah(d.nominal)} untuk ${karyawan.nama} tercatat.` }
}

// ---------------------------------------------------------------------------
// Gajian
// ---------------------------------------------------------------------------

export async function aksiProsesGajian(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()

  const parsed = gajianSchema.safeParse({
    karyawanId: formData.get('karyawanId'),
    periode: formData.get('periode'),
    tanggal: formData.get('tanggal'),
    gajiPokok: formData.get('gajiPokok'),
    totalPotongan: formData.get('totalPotongan'),
  })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }
  const d = parsed.data

  const karyawan = await db.karyawan.findUnique({ where: { id: d.karyawanId } })
  if (!karyawan) return { galat: 'Karyawan tidak ditemukan.' }

  const sudahAda = await db.gajian.findUnique({
    where: { karyawanId_periode: { karyawanId: d.karyawanId, periode: d.periode } },
  })
  if (sudahAda) return { galat: `Gajian ${karyawan.nama} untuk ${labelPeriode(d.periode)} sudah pernah diproses.` }

  const kasbonAktif = await db.kasbon.findMany({
    where: { karyawanId: d.karyawanId, status: STATUS_KASBON.BELUM_LUNAS },
    orderBy: { tanggal: 'asc' },
  })
  const totalKasbonBelumLunas = kasbonAktif.reduce((s, k) => s + k.sisaBelumLunas, 0)

  if (d.totalPotongan > d.gajiPokok) {
    return { galat: `Potongan (${rupiah(d.totalPotongan)}) tidak boleh melebihi gaji pokok (${rupiah(d.gajiPokok)}).` }
  }
  if (d.totalPotongan > totalKasbonBelumLunas) {
    return {
      galat: `Potongan (${rupiah(d.totalPotongan)}) melebihi total kasbon yang belum lunas (${rupiah(totalKasbonBelumLunas)}).`,
    }
  }

  const totalDibayar = d.gajiPokok - d.totalPotongan
  const kategori = KATEGORI_GAJI[karyawan.jabatan] ?? 'Lain-lain'

  const gajianId = await db.$transaction(async (tx) => {
    // Uang tunai hanya benar-benar keluar bila totalDibayar > 0. Kalau seluruh
    // gaji habis untuk menutup kasbon, tidak ada transaksi kas yang perlu dicatat.
    let transactionId: string | null = null
    if (totalDibayar > 0) {
      const trx = await tx.transaction.create({
        data: {
          jenis: JENIS_TRANSAKSI.KELUAR,
          tanggal: d.tanggal,
          nominal: totalDibayar,
          uraian: `Gaji ${karyawan.nama} - ${labelPeriode(d.periode)}`,
          kategori,
          metode: 'TRANSFER',
          status: STATUS.APPROVED,
          submittedById: sesi.userId,
          reviewedById: sesi.userId,
          reviewedAt: new Date(),
        },
        select: { id: true },
      })
      transactionId = trx.id
    }

    const gajian = await tx.gajian.create({
      data: {
        karyawanId: d.karyawanId,
        periode: d.periode,
        gajiPokok: d.gajiPokok,
        totalPotongan: d.totalPotongan,
        totalDibayar,
        tanggal: d.tanggal,
        transactionId,
        dicatatOlehId: sesi.userId,
      },
    })

    // Potong kasbon secara FIFO (yang paling lama duluan) sebesar totalPotongan.
    let sisaPotongan = d.totalPotongan
    for (const k of kasbonAktif) {
      if (sisaPotongan <= 0) break
      const potong = Math.min(k.sisaBelumLunas, sisaPotongan)
      if (potong <= 0) continue

      await tx.potonganKasbon.create({
        data: { kasbonId: k.id, gajianId: gajian.id, nominal: potong },
      })
      const sisaBaru = k.sisaBelumLunas - potong
      await tx.kasbon.update({
        where: { id: k.id },
        data: { sisaBelumLunas: sisaBaru, status: sisaBaru === 0 ? STATUS_KASBON.LUNAS : STATUS_KASBON.BELUM_LUNAS },
      })
      sisaPotongan -= potong
    }

    return gajian.id
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'PROSES_GAJIAN',
    entitas: 'Gajian',
    entitasId: gajianId,
    ringkasan: `Memproses gaji ${karyawan.nama} ${labelPeriode(d.periode)}: pokok ${rupiah(d.gajiPokok)}, potongan kasbon ${rupiah(d.totalPotongan)}, dibayar ${rupiah(totalDibayar)}`,
    detail: d,
  })

  segarkan()
  return {
    ok: true,
    pesan: `Gajian ${karyawan.nama} untuk ${labelPeriode(d.periode)} diproses. Dibayar ${rupiah(totalDibayar)}${
      d.totalPotongan > 0 ? `, kasbon terpotong ${rupiah(d.totalPotongan)}` : ''
    }.`,
  }
}
