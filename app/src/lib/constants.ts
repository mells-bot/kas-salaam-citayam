export const ROLES = {
  WARGA: 'WARGA',
  BENDAHARA: 'BENDAHARA',
  KETUA: 'KETUA',
} as const
export type Role = (typeof ROLES)[keyof typeof ROLES]

/// Peran yang boleh melihat seluruh data & memverifikasi (NF-01).
export const PENGURUS: Role[] = [ROLES.BENDAHARA, ROLES.KETUA]

export const JENIS_TRANSAKSI = { MASUK: 'MASUK', KELUAR: 'KELUAR' } as const

export const STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  VOID: 'VOID',
} as const

export const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu verifikasi',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  VOID: 'Dibatalkan',
}

export const JENIS_IURAN = { SAMPAH: 'SAMPAH', SECURITY: 'SECURITY' } as const
export type JenisIuran = keyof typeof JENIS_IURAN

export const JENIS_IURAN_LABEL: Record<string, string> = {
  SAMPAH: 'Sampah',
  SECURITY: 'Security',
  TAMBAHAN: 'Tagihan tambahan',
}

export const METODE = { TRANSFER: 'Transfer', TUNAI: 'Tunai' } as const

/// Kategori pengeluaran sesuai F-05.
export const KATEGORI_PENGELUARAN = [
  'Honor Security',
  'Honor Kebersihan',
  'Iuran Sampah Pihak Ketiga',
  'Operasional',
  'Perbaikan & Material',
  'Kegiatan Warga',
  'Lain-lain',
] as const

export const SETTING_SALDO_AWAL = 'saldo_awal'
export const SETTING_TGL_SALDO_AWAL = 'tanggal_saldo_awal'

/// Jabatan karyawan (security/kebersihan yang digaji rutin cluster).
export const JABATAN = { SECURITY: 'SECURITY', KEBERSIHAN: 'KEBERSIHAN' } as const
export const JABATAN_LABEL: Record<string, string> = {
  SECURITY: 'Security',
  KEBERSIHAN: 'Kebersihan',
}
/// Kategori pengeluaran yang dipakai otomatis saat mencatat gajian per jabatan.
export const KATEGORI_GAJI: Record<string, string> = {
  SECURITY: 'Honor Security',
  KEBERSIHAN: 'Honor Kebersihan',
}

export const STATUS_KASBON = { BELUM_LUNAS: 'BELUM_LUNAS', LUNAS: 'LUNAS' } as const
export const STATUS_KASBON_LABEL: Record<string, string> = {
  BELUM_LUNAS: 'Belum lunas',
  LUNAS: 'Lunas',
}
