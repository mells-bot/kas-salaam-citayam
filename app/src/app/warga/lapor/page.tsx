import { wajibLogin } from '@/lib/auth'
import { db } from '@/lib/db'
import { periodeBelumLunas } from '@/lib/iuran'
import { STATUS } from '@/lib/constants'
import { Kartu, Peringatan } from '@/components/ui'
import FormLapor from './form-lapor'

export const metadata = { title: 'Lapor Pembayaran · Kas Cluster' }

export default async function HalamanLapor() {
  const sesi = await wajibLogin()
  if (!sesi.unitId) return null

  const [tertagih, unit, menunggu] = await Promise.all([
    periodeBelumLunas(sesi.unitId),
    db.unit.findUnique({ where: { id: sesi.unitId }, select: { kode: true, namaWarga: true } }),
    db.transaction.count({ where: { unitId: sesi.unitId, status: STATUS.PENDING, dibatalkanPada: null } }),
  ])

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Lapor pembayaran</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          Unit {unit?.kode} · {unit?.namaWarga}
        </p>
      </div>

      {menunggu > 0 && (
        <Peringatan nada="ingat">
          Anda masih punya <strong>{menunggu} laporan</strong> yang menunggu verifikasi. Pastikan Anda tidak
          melaporkan pembayaran yang sama dua kali.
        </Peringatan>
      )}

      <Kartu>
        <FormLapor tertagih={tertagih} />
      </Kartu>

      <p className="text-xs leading-relaxed text-ink-muted">
        Laporan Anda akan berstatus <strong>Menunggu verifikasi</strong> sampai bendahara memeriksanya. Status
        lunas Anda baru berubah setelah laporan disetujui.
      </p>
    </div>
  )
}
