import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import { PrismaLibSql } from '@prisma/adapter-libsql'

/**
 * Konfigurasi Prisma CLI (db push, migrate, studio).
 *
 * Begitu file prisma.config.ts ini ada, Prisma CLI BERHENTI memuat `.env`
 * secara otomatis ("Prisma config detected, skipping environment variable
 * loading") — jadi `.env` dimuat manual lewat `dotenv/config` di baris atas.
 * Tanpa ini, `DATABASE_URL` tidak ditemukan sama sekali saat development
 * lokal meski file `.env` ada dan isinya benar.
 *
 * Lokal: TURSO_DATABASE_URL kosong, jadi mesin skema "classic" bawaan dipakai
 * -> CLI membaca file SQLite langsung lewat DATABASE_URL="file:...".
 *
 * Turso/produksi: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN diisi -> CLI memakai
 * mesin skema berbasis JS lewat driver adapter libsql yang sama dengan
 * runtime aplikasi di src/lib/db.ts, supaya `prisma db push` bisa menerapkan
 * skema ke database Turso jarak jauh. Lihat komentar di src/lib/db.ts untuk
 * alasan kedua variabel ini terpisah dari DATABASE_URL.
 *
 * `engine` dan `adapter` harus selalu ditulis bersamaan (union diskriminatif
 * pada tipe PrismaConfig) — karena itu ditulis sebagai dua defineConfig utuh,
 * bukan digabung lewat spread kondisional.
 */
const tursoUrl = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

export default tursoUrl && authToken
  ? defineConfig({
      schema: 'prisma/schema.prisma',
      experimental: { adapter: true },
      engine: 'js',
      adapter: async () => new PrismaLibSql({ url: tursoUrl, authToken }),
    })
  : defineConfig({
      schema: 'prisma/schema.prisma',
    })
