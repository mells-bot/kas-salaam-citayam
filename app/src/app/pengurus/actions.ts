'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { hashPin, wajibBendahara, wajibPengurus } from '@/lib/auth'
import { catatAudit } from '@/lib/audit'
import { JENIS_TRANSAKSI, SETTING_SALDO_AWAL, STATUS } from '@/lib/constants'
import { labelPeriode, rupiah } from '@/lib/format'
import { kategoriPengeluaranSchema, laporanBayarSchema, pemasukanLainSchema, pengeluaranSchema, unitSchema } from '@/lib/validasi'
import { simpanSetting } from '@/lib/setting'

export interface HasilAksi {
  ok?: boolean
  pesan?: string
  galat?: string
}

function segarkan() {
  revalidatePath('/pengurus')
  revalidatePath('/pengurus/verifikasi')
  revalidatePath('/pengurus/ledger')
  revalidatePath('/pengurus/ledger/baru')
  revalidatePath('/pengurus/tunggakan')
  revalidatePath('/pengurus/laporan')
  revalidatePath('/pengurus/pengaturan')
  revalidatePath('/warga')
  revalidatePath('/warga/riwayat')
}

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

// ---------------------------------------------------------------------------
// Verifikasi laporan warga (F-04)
// ---------------------------------------------------------------------------

export async function aksiSetujui(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibPengurus()
  const id = String(formData.get('id') ?? '')

  const trx = await db.transaction.findUnique({
    where: { id },
    include: { unit: { select: { kode: true } }, alokasi: true },
  })
  if (!trx) return { galat: 'Transaksi tidak ditemukan.' }
  if (trx.dibatalkanPada) return { galat: 'Transaksi ini sudah dibatalkan.' }
  if (trx.status !== STATUS.PENDING) return { galat: 'Transaksi ini sudah diverifikasi sebelumnya.' }

  // Penjaga terakhir sebelum uang masuk saldo resmi: alokasi tidak boleh
  // melebihi nominal, sekalipun datanya lolos dari sisi klien.
  const totalAlokasi = trx.alokasi.reduce((s, a) => s + a.nominal, 0)
  if (totalAlokasi > trx.nominal) {
    return {
      galat: `Alokasi periode (${rupiah(totalAlokasi)}) melebihi nominal transaksi (${rupiah(trx.nominal)}). Perbaiki alokasi sebelum menyetujui.`,
    }
  }

  await db.transaction.update({
    where: { id },
    data: { status: STATUS.APPROVED, reviewedById: sesi.userId, reviewedAt: new Date(), alasanTolak: null },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'SETUJUI',
    entitas: 'Transaction',
    entitasId: id,
    ringkasan: `Menyetujui pembayaran ${rupiah(trx.nominal)} dari ${trx.unit?.kode ?? 'non-unit'}`,
    detail: { nominal: trx.nominal, alokasi: trx.alokasi.map((a) => `${a.periode}/${a.jenisIuran}=${a.nominal}`) },
  })

  segarkan()
  return { ok: true, pesan: `Pembayaran ${rupiah(trx.nominal)} disetujui dan masuk ke saldo kas.` }
}

export async function aksiTolak(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibPengurus()
  const id = String(formData.get('id') ?? '')
  const alasan = String(formData.get('alasan') ?? '').trim()

  // Alasan diwajibkan: warga harus tahu apa yang perlu diperbaiki, dan ini
  // yang mencegah sengketa "laporan saya hilang tanpa penjelasan".
  if (alasan.length < 5) return { galat: 'Alasan penolakan wajib diisi (minimal 5 karakter).' }

  const trx = await db.transaction.findUnique({
    where: { id },
    select: { id: true, status: true, nominal: true, dibatalkanPada: true, unit: { select: { kode: true } } },
  })
  if (!trx) return { galat: 'Transaksi tidak ditemukan.' }
  if (trx.dibatalkanPada) return { galat: 'Transaksi ini sudah dibatalkan.' }
  if (trx.status !== STATUS.PENDING) return { galat: 'Transaksi ini sudah diverifikasi sebelumnya.' }

  await db.transaction.update({
    where: { id },
    data: { status: STATUS.REJECTED, reviewedById: sesi.userId, reviewedAt: new Date(), alasanTolak: alasan },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'TOLAK',
    entitas: 'Transaction',
    entitasId: id,
    ringkasan: `Menolak pembayaran ${rupiah(trx.nominal)} dari ${trx.unit?.kode ?? 'non-unit'}: ${alasan}`,
  })

  segarkan()
  return { ok: true, pesan: 'Laporan ditolak dan alasannya sudah bisa dilihat warga.' }
}

/// Pembatalan transaksi yang sudah disetujui — soft delete saja (NF-04).
export async function aksiBatalkanTransaksi(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()
  const id = String(formData.get('id') ?? '')
  const alasan = String(formData.get('alasan') ?? '').trim()
  if (alasan.length < 5) return { galat: 'Alasan pembatalan wajib diisi (minimal 5 karakter).' }

  const trx = await db.transaction.findUnique({
    where: { id },
    select: { id: true, nominal: true, jenis: true, uraian: true, dibatalkanPada: true },
  })
  if (!trx) return { galat: 'Transaksi tidak ditemukan.' }
  if (trx.dibatalkanPada) return { galat: 'Transaksi ini sudah dibatalkan.' }

  await db.transaction.update({
    where: { id },
    data: { status: STATUS.VOID, dibatalkanPada: new Date(), alasanPembatalan: alasan },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'BATALKAN_TRANSAKSI',
    entitas: 'Transaction',
    entitasId: id,
    ringkasan: `Membatalkan ${trx.jenis === 'MASUK' ? 'pemasukan' : 'pengeluaran'} ${rupiah(trx.nominal)} (${trx.uraian}): ${alasan}`,
    detail: { nominal: trx.nominal, jenis: trx.jenis, uraian: trx.uraian },
  })

  segarkan()
  return { ok: true, pesan: 'Transaksi dibatalkan. Saldo kas sudah menyesuaikan.' }
}

// ---------------------------------------------------------------------------
// Input transaksi oleh bendahara
// ---------------------------------------------------------------------------

/// Pengeluaran (F-05). Tidak butuh approval berlapis (PRD bag. 9 poin 4).
export async function aksiCatatPengeluaran(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()

  const parsed = pengeluaranSchema.safeParse({
    tanggal: formData.get('tanggal'),
    nominal: formData.get('nominal'),
    uraian: formData.get('uraian'),
    kategori: formData.get('kategori'),
    metode: formData.get('metode'),
    remark: formData.get('remark') ?? '',
    buktiUrl: formData.get('buktiUrl') ?? '',
  })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }
  const d = parsed.data

  // Keanggotaan kategori divalidasi di sini (bukan lewat enum statis) karena
  // daftarnya sekarang dikelola bendahara lewat Pengaturan.
  const kategoriValid = await db.kategoriPengeluaran.findFirst({ where: { nama: d.kategori, aktif: true } })
  if (!kategoriValid) return { galat: `Kategori "${d.kategori}" tidak ditemukan atau sudah nonaktif.` }

  const trx = await db.transaction.create({
    data: {
      jenis: JENIS_TRANSAKSI.KELUAR,
      tanggal: d.tanggal,
      nominal: d.nominal,
      uraian: d.uraian,
      kategori: d.kategori,
      metode: d.metode,
      remark: d.remark || null,
      buktiUrl: d.buktiUrl || null,
      status: STATUS.APPROVED,
      submittedById: sesi.userId,
      reviewedById: sesi.userId,
      reviewedAt: new Date(),
    },
    select: { id: true },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'INPUT_PENGELUARAN',
    entitas: 'Transaction',
    entitasId: trx.id,
    ringkasan: `Mencatat pengeluaran ${rupiah(d.nominal)} - ${d.uraian} (${d.kategori})`,
    detail: d,
  })

  segarkan()
  return { ok: true, pesan: `Pengeluaran ${rupiah(d.nominal)} tercatat.` }
}

/// Pemasukan non-iuran: donasi, bunga bank, sisa kegiatan. Tanpa alokasi periode.
export async function aksiCatatPemasukanLain(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()

  const parsed = pemasukanLainSchema.safeParse({
    tanggal: formData.get('tanggal'),
    nominal: formData.get('nominal'),
    uraian: formData.get('uraian'),
    metode: formData.get('metode'),
    remark: formData.get('remark') ?? '',
  })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }
  const d = parsed.data

  const trx = await db.transaction.create({
    data: {
      jenis: JENIS_TRANSAKSI.MASUK,
      tanggal: d.tanggal,
      nominal: d.nominal,
      uraian: d.uraian,
      metode: d.metode,
      remark: d.remark || null,
      status: STATUS.APPROVED,
      submittedById: sesi.userId,
      reviewedById: sesi.userId,
      reviewedAt: new Date(),
    },
    select: { id: true },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'INPUT_PEMASUKAN_LAIN',
    entitas: 'Transaction',
    entitasId: trx.id,
    ringkasan: `Mencatat pemasukan lain ${rupiah(d.nominal)} - ${d.uraian}`,
    detail: d,
  })

  segarkan()
  return { ok: true, pesan: `Pemasukan ${rupiah(d.nominal)} tercatat.` }
}

/**
 * Bendahara mencatat pembayaran atas nama warga.
 * Jalur ini penting: PRD bag. 8 memperingatkan warga mungkin tetap membayar
 * lewat WhatsApp/transfer manual. Tanpa jalur ini, sistem akan macet.
 * Langsung APPROVED karena bendahara sendiri yang menginput dan memverifikasi.
 */
export async function aksiCatatIuranAtasNamaWarga(
  _prev: HasilAksi | null,
  formData: FormData,
): Promise<HasilAksi> {
  const sesi = await wajibBendahara()
  const unitId = String(formData.get('unitId') ?? '')
  if (!unitId) return { galat: 'Pilih unit warga terlebih dahulu.' }

  const parsed = laporanBayarSchema.safeParse({
    tanggal: formData.get('tanggal'),
    nominal: formData.get('nominal'),
    metode: formData.get('metode'),
    remark: formData.get('remark') ?? '',
    buktiUrl: formData.get('buktiUrl') ?? '',
    alokasi: bacaAlokasi(formData),
  })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }
  const d = parsed.data

  const unit = await db.unit.findUnique({ where: { id: unitId }, select: { kode: true, namaWarga: true } })
  if (!unit) return { galat: 'Unit tidak ditemukan.' }

  const trx = await db.transaction.create({
    data: {
      jenis: JENIS_TRANSAKSI.MASUK,
      tanggal: d.tanggal,
      nominal: d.nominal,
      uraian: `Iuran ${unit.kode} - ${unit.namaWarga}`,
      metode: d.metode,
      unitId,
      remark: d.remark || null,
      buktiUrl: d.buktiUrl || null,
      status: STATUS.APPROVED,
      submittedById: sesi.userId,
      reviewedById: sesi.userId,
      reviewedAt: new Date(),
      alokasi: { create: d.alokasi },
    },
    select: { id: true },
  })

  const ringkasPeriode = [...new Set(d.alokasi.map((a) => labelPeriode(a.periode)))].join(', ')

  await catatAudit({
    aktor: sesi,
    aksi: 'INPUT_IURAN_ATAS_NAMA_WARGA',
    entitas: 'Transaction',
    entitasId: trx.id,
    ringkasan: `Mencatat iuran ${unit.kode} sebesar ${rupiah(d.nominal)} untuk ${ringkasPeriode} (diinput bendahara)`,
    detail: { unit: unit.kode, nominal: d.nominal, alokasi: d.alokasi },
  })

  segarkan()
  return { ok: true, pesan: `Iuran ${unit.kode} sebesar ${rupiah(d.nominal)} tercatat dan langsung disetujui.` }
}

// ---------------------------------------------------------------------------
// Data master warga (F-11)
// ---------------------------------------------------------------------------

export async function aksiSimpanUnit(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()
  const id = String(formData.get('id') ?? '')

  const parsed = unitSchema.safeParse({
    kode: formData.get('kode'),
    blok: formData.get('blok'),
    nomor: formData.get('nomor'),
    namaWarga: formData.get('namaWarga'),
    urutan: formData.get('urutan'),
    kontak: formData.get('kontak') ?? '',
    tarifSampah: formData.get('tarifSampah'),
    tarifSecurity: formData.get('tarifSecurity'),
    mulaiPeriode: formData.get('mulaiPeriode'),
    aktif: formData.get('aktif') === 'on' || formData.get('aktif') === 'true',
    catatan: formData.get('catatan') ?? '',
  })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }
  const d = parsed.data

  // Perbandingan case-insensitive: login juga case-insensitive, jadi "b1A" dan
  // "B1a" akan menjadi kredensial yang sama dan harus dicegah di sini.
  const bentrokRows = await db.$queryRaw<{ id: string; kode: string }[]>`
    SELECT id, kode FROM "Unit" WHERE LOWER(kode) = LOWER(${d.kode})
  `
  const bentrok = bentrokRows.find((u) => u.id !== id)
  if (bentrok) {
    return { galat: `Kode unit "${d.kode}" bentrok dengan unit "${bentrok.kode}" yang sudah ada.` }
  }

  const data = {
    kode: d.kode,
    blok: d.blok,
    nomor: d.nomor,
    namaWarga: d.namaWarga,
    urutan: d.urutan,
    kontak: d.kontak || null,
    tarifSampah: d.tarifSampah,
    tarifSecurity: d.tarifSecurity,
    mulaiPeriode: d.mulaiPeriode,
    aktif: d.aktif,
    catatan: d.catatan || null,
  }

  if (id) {
    const sebelum = await db.unit.findUnique({ where: { id } })
    if (!sebelum) return { galat: 'Unit tidak ditemukan.' }
    await db.unit.update({ where: { id }, data })
    await catatAudit({
      aktor: sesi,
      aksi: 'UBAH_UNIT',
      entitas: 'Unit',
      entitasId: id,
      ringkasan: `Mengubah data unit ${d.kode} (${d.namaWarga})`,
      detail: { sebelum, sesudah: data },
    })
    // Nama warga ditampilkan di banyak tempat, jadi akun tertaut ikut disesuaikan.
    await db.user.updateMany({ where: { unitId: id, role: 'WARGA' }, data: { nama: d.namaWarga } })
    segarkan()
    return { ok: true, pesan: `Data unit ${d.kode} disimpan.` }
  }

  const unitBaru = await db.unit.create({ data })
  // Unit baru selalu punya akun warga, dengan PIN awal yang wajib diganti.
  const pinAwal = '123456'
  await db.user.create({
    data: {
      username: d.kode,
      nama: d.namaWarga,
      pinHash: await hashPin(pinAwal),
      role: 'WARGA',
      unitId: unitBaru.id,
    },
  })

  await catatAudit({
    aktor: sesi,
    aksi: 'TAMBAH_UNIT',
    entitas: 'Unit',
    entitasId: unitBaru.id,
    ringkasan: `Menambah unit ${d.kode} (${d.namaWarga}) beserta akun warganya`,
    detail: data,
  })

  segarkan()
  return {
    ok: true,
    pesan: `Unit ${d.kode} ditambahkan. Akun warga dibuat dengan PIN awal ${pinAwal} — minta warga segera menggantinya.`,
  }
}

export async function aksiResetPinWarga(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()
  const unitId = String(formData.get('unitId') ?? '')

  const unit = await db.unit.findUnique({ where: { id: unitId }, select: { kode: true } })
  if (!unit) return { galat: 'Unit tidak ditemukan.' }

  // PIN acak 6 digit lebih baik daripada nilai tetap: bendahara menyampaikannya
  // sekali ke warga, dan PIN lama benar-benar tidak berlaku lagi.
  const pinBaru = String(Math.floor(100000 + Math.random() * 900000))
  const hasil = await db.user.updateMany({
    where: { unitId, role: 'WARGA' },
    data: { pinHash: await hashPin(pinBaru) },
  })
  if (hasil.count === 0) return { galat: 'Unit ini belum punya akun warga.' }

  await catatAudit({
    aktor: sesi,
    aksi: 'RESET_PIN',
    entitas: 'Unit',
    entitasId: unitId,
    ringkasan: `Mereset PIN akun warga unit ${unit.kode}`,
  })

  revalidatePath('/pengurus/warga')
  return { ok: true, pesan: `PIN unit ${unit.kode} direset menjadi ${pinBaru}. Sampaikan ke warga dan minta segera diganti.` }
}

// ---------------------------------------------------------------------------
// Pengaturan
// ---------------------------------------------------------------------------

export async function aksiSimpanPengaturan(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()

  const saldoAwal = Number(formData.get('saldoAwal'))
  const nama = String(formData.get('namaCluster') ?? '').trim()
  const tanggal = String(formData.get('tanggalSaldoAwal') ?? '').trim()

  if (!Number.isFinite(saldoAwal) || !Number.isInteger(saldoAwal)) {
    return { galat: 'Saldo awal harus bilangan bulat rupiah.' }
  }
  if (nama.length < 3) return { galat: 'Nama cluster minimal 3 karakter.' }

  await Promise.all([
    simpanSetting(SETTING_SALDO_AWAL, String(saldoAwal)),
    simpanSetting('nama_cluster', nama),
    simpanSetting('tanggal_saldo_awal', tanggal),
  ])

  await catatAudit({
    aktor: sesi,
    aksi: 'UBAH_PENGATURAN',
    entitas: 'Setting',
    ringkasan: `Mengubah pengaturan: saldo awal ${rupiah(saldoAwal)}, nama cluster "${nama}"`,
  })

  segarkan()
  return { ok: true, pesan: 'Pengaturan disimpan.' }
}

// ---------------------------------------------------------------------------
// Kategori pengeluaran
// ---------------------------------------------------------------------------

export async function aksiTambahKategori(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()

  const parsed = kategoriPengeluaranSchema.safeParse({ nama: formData.get('nama') })
  if (!parsed.success) return { galat: parsed.error.issues[0].message }
  const { nama } = parsed.data

  // Perbandingan case-insensitive supaya "operasional" tidak dibuat terpisah
  // dari "Operasional" yang sudah ada.
  const bentrokRows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "KategoriPengeluaran" WHERE LOWER(nama) = LOWER(${nama})
  `
  if (bentrokRows[0]) {
    const existing = await db.kategoriPengeluaran.findUnique({ where: { id: bentrokRows[0].id } })
    if (existing && !existing.aktif) {
      await db.kategoriPengeluaran.update({ where: { id: existing.id }, data: { aktif: true } })
      await catatAudit({
        aktor: sesi,
        aksi: 'AKTIFKAN_KATEGORI',
        entitas: 'KategoriPengeluaran',
        entitasId: existing.id,
        ringkasan: `Mengaktifkan kembali kategori "${existing.nama}"`,
      })
      segarkan()
      return { ok: true, pesan: `Kategori "${existing.nama}" (sebelumnya nonaktif) diaktifkan kembali.` }
    }
    return { galat: `Kategori "${existing?.nama ?? nama}" sudah ada.` }
  }

  const jumlah = await db.kategoriPengeluaran.count()
  const kategori = await db.kategoriPengeluaran.create({ data: { nama, urutan: jumlah } })

  await catatAudit({
    aktor: sesi,
    aksi: 'TAMBAH_KATEGORI',
    entitas: 'KategoriPengeluaran',
    entitasId: kategori.id,
    ringkasan: `Menambah kategori pengeluaran "${nama}"`,
  })

  segarkan()
  return { ok: true, pesan: `Kategori "${nama}" ditambahkan.` }
}

/// Nonaktifkan saja, tidak dihapus — kategori pada transaksi lama harus tetap
/// tampil apa adanya (NF-04), hanya tidak muncul lagi untuk transaksi baru.
export async function aksiNonaktifkanKategori(_prev: HasilAksi | null, formData: FormData): Promise<HasilAksi> {
  const sesi = await wajibBendahara()
  const id = String(formData.get('id') ?? '')

  const kategori = await db.kategoriPengeluaran.findUnique({ where: { id } })
  if (!kategori) return { galat: 'Kategori tidak ditemukan.' }
  if (!kategori.aktif) return { galat: 'Kategori ini sudah nonaktif.' }

  const dipakai = await db.transaction.count({ where: { kategori: kategori.nama } })

  await db.kategoriPengeluaran.update({ where: { id }, data: { aktif: false } })

  await catatAudit({
    aktor: sesi,
    aksi: 'NONAKTIFKAN_KATEGORI',
    entitas: 'KategoriPengeluaran',
    entitasId: id,
    ringkasan: `Menonaktifkan kategori "${kategori.nama}"${dipakai > 0 ? ` (sudah dipakai ${dipakai} transaksi, tetap tampil di riwayat)` : ''}`,
  })

  segarkan()
  return { ok: true, pesan: `Kategori "${kategori.nama}" dinonaktifkan.` }
}
