/**
 * Verifikasi tampilan: memuat setiap halaman lewat HTTP dengan sesi sungguhan,
 * lalu memastikan data warga asli benar-benar ter-render dan batas akses
 * antar peran ditegakkan.
 *
 * Jalankan dengan server hidup (npm run dev atau npm start):
 *   node --env-file=.env scripts/verifikasi-tampilan.mjs [basis-url]
 *
 * Catatan: React memecah teks JSX dengan penanda komentar <!-- -->, sehingga
 * pencocokan teks selalu dilakukan setelah penanda itu dibuang. Tanpa ini,
 * pemeriksaan seperti "34 unit aktif" gagal padahal halamannya benar.
 */
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const db = new PrismaClient()
const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? '')

let gagal = 0
const cek = (label, ok, ekstra = '') => {
  if (!ok) gagal++
  console.log(`${ok ? 'OK   ' : 'GAGAL'} ${label}${ekstra ? `  ${ekstra}` : ''}`)
}

const bersih = (s) => s.replace(/<!--[\s\S]*?-->/g, '')

/** Cookie sesi untuk username tertentu, dicocokkan case-insensitive seperti aksiLogin. */
async function sesi(username) {
  const rows = await db.$queryRaw`SELECT id FROM "User" WHERE LOWER(username) = LOWER(${username}) LIMIT 1`
  if (!rows[0]) throw new Error(`akun ${username} tidak ditemukan`)
  const u = await db.user.findUnique({ where: { id: rows[0].id } })
  const token = await new SignJWT({
    userId: u.id, username: u.username, nama: u.nama, role: u.role, unitId: u.unitId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
  return `kas_session=${token}`
}

async function halaman(path, cookie) {
  const r = await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: 'manual' })
  return { status: r.status, lokasi: r.headers.get('location'), html: r.ok ? bersih(await r.text()) : '' }
}

async function tungguServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/login`)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Server di ${BASE} tidak merespons. Jalankan "npm run dev" lebih dulu.`)
}

await tungguServer()

const bendahara = await sesi('bendahara')
const ketua = await sesi('ketua')

console.log('=== Proteksi akses ===')
{
  const r = await halaman('/pengurus', null)
  cek('pengurus tanpa sesi dialihkan ke /login', [302, 303, 307].includes(r.status) && r.lokasi?.includes('/login'))
  const w = await halaman('/pengurus', await sesi('A1'))
  cek('warga tidak bisa masuk area pengurus', [302, 303, 307].includes(w.status) && w.lokasi?.includes('/warga'))
  const k = await halaman('/pengurus/pengaturan', ketua)
  cek('ketua RT tidak bisa buka Pengaturan', [302, 303, 307].includes(k.status))
  const e = await fetch(`${BASE}/api/ekspor/ledger`, { headers: { cookie: await sesi('A1') } })
  cek('warga tidak bisa ekspor buku kas', e.status === 403)
}

console.log('\n=== Semua halaman merespons 200 ===')
for (const [label, path, cookie] of [
  ['login', '/login', null],
  ['dashboard pengurus', '/pengurus', bendahara],
  ['verifikasi', '/pengurus/verifikasi', bendahara],
  ['matriks tunggakan', '/pengurus/tunggakan', bendahara],
  ['buku kas', '/pengurus/ledger', bendahara],
  ['catat transaksi', '/pengurus/ledger/baru', bendahara],
  ['laporan bulanan', '/pengurus/laporan', bendahara],
  ['data warga', '/pengurus/warga', bendahara],
  ['jejak audit', '/pengurus/audit', bendahara],
  ['pengaturan', '/pengurus/pengaturan', bendahara],
  ['status iuran warga', '/warga', await sesi('A1')],
  ['form lapor bayar', '/warga/lapor', await sesi('C10')],
  ['riwayat warga', '/warga/riwayat', await sesi('A1')],
  ['akun warga', '/warga/akun', await sesi('A1')],
]) {
  const r = await halaman(path, cookie)
  cek(`${label} (${path})`, r.status === 200, r.status === 200 ? '' : `status ${r.status}`)
}

console.log('\n=== Data warga asli ter-render ===')
{
  const tg = (await halaman('/pengurus/tunggakan', bendahara)).html
  for (const nama of [
    'Bp. Asep', 'Bp. Syahrul', 'Ibu Fatimah', 'Bp. Hilman/Edi', 'Bp. Fakhri Ihsan',
    'Bp. Santo', 'Bp. Ferry', 'Bp. Amran', 'Bp. Gilang/Riki', 'Bp. Imam Nawawi',
    'Bp. Imam Rosadi', 'Bp. Abu Ali', 'Ibu Hasanah',
  ]) {
    cek(`nama "${nama}" tampil`, tg.includes(nama))
  }
  cek('kode khusus B1a & B1b tampil', tg.includes('B1a') && tg.includes('B1b'))
  cek('tidak ada sisa data placeholder', !/Warga [ABC]-\d/.test(tg))
  cek('tidak ada kode format lama (A-01)', !tg.includes('A-01'))

  // Urutan tampilan harus mengikuti kolom "No", bukan urutan teks kode unit.
  const kode = [...tg.matchAll(/>([ABC]\d{1,2}[ab]?)</g)].map((m) => m[1])
  const unik = kode.filter((v, i, a) => a.indexOf(v) === i)
  cek('urutan unit A1, A2, A3, ...', unik.slice(0, 3).join(',') === 'A1,A2,A3', `dapat: ${unik.slice(0, 6).join(', ')}`)
  cek('A10 tepat setelah A9', unik.indexOf('A10') === unik.indexOf('A9') + 1)
  cek('C10 unit terakhir', unik.at(-1) === 'C10')
  cek('34 unit unik tampil', unik.length === 34, `dapat: ${unik.length}`)
}

console.log('\n=== Angka ringkasan ===')
{
  const dw = (await halaman('/pengurus/warga', bendahara)).html
  const dash = (await halaman('/pengurus', bendahara)).html
  cek('Data Warga: 34 unit aktif dari 34 terdaftar', /34 unit aktif dari 34 terdaftar/.test(dw))
  cek('Dashboard: 34 unit aktif', /34 unit aktif/.test(dash))
  cek('catatan PERLU KONFIRMASI A12 tampil', dw.includes('PERLU KONFIRMASI'))
  const saldo = dash.match(/Saldo kas saat ini<\/p>[\s\S]{0,200}?(Rp[\d.]+)/)
  cek('saldo kas tampil di dashboard', Boolean(saldo), saldo ? saldo[1] : '')
}

console.log('\n=== Kasus khusus dari PRD, dilihat dari sisi warga ===')
{
  const santo = (await halaman('/warga', await sesi('A12'))).html
  cek('A12 Bp. Santo: nama & unit tampil', santo.includes('Bp. Santo') && santo.includes('A12'))
  cek('A12: status "Sebagian" muncul (bayar security saja)', santo.includes('Sebagian'))

  const fakhri = (await halaman('/warga', await sesi('A6'))).html
  cek('A6 Bp. Fakhri Ihsan: lunas (rapel 2 bulan diakui)', fakhri.includes('Bp. Fakhri Ihsan') && fakhri.includes('sudah lunas'))

  const ary = (await halaman('/warga', await sesi('B2'))).html
  cek('B2 Bp. Ary: nama tampil', ary.includes('Bp. Ary'))

  const hasanah = (await halaman('/warga', await sesi('C10'))).html
  cek('C10 Ibu Hasanah: punya tunggakan', hasanah.includes('Ibu Hasanah') && hasanah.includes('bulan belum lunas'))

  // Login huruf kecil untuk kode bercampur besar-kecil.
  const ferry = (await halaman('/warga', await sesi('b1a'))).html
  cek('login "b1a" menemukan unit B1a (Bp. Ferry)', ferry.includes('Bp. Ferry') && ferry.includes('B1a'))
}

console.log('\n=== Ekspor CSV ===')
{
  for (const [label, path] of [['buku kas', '/api/ekspor/ledger'], ['tunggakan', '/api/ekspor/tunggakan']]) {
    const r = await fetch(`${BASE}${path}`, { headers: { cookie: bendahara } })
    const teks = await r.text()
    cek(`ekspor ${label}`, r.ok && teks.includes(','), `${teks.split('\r\n').length} baris`)
  }
  const csv = await (await fetch(`${BASE}/api/ekspor/tunggakan`, { headers: { cookie: bendahara } })).text()
  cek('CSV tunggakan memuat nama warga asli', csv.includes('Ibu Hasanah') && csv.includes('Bp. Santo'))
}

await db.$disconnect()
console.log(gagal === 0 ? '\nSEMUA TAMPILAN LULUS' : `\n${gagal} PEMERIKSAAN GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
