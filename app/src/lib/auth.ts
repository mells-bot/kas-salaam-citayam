import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { PENGURUS, ROLES, type Role } from './constants'

const COOKIE = 'kas_session'
const MASA_AKTIF_HARI = 30

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET belum diatur atau kurang dari 32 karakter. Lihat .env.example')
  }
  return new TextEncoder().encode(s)
}

export interface Sesi {
  userId: string
  username: string
  nama: string
  role: Role
  unitId: string | null
}

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, 10)
}

export async function cocokPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash)
}

export async function buatSesi(sesi: Sesi) {
  const token = await new SignJWT({ ...sesi })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MASA_AKTIF_HARI}d`)
    .sign(secret())

  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MASA_AKTIF_HARI * 24 * 60 * 60,
  })
}

export async function hapusSesi() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

/// Mengembalikan sesi aktif atau null. Tidak melempar, aman dipakai di layout.
export async function sesiSaatIni(): Promise<Sesi | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    const sesi = payload as unknown as Sesi
    if (!sesi.userId) return null

    // Verifikasi ulang ke database: akun yang dinonaktifkan harus langsung
    // kehilangan akses meski cookie-nya masih berlaku.
    const user = await db.user.findUnique({
      where: { id: sesi.userId },
      select: { id: true, username: true, nama: true, role: true, unitId: true, aktif: true },
    })
    if (!user || !user.aktif) return null

    return {
      userId: user.id,
      username: user.username,
      nama: user.nama,
      role: user.role as Role,
      unitId: user.unitId,
    }
  } catch {
    return null
  }
}

/// Wajib login. Mengalihkan ke /login bila tidak ada sesi.
export async function wajibLogin(): Promise<Sesi> {
  const sesi = await sesiSaatIni()
  if (!sesi) redirect('/login')
  return sesi
}

/// Wajib peran pengurus (bendahara/ketua). Melindungi seluruh area admin (NF-01).
export async function wajibPengurus(): Promise<Sesi> {
  const sesi = await wajibLogin()
  if (!PENGURUS.includes(sesi.role)) redirect('/warga')
  return sesi
}

/// Wajib bendahara — aksi tulis seperti input pengeluaran & kelola master warga.
/// Ketua RT sengaja hanya bisa melihat (PRD bag. 6.1).
export async function wajibBendahara(): Promise<Sesi> {
  const sesi = await wajibLogin()
  if (sesi.role !== ROLES.BENDAHARA) {
    throw new Error('Aksi ini hanya untuk Bendahara.')
  }
  return sesi
}

export function isPengurus(role: Role) {
  return PENGURUS.includes(role)
}
