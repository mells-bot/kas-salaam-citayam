import { db } from './db'

/// Kategori pengeluaran aktif, dipakai mengisi dropdown form input transaksi.
export async function daftarKategoriAktif() {
  return db.kategoriPengeluaran.findMany({
    where: { aktif: true },
    orderBy: [{ urutan: 'asc' }, { nama: 'asc' }],
  })
}

/// Semua kategori (termasuk nonaktif), dipakai di halaman Pengaturan.
export async function daftarSemuaKategori() {
  return db.kategoriPengeluaran.findMany({
    orderBy: [{ aktif: 'desc' }, { urutan: 'asc' }, { nama: 'asc' }],
  })
}

/// Nama kategori aktif saat ini, dipakai memvalidasi kategori kiriman form
/// tanpa perlu enum statis di kode (lihat lib/validasi.ts).
export async function namaKategoriAktif(): Promise<string[]> {
  const rows = await daftarKategoriAktif()
  return rows.map((r) => r.nama)
}
