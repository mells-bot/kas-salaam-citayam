/**
 * Seed data awal Sistem Kas Cluster Salaam Citayam.
 *
 * Daftar 34 unit di bawah adalah DATA WARGA SEBENARNYA sesuai daftar yang
 * diberikan pengurus. Kontak masih kosong — isi lewat menu Data Warga.
 *
 * Transaksi contoh sengaja mereproduksi variasi nominal yang ditemukan di
 * Google Sheets lama (PRD bag. 2), dan dipetakan ke unit yang memang disebut
 * di PRD: A6 (Bp. Fakhri Ihsan) untuk pola rapel "FAHRI", dan A12 (Bp. Santo)
 * untuk pola bayar komponen security saja.
 */
import bcrypt from 'bcryptjs'
import { db } from '../src/lib/db'
import { KATEGORI_PENGELUARAN_BAWAAN } from '../src/lib/constants'

// Memakai db dari src/lib/db.ts (bukan `new PrismaClient()` langsung) supaya
// seed ini otomatis lewat driver adapter Turso saat TURSO_AUTH_TOKEN diisi —
// jadi skrip yang sama bisa dipakai untuk seed lokal maupun produksi.

const TARIF_SAMPAH = 35_000
const TARIF_SECURITY = 140_000
const MULAI_PERIODE = '2026-01'

const PIN_DEFAULT_WARGA = '123456'
const PIN_DEFAULT_PENGURUS = 'pengurus123'

/**
 * Daftar 34 unit: [nomor urut, kode unit, nama warga].
 *
 * Perhatikan: blok B tidak punya B4, dan B1 terbagi menjadi B1a & B1b.
 * Karena itu kode unit tidak bisa dibangkitkan dengan perulangan angka —
 * daftarnya harus eksplisit seperti ini.
 */
const DAFTAR_WARGA: [number, string, string][] = [
  [1, 'A1', 'Bp. Asep'],
  [2, 'A2', 'Bp. Syahrul'],
  [3, 'A3', 'Bp. Asep'],
  [4, 'A4', 'Ibu Fatimah'],
  [5, 'A5', 'Bp. Hilman/Edi'],
  [6, 'A6', 'Bp. Fakhri Ihsan'],
  [7, 'A7', 'Bp. Mahendra'],
  [8, 'A8', 'Bp. Junihardi'],
  [9, 'A9', 'Ibu Marina'],
  [10, 'A10', 'Bp. Zul'],
  [11, 'A11', 'Bp. Dimas'],
  [12, 'A12', 'Bp. Santo'],
  [13, 'B1a', 'Bp. Ferry'],
  [14, 'B1b', 'Bp. Amran'],
  [15, 'B2', 'Bp. Ary'],
  [16, 'B3', 'Bp. Cecep'],
  [17, 'B5', 'Bp. Akmal'],
  [18, 'B6', 'Bp. Djati'],
  [19, 'B7', 'Bp. Febri'],
  [20, 'B8', 'Bp. Gilang/Riki'],
  [21, 'B9', 'Bp. Farid'],
  [22, 'B10', 'Bp. Imam Nawawi'],
  [23, 'B11', 'Bp. Fadly'],
  [24, 'B12', 'Bp. Lingga'],
  [25, 'C1', 'Bp. Iwan'],
  [26, 'C2', 'Bp. Apriyudi'],
  [27, 'C3', 'Bp. Imam Rosadi'],
  [28, 'C4', 'Bp. Uswan'],
  [29, 'C5', 'Bp. Abu Ali'],
  [30, 'C6', 'Bp. Nanda'],
  [31, 'C7', 'Bp. Triyadi'],
  [32, 'C8', 'Bp. Reynaldi'],
  [33, 'C9', 'Bp. Bayu'],
  [34, 'C10', 'Ibu Hasanah'],
]

/**
 * Catatan internal per unit yang perlu ditindaklanjuti bendahara.
 *
 * A12 (Bp. Santo) adalah unit yang disebut PRD bag. 10 sebagai contoh warga
 * yang tercatat hanya membayar komponen security. Tarif sampahnya SENGAJA
 * dibiarkan normal (Rp35.000), bukan di-nol-kan: PRD sendiri belum tahu apakah
 * ini pengecualian permanen atau tunggakan yang belum selesai. Menagih lalu
 * dibebaskan itu bisa diperbaiki; membebaskan diam-diam padahal berutang tidak
 * akan pernah terdeteksi. Jadi bawaannya "masih tertagih".
 */
const CATATAN_UNIT: Record<string, string> = {
  A12:
    'PERLU KONFIRMASI (PRD bag. 10): tercatat pernah hanya membayar komponen security ' +
    'Rp140.000 tanpa sampah. Tarif sampah dibiarkan normal agar kekurangannya terlihat. ' +
    'Bila ternyata pengecualian permanen, ubah tarif sampah menjadi 0 lewat menu ini.',
  A1: 'Catatan: nama sama dengan A3 (Bp. Asep). Bedakan selalu lewat kode unit.',
  A3: 'Catatan: nama sama dengan A1 (Bp. Asep). Bedakan selalu lewat kode unit.',
  A5: 'Unit tercatat atas dua nama (Hilman/Edi). Konfirmasi siapa pemegang akun login.',
  B8: 'Unit tercatat atas dua nama (Gilang/Riki). Konfirmasi siapa pemegang akun login.',
  B1a: 'B1 terbagi menjadi dua unit: B1a dan B1b.',
  B1b: 'B1 terbagi menjadi dua unit: B1a dan B1b.',
}

/** Pisahkan kode unit menjadi blok dan nomor: "B1a" -> blok "B", nomor "1a". */
function pecahKode(kode: string): { blok: string; nomor: string } {
  const m = kode.match(/^([A-Za-z]+)(.*)$/)
  if (!m) return { blok: kode, nomor: '' }
  return { blok: m[1], nomor: m[2] }
}

async function main() {
  console.log('Menyiapkan data awal...')

  // Idempoten: bersihkan agar seed bisa diulang tanpa duplikasi.
  await db.potonganKasbon.deleteMany()
  await db.gajian.deleteMany()
  await db.kasbon.deleteMany()
  await db.karyawan.deleteMany()
  await db.allocation.deleteMany()
  await db.tagihanTambahan.deleteMany()
  await db.transaction.deleteMany()
  await db.auditLog.deleteMany()
  await db.user.deleteMany()
  await db.unit.deleteMany()
  await db.setting.deleteMany()
  await db.kategoriPengeluaran.deleteMany()

  // --- Pengaturan ---------------------------------------------------------
  // PRD bag. 8 menyarankan mulai fresh dengan saldo akhir dari Google Sheets.
  // GANTI angka ini dengan saldo riil sebelum sistem dipakai sungguhan.
  await db.setting.createMany({
    data: [
      { key: 'saldo_awal', value: '12500000' },
      { key: 'tanggal_saldo_awal', value: '2025-12-31' },
      { key: 'nama_cluster', value: 'Cluster Salaam Citayam' },
    ],
  })

  await db.kategoriPengeluaran.createMany({
    data: KATEGORI_PENGELUARAN_BAWAAN.map((nama, urutan) => ({ nama, urutan })),
  })
  console.log(`  ${KATEGORI_PENGELUARAN_BAWAAN.length} kategori pengeluaran dibuat`)

  // --- Unit & akun warga --------------------------------------------------
  const pinWarga = await bcrypt.hash(PIN_DEFAULT_WARGA, 10)
  const pinPengurus = await bcrypt.hash(PIN_DEFAULT_PENGURUS, 10)

  const unitRecords: Record<string, string> = {}
  const tarifPerUnit: Record<string, { sampah: number; security: number }> = {}

  for (const [urutan, kode, namaWarga] of DAFTAR_WARGA) {
    const { blok, nomor } = pecahKode(kode)
    const unit = await db.unit.create({
      data: {
        kode,
        blok,
        nomor,
        urutan,
        namaWarga,
        kontak: null,
        tarifSampah: TARIF_SAMPAH,
        tarifSecurity: TARIF_SECURITY,
        mulaiPeriode: MULAI_PERIODE,
        catatan: CATATAN_UNIT[kode] ?? null,
      },
    })
    unitRecords[kode] = unit.id
    tarifPerUnit[kode] = { sampah: TARIF_SAMPAH, security: TARIF_SECURITY }

    // Username warga = kode unit, sesuai NF-02 (login berbasis nomor unit + PIN).
    await db.user.create({
      data: { username: kode, nama: namaWarga, pinHash: pinWarga, role: 'WARGA', unitId: unit.id },
    })
  }
  console.log(`  ${DAFTAR_WARGA.length} unit + akun warga dibuat`)

  // --- Akun pengurus ------------------------------------------------------
  const bendahara = await db.user.create({
    data: {
      username: 'bendahara',
      nama: 'Bendahara Cluster',
      pinHash: pinPengurus,
      role: 'BENDAHARA',
    },
  })
  await db.user.create({
    data: { username: 'ketua', nama: 'Ketua RT', pinHash: pinPengurus, role: 'KETUA' },
  })
  console.log('  Akun bendahara & ketua dibuat')

  // --- Transaksi contoh ---------------------------------------------------
  const d = (s: string) => new Date(`${s}T03:00:00.000Z`)

  /** Bayar penuh satu bulan sesuai tarif unit tersebut. */
  async function bayarPenuh(kode: string, tanggal: string, periode: string, status = 'APPROVED') {
    const tarif = tarifPerUnit[kode]
    const nama = DAFTAR_WARGA.find((w) => w[1] === kode)![2]
    const alokasi = [
      { periode, jenisIuran: 'SAMPAH', nominal: tarif.sampah },
      { periode, jenisIuran: 'SECURITY', nominal: tarif.security },
    ].filter((a) => a.nominal > 0)
    const nominal = alokasi.reduce((s, a) => s + a.nominal, 0)
    await db.transaction.create({
      data: {
        jenis: 'MASUK',
        tanggal: d(tanggal),
        nominal,
        uraian: `Iuran ${kode} - ${nama}`,
        metode: 'TRANSFER',
        unitId: unitRecords[kode],
        status,
        submittedById: bendahara.id,
        reviewedById: status === 'APPROVED' ? bendahara.id : null,
        reviewedAt: status === 'APPROVED' ? d(tanggal) : null,
        alokasi: { create: alokasi },
      },
    })
  }

  const semuaKode = DAFTAR_WARGA.map((w) => w[1])
  // Unit dengan pola pembayaran khusus, dikecualikan dari pembayaran normal.
  const VARIASI = ['A12', 'A6', 'B2']
  const PENDING = ['A9', 'B7', 'C3']
  const MENUNGGAK = ['C7', 'C8', 'C9', 'C10']

  // Januari-Juni 2026: mayoritas unit membayar penuh, sebagian menunggak.
  const periodeLunas = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
  for (const [idx, periode] of periodeLunas.entries()) {
    const tgl = `${periode}-${String(5 + (idx % 8)).padStart(2, '0')}`
    // Makin ke bulan terakhir, makin banyak unit yang menunggak.
    const menunggak = new Set(MENUNGGAK.slice(0, idx >= 4 ? 4 : 1))
    for (const kode of semuaKode) {
      if (menunggak.has(kode)) continue
      await bayarPenuh(kode, tgl, periode)
    }
  }

  // Variasi 1 - A12 (Bp. Santo): hanya komponen security Rp140.000.
  // Ini pola yang persis disebut PRD bag. 10.
  await db.transaction.create({
    data: {
      jenis: 'MASUK',
      tanggal: d('2026-07-08'),
      nominal: 140_000,
      uraian: 'Iuran A12 - Bp. Santo (security saja)',
      metode: 'TRANSFER',
      unitId: unitRecords['A12'],
      status: 'APPROVED',
      remark: 'Hanya komponen security. Komponen sampah belum dibayar - perlu konfirmasi.',
      submittedById: bendahara.id,
      reviewedById: bendahara.id,
      reviewedAt: d('2026-07-08'),
      alokasi: { create: [{ periode: '2026-07', jenisIuran: 'SECURITY', nominal: 140_000 }] },
    },
  })

  // Variasi 2 - A6 (Bp. Fakhri Ihsan): rapel dua bulan Rp350.000.
  // Pola transaksi "FAHRI ... NOVEMBER DESEMBER 2025" di PRD bag. 2.
  await db.transaction.create({
    data: {
      jenis: 'MASUK',
      tanggal: d('2026-08-04'),
      nominal: 350_000,
      uraian: 'Iuran A6 - Bp. Fakhri Ihsan (rapel 2 bulan)',
      metode: 'TRANSFER',
      unitId: unitRecords['A6'],
      status: 'APPROVED',
      remark: 'JULI AGUSTUS 2026',
      submittedById: bendahara.id,
      reviewedById: bendahara.id,
      reviewedAt: d('2026-08-04'),
      alokasi: {
        create: [
          { periode: '2026-07', jenisIuran: 'SAMPAH', nominal: 35_000 },
          { periode: '2026-07', jenisIuran: 'SECURITY', nominal: 140_000 },
          { periode: '2026-08', jenisIuran: 'SAMPAH', nominal: 35_000 },
          { periode: '2026-08', jenisIuran: 'SECURITY', nominal: 140_000 },
        ],
      },
    },
  })

  // Variasi 3 - B2 (Bp. Ary): Rp185.000 = bulan berjalan penuh + rapel sisa sampah.
  await db.transaction.create({
    data: {
      jenis: 'MASUK',
      tanggal: d('2026-08-06'),
      nominal: 185_000,
      uraian: 'Iuran B2 - Bp. Ary',
      metode: 'TUNAI',
      unitId: unitRecords['B2'],
      status: 'APPROVED',
      remark: 'Agustus penuh + kekurangan sampah Juli',
      submittedById: bendahara.id,
      reviewedById: bendahara.id,
      reviewedAt: d('2026-08-06'),
      alokasi: {
        create: [
          { periode: '2026-07', jenisIuran: 'SAMPAH', nominal: 10_000 },
          { periode: '2026-08', jenisIuran: 'SAMPAH', nominal: 35_000 },
          { periode: '2026-08', jenisIuran: 'SECURITY', nominal: 140_000 },
        ],
      },
    },
  })

  // Juli 2026 dibayar sebagian besar unit (24 unit pertama, kecuali kasus khusus).
  for (const kode of semuaKode.slice(0, 24)) {
    if (VARIASI.includes(kode)) continue
    await bayarPenuh(kode, '2026-07-06', '2026-07')
  }

  // Laporan warga yang masih MENUNGGU VERIFIKASI (F-03) - mengisi antrean bendahara.
  for (const kode of PENDING) {
    await bayarPenuh(kode, '2026-08-15', '2026-08', 'PENDING')
  }

  // --- Pengeluaran (F-05) -------------------------------------------------
  const pengeluaran = [
    { tgl: '2026-01-28', nominal: 4_200_000, uraian: 'Honor security Januari 2026', kategori: 'Honor Security' },
    { tgl: '2026-01-28', nominal: 1_190_000, uraian: 'Iuran sampah ke pihak ketiga Januari 2026', kategori: 'Iuran Sampah Pihak Ketiga' },
    { tgl: '2026-02-27', nominal: 4_200_000, uraian: 'Honor security Februari 2026', kategori: 'Honor Security' },
    { tgl: '2026-02-27', nominal: 1_190_000, uraian: 'Iuran sampah ke pihak ketiga Februari 2026', kategori: 'Iuran Sampah Pihak Ketiga' },
    { tgl: '2026-03-15', nominal: 185_000, uraian: 'ATK dan fotokopi administrasi', kategori: 'Operasional' },
    { tgl: '2026-03-28', nominal: 4_200_000, uraian: 'Honor security Maret 2026', kategori: 'Honor Security' },
    { tgl: '2026-03-28', nominal: 1_190_000, uraian: 'Iuran sampah ke pihak ketiga Maret 2026', kategori: 'Iuran Sampah Pihak Ketiga' },
    { tgl: '2026-04-12', nominal: 320_000, uraian: 'Konsumsi kerja bakti warga', kategori: 'Kegiatan Warga' },
    { tgl: '2026-04-28', nominal: 4_200_000, uraian: 'Honor security April 2026', kategori: 'Honor Security' },
    { tgl: '2026-04-28', nominal: 1_190_000, uraian: 'Iuran sampah ke pihak ketiga April 2026', kategori: 'Iuran Sampah Pihak Ketiga' },
    { tgl: '2026-05-20', nominal: 750_000, uraian: 'Perbaikan lampu jalan dan material', kategori: 'Perbaikan & Material' },
    { tgl: '2026-05-28', nominal: 4_200_000, uraian: 'Honor security Mei 2026', kategori: 'Honor Security' },
    { tgl: '2026-05-28', nominal: 1_190_000, uraian: 'Iuran sampah ke pihak ketiga Mei 2026', kategori: 'Iuran Sampah Pihak Ketiga' },
    { tgl: '2026-06-28', nominal: 4_200_000, uraian: 'Honor security Juni 2026', kategori: 'Honor Security' },
    { tgl: '2026-06-28', nominal: 1_190_000, uraian: 'Iuran sampah ke pihak ketiga Juni 2026', kategori: 'Iuran Sampah Pihak Ketiga' },
    { tgl: '2026-07-28', nominal: 4_200_000, uraian: 'Honor security Juli 2026', kategori: 'Honor Security' },
    { tgl: '2026-07-28', nominal: 1_190_000, uraian: 'Iuran sampah ke pihak ketiga Juli 2026', kategori: 'Iuran Sampah Pihak Ketiga' },
    { tgl: '2026-08-10', nominal: 240_000, uraian: 'Pembelian kantong sampah dan sapu', kategori: 'Operasional' },
  ]
  for (const p of pengeluaran) {
    await db.transaction.create({
      data: {
        jenis: 'KELUAR',
        tanggal: d(p.tgl),
        nominal: p.nominal,
        uraian: p.uraian,
        kategori: p.kategori,
        metode: 'TRANSFER',
        status: 'APPROVED',
        submittedById: bendahara.id,
        reviewedById: bendahara.id,
        reviewedAt: d(p.tgl),
      },
    })
  }
  console.log(`  ${pengeluaran.length} transaksi pengeluaran dibuat`)

  // --- Karyawan (security & kebersihan) -----------------------------------
  const daftarKaryawan = [
    { nama: 'Pa Bambang', jabatan: 'SECURITY', gajiPokok: 1_500_000 },
    { nama: 'Pa Urip', jabatan: 'SECURITY', gajiPokok: 1_450_000 },
    { nama: 'Pa Juki', jabatan: 'SECURITY', gajiPokok: 1_450_000 },
    { nama: 'Kebersihan', jabatan: 'KEBERSIHAN', gajiPokok: 1_080_000 },
  ]
  const karyawanRecords: Record<string, string> = {}
  for (const k of daftarKaryawan) {
    const karyawan = await db.karyawan.create({ data: k })
    karyawanRecords[k.nama] = karyawan.id
  }
  console.log(`  ${daftarKaryawan.length} karyawan dibuat`)

  // Satu contoh kasbon supaya fitur potongan gajian ada isinya saat dicoba.
  await db.kasbon.create({
    data: {
      karyawanId: karyawanRecords['Pa Juki'],
      tanggal: d('2026-08-05'),
      nominal: 300_000,
      keterangan: 'Keperluan mendesak keluarga',
      sisaBelumLunas: 300_000,
      status: 'BELUM_LUNAS',
      dicatatOlehId: bendahara.id,
    },
  })

  await db.auditLog.create({
    data: {
      actorId: bendahara.id,
      actorNama: 'Bendahara Cluster (BENDAHARA)',
      aksi: 'SEED',
      entitas: 'Sistem',
      ringkasan: `Data awal dimuat: ${DAFTAR_WARGA.length} unit warga`,
    },
  })

  const totalTrx = await db.transaction.count()
  console.log(`\nSelesai. Total ${totalTrx} transaksi.`)
  console.log('\n  Login pengurus : bendahara / pengurus123')
  console.log('                   ketua     / pengurus123')
  console.log(`  Login warga    : A1 (atau kode unit lain) / ${PIN_DEFAULT_WARGA}`)
  console.log('\n  Kasus khusus untuk dicoba:')
  console.log('    A12 Bp. Santo        - bayar security saja (PRD bag. 10)')
  console.log('    A6  Bp. Fakhri Ihsan - rapel 2 bulan Rp350.000')
  console.log('    B2  Bp. Ary          - Rp185.000 kombinasi bulan berjalan + rapel')
  console.log('    C7-C10               - menunggak beberapa bulan')
  console.log('    A9, B7, C3           - punya laporan menunggu verifikasi')
  console.log('    Pa Juki              - punya kasbon Rp300.000 belum lunas')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
