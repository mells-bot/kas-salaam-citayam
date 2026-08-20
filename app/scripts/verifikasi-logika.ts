/**
 * Verifikasi logika inti: perhitungan saldo, status lunas/tunggak, dan aturan
 * bahwa laporan PENDING tidak boleh memengaruhi apa pun.
 *
 * Dihitung ulang secara independen dari SQL mentah, lalu dibandingkan dengan
 * hasil pustaka. Kalau keduanya cocok, mesin perhitungannya benar.
 */
import { db } from '../src/lib/db'
import { kartuIuranUnit, kartuIuranSemuaUnit } from '../src/lib/iuran'
import { ringkasanKas, arusKasBulanan } from '../src/lib/kas'
import { rentangPeriode, tambahBulan, periodeSekarang } from '../src/lib/periode'
import { rupiah } from '../src/lib/format'
import { statusTagihanTambahan, statusUnitUntukTagihan } from '../src/lib/tambahan'

let gagal = 0
function cek(label: string, aktual: unknown, harapan: unknown) {
  const ok = JSON.stringify(aktual) === JSON.stringify(harapan)
  if (!ok) gagal++
  console.log(`${ok ? 'OK   ' : 'GAGAL'} ${label}${ok ? '' : `\n         aktual  : ${JSON.stringify(aktual)}\n         harapan : ${JSON.stringify(harapan)}`}`)
}

async function main() {
  console.log('=== 1. Utilitas periode ===')
  cek('tambahBulan lintas tahun', tambahBulan('2026-12', 1), '2027-01')
  cek('tambahBulan mundur lintas tahun', tambahBulan('2026-01', -1), '2025-12')
  cek('tambahBulan mundur 13 bulan', tambahBulan('2026-08', -13), '2025-07')
  cek('rentangPeriode inklusif', rentangPeriode('2026-01', '2026-03'), ['2026-01', '2026-02', '2026-03'])
  cek('rentangPeriode terbalik -> kosong', rentangPeriode('2026-05', '2026-01'), [])
  cek('rentangPeriode satu bulan', rentangPeriode('2026-05', '2026-05'), ['2026-05'])
  cek('rupiah negatif', rupiah(-175000), '-Rp175.000')

  console.log('\n=== 2. Saldo kas dihitung ulang dari SQL mentah ===')
  const kas = await ringkasanKas()
  const [{ masuk, keluar }] = await db.$queryRawUnsafe<{ masuk: number; keluar: number }[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN jenis='MASUK'  THEN nominal END),0) AS masuk,
       COALESCE(SUM(CASE WHEN jenis='KELUAR' THEN nominal END),0) AS keluar
     FROM "Transaction"
     WHERE status='APPROVED' AND dibatalkanPada IS NULL`,
  )
  const setting = await db.setting.findUnique({ where: { key: 'saldo_awal' } })
  const awal = Number(setting?.value ?? 0)

  cek("total pemasukan resmi", kas.totalMasuk, Number(masuk))
  cek("total pengeluaran resmi", kas.totalKeluar, Number(keluar))
  cek("saldo akhir = awal + masuk - keluar", kas.saldoAkhir, awal + Number(masuk) - Number(keluar))
  console.log(`       saldo: ${rupiah(awal)} + ${rupiah(Number(masuk))} - ${rupiah(Number(keluar))} = ${rupiah(kas.saldoAkhir)}`)

  console.log('\n=== 3. Arus kas bulanan konsisten dengan saldo total ===')
  const arus = await arusKasBulanan(24)
  cek('saldo akhir baris terakhir = saldo kas', arus.at(-1)?.saldoAkhir, kas.saldoAkhir)
  let berurutan = true
  for (let i = 1; i < arus.length; i++) {
    if (arus[i].saldoAkhir !== arus[i - 1].saldoAkhir + arus[i].bersih) berurutan = false
  }
  cek('saldo berjalan tiap bulan berantai benar', berurutan, true)

  console.log('\n=== 4. Kasus variasi nominal dari PRD ===')
  // A6 rapel 2 bulan Rp350.000 -> Juli & Agustus harus LUNAS.
  const a6 = await db.unit.findUnique({ where: { kode: 'A6' } })
  const kartuA6 = await kartuIuranUnit(a6!.id, '2026-08')
  cek(
    'A6 rapel 350rb: Juli 2026 lunas',
    kartuA6!.baris.find((b) => b.periode === '2026-07')?.status,
    'LUNAS',
  )
  cek(
    'A6 rapel 350rb: Agustus 2026 lunas',
    kartuA6!.baris.find((b) => b.periode === '2026-08')?.status,
    'LUNAS',
  )
  cek('A6 tanpa tunggakan', kartuA6!.totalTunggakan, 0)

  // A12 (Bp. Santo) hanya bayar security 140rb -> Juli SEBAGIAN, kurang tepat 35.000.
  const a12 = await db.unit.findUnique({ where: { kode: 'A12' } })
  const kartuA12 = await kartuIuranUnit(a12!.id, '2026-07')
  const juliA12 = kartuA12!.baris.find((b) => b.periode === '2026-07')
  cek('A12 security saja: status SEBAGIAN', juliA12?.status, 'SEBAGIAN')
  cek('A12 kekurangan tepat tarif sampah', juliA12?.totalKurang, 35000)
  cek('A12 security sudah penuh', juliA12?.security.kurang, 0)

  // B2 (Bp. Ary) Rp185.000: Agustus penuh + 10rb ke sampah Juli -> Juli masih kurang 25rb.
  const b2 = await db.unit.findUnique({ where: { kode: 'B2' } })
  const kartuB2 = await kartuIuranUnit(b2!.id, '2026-08')
  cek(
    'B2 sisa sampah Juli kurang 25rb',
    kartuB2!.baris.find((b) => b.periode === '2026-07')?.sampah.kurang,
    25000,
  )
  cek(
    'B2 Agustus 2026 lunas',
    kartuB2!.baris.find((b) => b.periode === '2026-08')?.status,
    'LUNAS',
  )

  console.log('\n=== 5. Tarif per-unit: komponen bertarif 0 tidak ditagih ===')
  // Tidak ada unit sungguhan bertarif 0 di data awal — A12 (Bp. Santo) sengaja
  // dibiarkan tertagih normal sampai bendahara mengonfirmasi. Jadi kemampuan
  // "tarif 0" diuji lewat unit sementara, lalu dibersihkan.
  const unitUji = await db.unit.create({
    data: {
      kode: 'ZZ-UJI', blok: 'ZZ', nomor: 'UJI', urutan: 999,
      namaWarga: 'Unit uji otomatis', mulaiPeriode: '2026-06',
      tarifSampah: 0, tarifSecurity: 140_000,
    },
  })
  const kartuNol = await kartuIuranUnit(unitUji.id, '2026-06')
  const juniNol = kartuNol!.baris.find((b) => b.periode === '2026-06')
  cek('tarif 0: wajib bulanan hanya security', juniNol?.totalWajib, 140000)
  cek('tarif 0: status BELUM sebelum dibayar', juniNol?.status, 'BELUM')
  cek('tarif 0: komponen sampah tidak menambah kekurangan', juniNol?.sampah.kurang, 0)

  await db.transaction.create({
    data: {
      jenis: 'MASUK', tanggal: new Date('2026-06-10'), nominal: 140_000,
      uraian: 'UJI tarif nol', metode: 'TRANSFER', unitId: unitUji.id, status: 'APPROVED',
      alokasi: { create: [{ periode: '2026-06', jenisIuran: 'SECURITY', nominal: 140_000 }] },
    },
  })
  const kartuNol2 = await kartuIuranUnit(unitUji.id, '2026-06')
  cek(
    'tarif 0: LUNAS tanpa pernah bayar sampah',
    kartuNol2!.baris.find((b) => b.periode === '2026-06')?.status,
    'LUNAS',
  )
  cek('tarif 0: tanpa tunggakan', kartuNol2!.totalTunggakan, 0)

  await db.transaction.deleteMany({ where: { unitId: unitUji.id } })
  await db.unit.delete({ where: { id: unitUji.id } })

  console.log('\n=== 5b. A12 (Bp. Santo) sengaja masih tertagih penuh ===')
  const a12b = await db.unit.findUnique({ where: { kode: 'A12' } })
  cek('A12 tarif sampah TIDAK di-nol-kan', a12b!.tarifSampah, 35000)
  cek('A12 punya catatan perlu konfirmasi', a12b!.catatan?.includes('PERLU KONFIRMASI'), true)

  console.log('\n=== 6. Laporan PENDING tidak mengubah status lunas (F-03) ===')
  const a9 = await db.unit.findUnique({ where: { kode: 'A9' } })
  const pendingA9 = await db.transaction.findFirst({
    where: { unitId: a9!.id, status: 'PENDING' },
    include: { alokasi: true },
  })
  cek('ada laporan PENDING untuk A9', Boolean(pendingA9), true)

  const sebelum = await kartuIuranUnit(a9!.id, '2026-08')
  const agustusSebelum = sebelum!.baris.find((b) => b.periode === '2026-08')
  cek('Agustus A9 BELUM meski ada laporan pending', agustusSebelum?.status, 'BELUM')
  cek('kekurangan penuh 175rb', agustusSebelum?.totalKurang, 175000)

  const saldoSebelum = (await ringkasanKas()).saldoAkhir

  // Simulasikan persetujuan bendahara.
  await db.transaction.update({
    where: { id: pendingA9!.id },
    data: { status: 'APPROVED', reviewedAt: new Date() },
  })

  const sesudah = await kartuIuranUnit(a9!.id, '2026-08')
  const agustusSesudah = sesudah!.baris.find((b) => b.periode === '2026-08')
  cek('setelah disetujui -> Agustus LUNAS', agustusSesudah?.status, 'LUNAS')
  const saldoSesudah = (await ringkasanKas()).saldoAkhir
  cek('saldo naik tepat sebesar nominal', saldoSesudah - saldoSebelum, pendingA9!.nominal)

  // Pembatalan (soft delete) harus mengembalikan keadaan.
  await db.transaction.update({
    where: { id: pendingA9!.id },
    data: { status: 'VOID', dibatalkanPada: new Date(), alasanPembatalan: 'uji verifikasi' },
  })
  const setelahBatal = await kartuIuranUnit(a9!.id, '2026-08')
  cek(
    'setelah dibatalkan -> Agustus BELUM lagi',
    setelahBatal!.baris.find((b) => b.periode === '2026-08')?.status,
    'BELUM',
  )
  cek('saldo kembali ke semula', (await ringkasanKas()).saldoAkhir, saldoSebelum)
  cek('baris transaksi tidak hilang (NF-04)', await db.transaction.count({ where: { id: pendingA9!.id } }), 1)

  // Pulihkan keadaan semula agar data seed tetap seperti awal.
  await db.transaction.update({
    where: { id: pendingA9!.id },
    data: { status: 'PENDING', dibatalkanPada: null, alasanPembatalan: null, reviewedAt: null },
  })

  console.log('\n=== 7. Kelebihan bayar satu komponen tidak menutupi komponen lain ===')
  // Aturan penting: security lebih bayar tidak boleh membuat sampah tampak lunas.
  // C10 pada 2026-05 sengaja dipilih karena di data seed periode itu belum
  // dibayar sama sekali, jadi hasilnya murni dari transaksi uji ini.
  const uji = await db.unit.findUnique({ where: { kode: 'C10' } })
  const awalKelebihan = (await kartuIuranUnit(uji!.id, '2026-05'))!.totalKelebihan
  cek('titik awal C10 Mei belum dibayar', (await kartuIuranUnit(uji!.id, '2026-05'))!.baris.find((b) => b.periode === '2026-05')?.status, 'BELUM')

  const trxUji = await db.transaction.create({
    data: {
      jenis: 'MASUK', tanggal: new Date('2026-05-10'), nominal: 200000,
      uraian: 'UJI kelebihan security', metode: 'TRANSFER', unitId: uji!.id, status: 'APPROVED',
      alokasi: { create: [{ periode: '2026-05', jenisIuran: 'SECURITY', nominal: 200000 }] },
    },
  })
  const kartuUji = await kartuIuranUnit(uji!.id, '2026-05')
  const mei = kartuUji!.baris.find((b) => b.periode === '2026-05')
  cek('bayar security 200rb (lebih 60rb): status tetap SEBAGIAN', mei?.status, 'SEBAGIAN')
  cek('sampah tetap kurang 35rb', mei?.sampah.kurang, 35000)
  cek('security tidak dianggap kurang', mei?.security.kurang, 0)
  cek('kelebihan bertambah tepat 60rb', kartuUji!.totalKelebihan - awalKelebihan, 60000)
  await db.allocation.deleteMany({ where: { transactionId: trxUji.id } })
  await db.transaction.delete({ where: { id: trxUji.id } })

  console.log('\n=== 7b. Pengurutan unit mengikuti nomor urut, bukan teks kode ===')
  // Kode unit asli ("A10", "B1a") tidak terurut benar sebagai teks: urutan teks
  // menghasilkan A1, A10, A11, A12, A2. Kolom `urutan` yang memperbaikinya.
  const urut = await kartuIuranSemuaUnit(periodeSekarang())
  const kodeUrut = urut.map((k) => k.kode)
  cek('unit pertama adalah A1', kodeUrut[0], 'A1')
  cek('A2 langsung setelah A1', kodeUrut[1], 'A2')
  cek('A10 setelah A9, bukan setelah A1', kodeUrut.indexOf('A10'), kodeUrut.indexOf('A9') + 1)
  cek('A12 sebelum B1a', kodeUrut.indexOf('A12') < kodeUrut.indexOf('B1a'), true)
  cek('B1a sebelum B1b', kodeUrut.indexOf('B1a') < kodeUrut.indexOf('B1b'), true)
  cek('C10 adalah unit terakhir', kodeUrut.at(-1), 'C10')
  cek('tidak ada B4 (memang tidak ada di daftar)', kodeUrut.includes('B4'), false)
  cek('total 34 kode unik', new Set(kodeUrut).size, 34)

  console.log('\n=== 8. Konsistensi lintas unit ===')
  const semua = await kartuIuranSemuaUnit(periodeSekarang())
  const unitAktif = await db.unit.count({ where: { aktif: true } })
  cek('jumlah kartu = jumlah unit aktif', semua.length, unitAktif)
  const adaTunggakanNegatif = semua.some((k) => k.totalTunggakan < 0)
  cek('tidak ada tunggakan negatif', adaTunggakanNegatif, false)

  // Bandingkan satu unit dari kalkulasi massal vs kalkulasi tunggal.
  const satu = await kartuIuranUnit(semua[5].unitId, periodeSekarang())
  cek('hasil massal == hasil tunggal', satu!.totalTunggakan, semua[5].totalTunggakan)

  console.log('\n=== 9. Tagihan tambahan (THR, dsb.) — jalur terpisah dari iuran bulanan ===')
  const c9 = await db.unit.findUnique({ where: { kode: 'C9' } })
  const tagihanUji = await db.tagihanTambahan.create({
    data: { nama: 'UJI THR', periode: '2027-03', nominalPerUnit: 175_000 },
  })

  const sebelumBayar = await statusUnitUntukTagihan(tagihanUji.id, c9!.id)
  cek('sebelum bayar: status BELUM', sebelumBayar?.status, 'BELUM')
  cek('sebelum bayar: kurang penuh 175rb', sebelumBayar?.kurang, 175_000)

  // Laporan PENDING tidak boleh mengubah status, sama seperti iuran bulanan.
  const trxTagihan = await db.transaction.create({
    data: {
      jenis: 'MASUK', tanggal: new Date('2027-03-10'), nominal: 175_000,
      uraian: 'UJI bayar THR', metode: 'TRANSFER', unitId: c9!.id, status: 'PENDING',
      alokasi: {
        create: [{ periode: '2027-03', jenisIuran: 'TAMBAHAN', nominal: 175_000, tagihanTambahanId: tagihanUji.id }],
      },
    },
  })
  const saatPending = await statusUnitUntukTagihan(tagihanUji.id, c9!.id)
  cek('laporan PENDING: status masih BELUM', saatPending?.status, 'BELUM')

  const saldoSebelumTHR = (await ringkasanKas()).saldoAkhir
  await db.transaction.update({ where: { id: trxTagihan.id }, data: { status: 'APPROVED', reviewedAt: new Date() } })

  const setelahApprove = await statusUnitUntukTagihan(tagihanUji.id, c9!.id)
  cek('setelah disetujui: status LUNAS', setelahApprove?.status, 'LUNAS')
  const saldoSetelahTHR = (await ringkasanKas()).saldoAkhir
  cek('saldo kas naik tepat sebesar THR (reuse ledger utama)', saldoSetelahTHR - saldoSebelumTHR, 175_000)

  // Unit lain yang belum bayar harus tetap BELUM — tagihan ini per-unit, bukan global.
  const c8 = await db.unit.findUnique({ where: { kode: 'C8' } })
  const unitLain = await statusUnitUntukTagihan(tagihanUji.id, c8!.id)
  cek('unit lain yang belum bayar: tetap BELUM', unitLain?.status, 'BELUM')

  const semuaStatusTHR = await statusTagihanTambahan(tagihanUji.id)
  cek('status massal: 1 unit LUNAS', semuaStatusTHR.filter((s) => s.status === 'LUNAS').length, 1)
  cek('status massal: cakupan = seluruh unit aktif', semuaStatusTHR.length, unitAktif)

  // Bersihkan data uji.
  await db.allocation.deleteMany({ where: { transactionId: trxTagihan.id } })
  await db.transaction.delete({ where: { id: trxTagihan.id } })
  await db.tagihanTambahan.delete({ where: { id: tagihanUji.id } })

  console.log('\n=== 9b. Cakupan tagihan tambahan: FLAT / SECURITY / PENUH ===')
  // Unit sementara bertarif sampah 0 (independen dari A12 -- statusnya
  // "tarifSampah=0" bisa berbeda antara lokal dan produksi tergantung
  // konfirmasi bendahara, jadi tes ini tidak boleh berasumsi soal A12).
  const unitTarifNol = await db.unit.create({
    data: {
      kode: 'ZZ-CAKUPAN', blok: 'ZZ', nomor: 'UJI', urutan: 998,
      namaWarga: 'Unit uji cakupan', mulaiPeriode: '2026-01',
      tarifSampah: 0, tarifSecurity: 140_000,
    },
  })
  const unitNormal = await db.unit.findUnique({ where: { kode: 'A7' } }) // tarif standar 35rb+140rb

  const tagihanSecurity = await db.tagihanTambahan.create({
    data: { nama: 'UJI cakupan SECURITY', periode: '2027-04', cakupan: 'SECURITY' },
  })
  const statusNolSecurity = await statusUnitUntukTagihan(tagihanSecurity.id, unitTarifNol.id)
  const statusA7Security = await statusUnitUntukTagihan(tagihanSecurity.id, unitNormal!.id)
  cek('SECURITY: wajib unit tarifSampah=0 = tarifSecurity-nya', statusNolSecurity?.wajib, 140_000)
  cek('SECURITY: wajib A7 = tarifSecurity A7 (bukan tarif unit lain)', statusA7Security?.wajib, unitNormal!.tarifSecurity)
  await db.tagihanTambahan.delete({ where: { id: tagihanSecurity.id } })

  const tagihanPenuh = await db.tagihanTambahan.create({
    data: { nama: 'UJI cakupan PENUH', periode: '2027-04', cakupan: 'PENUH' },
  })
  const statusNolPenuh = await statusUnitUntukTagihan(tagihanPenuh.id, unitTarifNol.id)
  const statusA7Penuh = await statusUnitUntukTagihan(tagihanPenuh.id, unitNormal!.id)
  cek('PENUH: wajib unit tarifSampah=0 = tarifSampah(0)+tarifSecurity', statusNolPenuh?.wajib, 140_000)
  cek(
    'PENUH: unit tarifSampah=0 -> PENUH sama dengan SECURITY-saja (otomatis ikut tarif unit)',
    statusNolPenuh?.wajib,
    statusNolSecurity?.wajib,
  )
  cek(
    'PENUH: wajib A7 = tarifSampah+tarifSecurity A7 (unit normal, lebih besar dari SECURITY-saja)',
    statusA7Penuh?.wajib,
    unitNormal!.tarifSampah + unitNormal!.tarifSecurity,
  )
  cek('PENUH: A7 (unit normal) LEBIH BESAR dari SECURITY-saja', statusA7Penuh!.wajib > statusA7Security!.wajib, true)
  await db.tagihanTambahan.delete({ where: { id: tagihanPenuh.id } })

  const tagihanFlat = await db.tagihanTambahan.create({
    data: { nama: 'UJI cakupan FLAT', periode: '2027-04', cakupan: 'FLAT', nominalPerUnit: 50_000 },
  })
  const statusNolFlat = await statusUnitUntukTagihan(tagihanFlat.id, unitTarifNol.id)
  const statusA7Flat = await statusUnitUntukTagihan(tagihanFlat.id, unitNormal!.id)
  cek('FLAT: wajib sama untuk semua unit terlepas dari tarif unit', statusNolFlat?.wajib, 50_000)
  cek('FLAT: wajib sama untuk semua unit terlepas dari tarif unit (unit lain)', statusA7Flat?.wajib, 50_000)
  await db.tagihanTambahan.delete({ where: { id: tagihanFlat.id } })
  await db.unit.delete({ where: { id: unitTarifNol.id } })

  console.log('\n=== 10. Kasbon & gajian — potongan FIFO dan saldo kas ===')
  const jukiSebelum = await db.karyawan.findFirst({ where: { nama: 'Pa Juki' } })
  cek('Pa Juki ada di data seed', Boolean(jukiSebelum), true)

  const kasbonJuki = await db.kasbon.findMany({ where: { karyawanId: jukiSebelum!.id, status: 'BELUM_LUNAS' } })
  const totalKasbonAwal = kasbonJuki.reduce((s, k) => s + k.sisaBelumLunas, 0)
  cek('kasbon awal Pa Juki dari seed 300rb', totalKasbonAwal, 300_000)

  const saldoSebelumGaji = (await ringkasanKas()).saldoAkhir

  // Proses gajian UJI: gaji 1.450.000, potongan kasbon 300.000 (sesuai saran = min(gaji, kasbon)).
  const potonganUji = Math.min(jukiSebelum!.gajiPokok, totalKasbonAwal)
  const gajianUji = await db.$transaction(async (tx) => {
    const totalDibayar = jukiSebelum!.gajiPokok - potonganUji
    const trx = await tx.transaction.create({
      data: {
        jenis: 'KELUAR', tanggal: new Date('2027-03-28'), nominal: totalDibayar,
        uraian: 'UJI gaji Pa Juki', kategori: 'Honor Security', metode: 'TRANSFER', status: 'APPROVED',
      },
    })
    const gajian = await tx.gajian.create({
      data: {
        karyawanId: jukiSebelum!.id, periode: '2027-03', gajiPokok: jukiSebelum!.gajiPokok,
        totalPotongan: potonganUji, totalDibayar, tanggal: new Date('2027-03-28'), transactionId: trx.id,
      },
    })
    let sisa = potonganUji
    for (const k of kasbonJuki) {
      if (sisa <= 0) break
      const potong = Math.min(k.sisaBelumLunas, sisa)
      await tx.potonganKasbon.create({ data: { kasbonId: k.id, gajianId: gajian.id, nominal: potong } })
      const sisaBaru = k.sisaBelumLunas - potong
      await tx.kasbon.update({ where: { id: k.id }, data: { sisaBelumLunas: sisaBaru, status: sisaBaru === 0 ? 'LUNAS' : 'BELUM_LUNAS' } })
      sisa -= potong
    }
    return gajian
  })

  cek('totalDibayar = gajiPokok - potongan', gajianUji.totalDibayar, jukiSebelum!.gajiPokok - potonganUji)

  const kasbonSetelah = await db.kasbon.findMany({ where: { karyawanId: jukiSebelum!.id } })
  const totalSisaSetelah = kasbonSetelah.reduce((s, k) => s + (k.status === 'BELUM_LUNAS' ? k.sisaBelumLunas : 0), 0)
  cek('kasbon terpotong penuh (300rb <= gaji)', totalSisaSetelah, 0)
  cek('kasbon berubah status LUNAS', kasbonSetelah.every((k) => k.status === 'LUNAS'), true)

  const saldoSetelahGaji = (await ringkasanKas()).saldoAkhir
  cek(
    'saldo kas berkurang tepat sebesar yang benar-benar dibayar (bukan gaji pokok penuh)',
    saldoSebelumGaji - saldoSetelahGaji,
    gajianUji.totalDibayar,
  )

  // Gaji pokok penuh TIDAK boleh mengurangi saldo — hanya totalDibayar (setelah potongan) yang riil keluar dari kas.
  cek('potongan kasbon tidak mengurangi saldo dua kali', saldoSebelumGaji - saldoSetelahGaji < jukiSebelum!.gajiPokok, true)

  // Bersihkan data uji, kembalikan kasbon Pa Juki ke keadaan seed semula.
  await db.potonganKasbon.deleteMany({ where: { gajianId: gajianUji.id } })
  await db.gajian.delete({ where: { id: gajianUji.id } })
  await db.transaction.delete({ where: { id: gajianUji.transactionId! } })
  for (const k of kasbonJuki) {
    await db.kasbon.update({ where: { id: k.id }, data: { sisaBelumLunas: k.sisaBelumLunas, status: 'BELUM_LUNAS' } })
  }

  console.log(`\n${gagal === 0 ? 'SEMUA LOGIKA LULUS' : `${gagal} PEMERIKSAAN GAGAL`}`)
  await db.$disconnect()
  process.exit(gagal === 0 ? 0 : 1)
}

main()
