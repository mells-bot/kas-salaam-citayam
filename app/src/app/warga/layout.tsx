import { redirect } from 'next/navigation'
import { wajibLogin, isPengurus } from '@/lib/auth'
import { namaCluster } from '@/lib/setting'
import { Navigasi } from '@/components/navigasi'
import { Peringatan } from '@/components/ui'

export default async function LayoutWarga({ children }: { children: React.ReactNode }) {
  const sesi = await wajibLogin()
  // Pengurus punya area sendiri; mengarahkan ulang mencegah mereka melihat
  // tampilan warga tanpa unit dan bingung.
  if (isPengurus(sesi.role)) redirect('/pengurus')

  const cluster = await namaCluster()

  return (
    <div className="min-h-dvh">
      <Navigasi
        namaCluster={cluster}
        nama={sesi.nama}
        peran={`Warga · ${sesi.username}`}
        menu={[
          { href: '/warga', label: 'Status Iuran' },
          { href: '/warga/lapor', label: 'Lapor Bayar' },
          { href: '/warga/riwayat', label: 'Riwayat' },
          { href: '/warga/akun', label: 'Akun' },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-6">
        {sesi.unitId ? (
          children
        ) : (
          <Peringatan nada="kritis" judul="Akun belum terhubung ke unit rumah">
            Akun Anda belum dikaitkan dengan unit rumah mana pun, sehingga status iuran tidak dapat
            ditampilkan. Hubungi bendahara untuk memperbaiki data akun.
          </Peringatan>
        )}
      </main>
    </div>
  )
}
