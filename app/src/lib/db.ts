import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const logLevels = process.env.NODE_ENV === 'development' ? (['warn', 'error'] as const) : (['error'] as const)

/**
 * Lokal (dan sebelum Turso disiapkan): PrismaClient biasa membaca file SQLite
 * langsung lewat DATABASE_URL="file:./dev.db" — tanpa driver adapter.
 *
 * Produksi (Turso): begitu TURSO_AUTH_TOKEN diisi, dipakai driver adapter
 * libsql supaya bisa terhubung ke database jarak jauh. DATABASE_URL harus
 * diisi URL "libsql://..." pada mode ini. Dialeknya tetap SQLite yang sama,
 * jadi skema dan seluruh kueri Prisma tidak berubah sama sekali.
 */
function buatClient() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (authToken) {
    if (!url) throw new Error('TURSO_AUTH_TOKEN diisi tapi DATABASE_URL kosong. Isi dengan URL libsql://...')
    const adapter = new PrismaLibSql({ url, authToken })
    return new PrismaClient({ adapter, log: [...logLevels] })
  }

  return new PrismaClient({ log: [...logLevels] })
}

export const db = globalForPrisma.prisma ?? buatClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
