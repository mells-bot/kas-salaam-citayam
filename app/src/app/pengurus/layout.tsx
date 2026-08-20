import { wajibPengurus } from '@/lib/auth'
import { db } from '@/lib/db'
import { namaCluster } from '@/lib/setting'
import { ROLES, STATUS } from '@/lib/constants'
import { Navigasi } from '@/components/navigasi'

export default async function LayoutPengurus({ children }: { children: React.ReactNode }) {
  const sesi = await wajibPengurus()

  const [cluster, menunggu] = await Promise.all([
    namaCluster(),
    db.transaction.count({ where: { status: STATUS.PENDING, dibatalkanPada: null } }),
  ])

  const bendahara = sesi.role === ROLES.BENDAHARA

  return (
    <div className="min-h-dvh">
      <Navigasi
        namaCluster={cluster}
        nama={sesi.nama}
        peran={bendahara ? 'Bendahara' : 'Ketua RT'}
        menu={[
          { href: '/pengurus', label: 'Dashboard' },
          { href: '/pengurus/verifikasi', label: 'Verifikasi', lencana: menunggu },
          { href: '/pengurus/tunggakan', label: 'Tunggakan' },
          { href: '/pengurus/tambahan', label: 'Tagihan Tambahan' },
          { href: '/pengurus/ledger', label: 'Buku Kas' },
          { href: '/pengurus/karyawan', label: 'Karyawan' },
          { href: '/pengurus/laporan', label: 'Laporan' },
          { href: '/pengurus/warga', label: 'Data Warga' },
          { href: '/pengurus/audit', label: 'Audit' },
          ...(bendahara ? [{ href: '/pengurus/pengaturan', label: 'Pengaturan' }] : []),
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-6">{children}</main>
    </div>
  )
}
