import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const logLevels = process.env.NODE_ENV === 'development' ? (['warn', 'error'] as const) : (['error'] as const)

/**
 * Lokal: PrismaClient biasa membaca file SQLite langsung lewat
 * DATABASE_URL="file:./dev.db" — tanpa driver adapter.
 *
 * Produksi (Turso): dipakai driver adapter libsql lewat TURSO_DATABASE_URL +
 * TURSO_AUTH_TOKEN yang TERPISAH dari DATABASE_URL.
 *
 * Kenapa dipisah: Prisma memvalidasi bahwa datasource provider "sqlite" pada
 * schema.prisma nilainya harus berformat "file:...", terlepas dari driver
 * adapter apa pun yang dipakai saat runtime. Kalau DATABASE_URL diisi
 * "libsql://...", perintah CLI seperti `prisma db push`/`generate` gagal
 * validasi skema (P1012) sebelum sempat memakai adapter sama sekali. Jadi
 * DATABASE_URL tetap "file:./dev.db" di semua environment (nilainya tidak
 * pernah benar-benar dipakai untuk konek saat adapter aktif), dan koneksi
 * sungguhan ke Turso lewat TURSO_DATABASE_URL. Dialeknya tetap SQLite yang
 * sama, jadi skema dan seluruh kueri Prisma tidak berubah sama sekali.
 */
function buatClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (tursoUrl && authToken) {
    const adapter = new PrismaLibSql({ url: tursoUrl, authToken })
    return new PrismaClient({ adapter, log: [...logLevels] })
  }

  return new PrismaClient({ log: [...logLevels] })
}

export const db = globalForPrisma.prisma ?? buatClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
