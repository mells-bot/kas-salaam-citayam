/**
 * Verifikasi kredensial: pencocokan username case-insensitive + hashing PIN.
 *
 * Menirukan persis kueri yang dipakai aksiLogin, sehingga kasus kode unit
 * bercampur huruf besar-kecil ("B1a") benar-benar teruji.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
let gagal = 0
const cek = (l, a, h) => {
  const ok = a === h
  if (!ok) gagal++
  console.log(`${ok ? 'OK   ' : 'GAGAL'} ${l}${ok ? '' : ` (aktual ${a}, harapan ${h})`}`)
}

/** Sama dengan pencarian di src/app/login/actions.ts. */
async function cari(input) {
  const rows = await db.$queryRaw`SELECT id FROM "User" WHERE LOWER(username) = LOWER(${input}) LIMIT 1`
  if (!rows[0]) return null
  return db.user.findUnique({ where: { id: rows[0].id } })
}

console.log('=== Pencocokan username ===')
cek('kode unit apa adanya', (await cari('A1'))?.username, 'A1')
cek('kode unit huruf kecil', (await cari('a1'))?.username, 'A1')
// Inilah kasus yang gagal kalau hanya mencoba varian upper/lower.
cek('kode campuran apa adanya (B1a)', (await cari('B1a'))?.username, 'B1a')
cek('kode campuran huruf kecil (b1a)', (await cari('b1a'))?.username, 'B1a')
cek('kode campuran huruf besar (B1A)', (await cari('B1A'))?.username, 'B1a')
cek('kode dua digit (A10)', (await cari('a10'))?.username, 'A10')
cek('kode blok C (C10)', (await cari('c10'))?.username, 'C10')
cek('username pengurus huruf besar', (await cari('BENDAHARA'))?.username, 'bendahara')
cek('username asing tidak ditemukan', await cari('tidak-ada'), null)
cek('B4 tidak ada (memang tidak terdaftar)', await cari('B4'), null)

console.log('\n=== PIN ===')
const a1 = await cari('A1')
const bdh = await cari('bendahara')
cek('PIN warga benar diterima', await bcrypt.compare('123456', a1.pinHash), true)
cek('PIN warga salah ditolak', await bcrypt.compare('999999', a1.pinHash), false)
cek('PIN pengurus benar diterima', await bcrypt.compare('pengurus123', bdh.pinHash), true)
cek('PIN pengurus salah ditolak', await bcrypt.compare('123456', bdh.pinHash), false)
cek('PIN tidak disimpan sebagai teks biasa', a1.pinHash.startsWith('$2'), true)

console.log('\n=== Integritas akun & unit ===')
const warga = await db.user.count({ where: { role: 'WARGA' } })
const unit = await db.unit.count()
cek('setiap unit punya akun warga', warga, unit)
cek('jumlah unit sesuai daftar pengurus (34)', unit, 34)

// Kode unit tidak boleh bentrok secara case-insensitive, karena login juga
// case-insensitive — dua kode yang beda hanya kapitalisasinya = satu kredensial.
const semua = await db.unit.findMany({ select: { kode: true } })
const kecil = semua.map((u) => u.kode.toLowerCase())
cek('tidak ada kode unit bentrok (case-insensitive)', new Set(kecil).size, semua.length)

const namaGanda = await db.unit.groupBy({ by: ['namaWarga'], _count: true })
const ganda = namaGanda.filter((n) => n._count > 1).map((n) => n.namaWarga)
console.log(`     catatan: nama warga yang muncul >1x: ${ganda.length ? ganda.join(', ') : 'tidak ada'} (dibedakan lewat kode unit)`)

await db.$disconnect()
console.log(gagal === 0 ? '\nLOGIN & KREDENSIAL LULUS' : `\n${gagal} GAGAL`)
process.exit(gagal ? 1 : 0)
