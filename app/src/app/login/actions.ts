'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { buatSesi, cocokPin, hapusSesi, isPengurus } from '@/lib/auth'
import { catatAudit } from '@/lib/audit'
import { loginSchema } from '@/lib/validasi'
import type { Role } from '@/lib/constants'

export interface HasilLogin {
  galat?: string
}

export async function aksiLogin(_prev: HasilLogin | null, formData: FormData): Promise<HasilLogin> {
  const parsed = loginSchema.safeParse({
    username: formData.get('username'),
    pin: formData.get('pin'),
  })
  if (!parsed.success) {
    return { galat: parsed.error.issues[0].message }
  }

  const { username, pin } = parsed.data

  // Kode unit sering diketik dengan huruf kecil di HP, sementara SQLite
  // membandingkan huruf secara peka besar/kecil.
  //
  // Mencoba varian uppercase/lowercase saja TIDAK cukup: kode unit asli ada yang
  // bercampur huruf besar-kecil ("B1a"), yang tidak sama dengan "B1A" maupun
  // "b1a". Jadi pencocokan dilakukan lewat LOWER() di database.
  const cocokId = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(username) = LOWER(${username}) LIMIT 1
  `
  const kandidat = cocokId[0]
    ? await db.user.findUnique({
        where: { id: cocokId[0].id },
        select: { id: true, username: true, nama: true, pinHash: true, role: true, unitId: true, aktif: true },
      })
    : null

  // Pesan galat disengaja seragam: tidak membocorkan apakah kode unit terdaftar.
  const GALAT_UMUM = 'Kode unit / username atau PIN salah.'

  if (!kandidat) return { galat: GALAT_UMUM }
  if (!kandidat.aktif) return { galat: 'Akun ini sudah dinonaktifkan. Hubungi bendahara.' }

  const cocok = await cocokPin(pin, kandidat.pinHash)
  if (!cocok) {
    await catatAudit({
      aktor: null,
      aksi: 'LOGIN_GAGAL',
      entitas: 'User',
      entitasId: kandidat.id,
      ringkasan: `Percobaan login gagal untuk ${kandidat.username}`,
    })
    return { galat: GALAT_UMUM }
  }

  const sesi = {
    userId: kandidat.id,
    username: kandidat.username,
    nama: kandidat.nama,
    role: kandidat.role as Role,
    unitId: kandidat.unitId,
  }
  await buatSesi(sesi)
  await catatAudit({
    aktor: sesi,
    aksi: 'LOGIN',
    entitas: 'User',
    entitasId: kandidat.id,
    ringkasan: `${kandidat.nama} masuk ke sistem`,
  })

  redirect(isPengurus(sesi.role) ? '/pengurus' : '/warga')
}

export async function aksiLogout() {
  await hapusSesi()
  redirect('/login')
}
