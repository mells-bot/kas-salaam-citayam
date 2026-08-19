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
}

export const METODE = { TRANSFER: 'Transfer', TUNAI: 'Tunai' } as const

/// Kategori pengeluaran sesuai F-05.
export const KATEGORI_PENGELUARAN = [
  'Honor Security',
  'Iuran Sampah Pihak Ketiga',
  'Operasional',
  'Perbaikan & Material',
  'Kegiatan Warga',
  'Lain-lain',
] as const

export const SETTING_SALDO_AWAL = 'saldo_awal'
export const SETTING_TGL_SALDO_AWAL = 'tanggal_saldo_awal'
