import { db } from '@/lib/db'
import { wajibPengurus } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { labelPeriode, rupiah } from '@/lib/format'
import { periodeSekarang } from '@/lib/periode'
import { Kartu, JudulSeksi, Kosong, Peringatan } from '@/components/ui'
import PanelWarga from './panel-warga'

export const metadata = { title: 'Data Warga · Kas Cluster' }

export default async function HalamanWarga() {
  const sesi = await wajibPengurus()
  const bendahara = sesi.role === ROLES.BENDAHARA

  const units = await db.unit.findMany({
    orderBy: [{ aktif: 'desc' }, { urutan: 'asc' }, { kode: 'asc' }],
    include: {
      users: { where: { role: 'WARGA' }, select: { id: true, username: true, aktif: true } },
      _count: { select: { transactions: true } },
    },
  })

  const aktif = units.filter((u) => u.aktif)
  const totalTagihanBulanan = aktif.reduce((s, u) => s + u.tarifSampah + u.tarifSecurity, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Data warga</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {aktif.length} unit aktif dari {units.length} terdaftar · potensi iuran{' '}
          <span className="tabular font-medium text-ink">{rupiah(totalTagihanBulanan)}</span>/bulan
        </p>
      </div>

      {!bendahara && (
        <Peringatan nada="info">
          Peran Ketua RT hanya dapat melihat data warga. Perubahan data dilakukan oleh Bendahara.
        </Peringatan>
      )}

      {bendahara && <PanelWarga mode="tambah" />}

      <Kartu padat>
        <JudulSeksi keterangan="Tarif diatur per unit, sehingga pengecualian seperti unit yang tidak ditagih sampah bisa dimodelkan tanpa mengakali data transaksi.">
          Daftar unit
        </JudulSeksi>

        {units.length === 0 ? (
          <Kosong pesan="Belum ada unit terdaftar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-grid text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 pr-3 pl-1 font-medium">Unit</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Nama warga</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Kontak</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Sampah</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Security</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Sejak</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Transaksi</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  {bendahara && <th scope="col" className="py-2 pl-1 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id} className="border-b border-grid align-top last:border-0 hover:bg-plane">
                    <td className="tabular py-2 pr-3 pl-1 font-medium whitespace-nowrap">{u.kode}</td>
                    <td className="py-2 pr-3">
                      <span className="block max-w-[13rem] truncate">{u.namaWarga}</span>
                      <span className="block text-xs text-ink-muted">
                        Blok {u.blok} No. {u.nomor}
                      </span>
                      {u.catatan && (
                        <span className="mt-1 block max-w-[16rem] text-xs text-[#8a5d00]">{u.catatan}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-ink-2">
                      {u.kontak || <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-ink-2">
                      {u.tarifSampah === 0 ? <span className="text-ink-muted">tidak ditagih</span> : rupiah(u.tarifSampah)}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-ink-2">
                      {u.tarifSecurity === 0 ? (
                        <span className="text-ink-muted">tidak ditagih</span>
                      ) : (
                        rupiah(u.tarifSecurity)
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-ink-2">{labelPeriode(u.mulaiPeriode)}</td>
                    <td className="tabular py-2 pr-3 text-right text-ink-2">{u._count.transactions}</td>
                    <td className="py-2 pr-3">
                      {u.aktif ? (
                        <span className="text-xs text-[#0a7c0a]">Aktif</span>
                      ) : (
                        <span className="text-xs text-ink-muted">Nonaktif</span>
                      )}
                      {u.users.length === 0 && (
                        <span className="block text-xs text-kritis">tanpa akun login</span>
                      )}
                    </td>
                    {bendahara && (
                      <td className="py-2 pl-1">
                        <PanelWarga
                          mode="ubah"
                          unit={{
                            id: u.id,
                            kode: u.kode,
                            blok: u.blok,
                            nomor: u.nomor,
                            namaWarga: u.namaWarga,
                            urutan: u.urutan,
                            kontak: u.kontak ?? '',
                            tarifSampah: u.tarifSampah,
                            tarifSecurity: u.tarifSecurity,
                            mulaiPeriode: u.mulaiPeriode,
                            aktif: u.aktif,
                            catatan: u.catatan ?? '',
                          }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kartu>

      <p className="text-xs leading-relaxed text-ink-muted">
        Unit tidak bisa dihapus, hanya dinonaktifkan — riwayat transaksinya harus tetap utuh untuk keperluan
        audit (NF-04). Unit nonaktif tidak lagi dihitung dalam tunggakan bulan-bulan berikutnya. Bulan berjalan
        saat ini: {labelPeriode(periodeSekarang())}.
      </p>
    </div>
  )
}
