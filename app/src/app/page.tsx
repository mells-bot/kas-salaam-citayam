import { redirect } from 'next/navigation'
import { sesiSaatIni } from '@/lib/auth'
import { isPengurus } from '@/lib/auth'

/** Pintu masuk: arahkan ke area sesuai peran. */
export default async function Beranda() {
  const sesi = await sesiSaatIni()
  if (!sesi) redirect('/login')
  redirect(isPengurus(sesi.role) ? '/pengurus' : '/warga')
}
