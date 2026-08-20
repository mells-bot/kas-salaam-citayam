import { db } from '@/lib/db'
import { wajibPengurus } from '@/lib/auth'
import { daftarKaryawan } from '@/lib/gaji'
import { periodeSekarang } from '@/lib/periode'
import { JABATAN_LABEL, ROLES } from '@/lib/constants'
import { rupiah } from '@/lib/format'
import { Kartu, JudulSeksi, Kosong, Peringatan } from '@/components/ui'
import PanelKaryawan from './panel-karyawan'
import PanelKasbonGajian from './panel-kasbon-gajian'

export const metadata = { title: 'Karyawan & Gaji · Kas Cluster' }

export default async function HalamanKaryawan() {
  const sesi = await wajibPengurus()
  const bendahara = sesi.role === ROLES.BENDAHARA
  const periodeIni = periodeSekarang()

  const [karyawan, riwayatGajian] = await Promise.all([
    daftarKaryawan(periodeIni),
    db.gajian.findMany({
      orderBy: { tanggal: 'desc' },
      take: 15,
      include: { karyawan: { select: { nama: true } } },
    }),
  ])

  const totalGajiBulanan = karyawan.filter((k) => k.aktif).reduce((s, k) => s + k.gajiPokok, 0)
  const totalKasbonBeredar = karyawan.reduce((s, k) => s + k.totalKasbonBelumLunas, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Karyawan & gaji</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {karyawan.filter((k) => k.aktif).length} karyawan aktif · total gaji pokok{' '}
          <span className="tabular font-medium text-ink">{rupiah(totalGajiBulanan)}</span>/bulan
          {totalKasbonBeredar > 0 && (
            <>
              {' '}
              · kasbon beredar <span className="tabular font-medium text-kritis">{rupiah(totalKasbonBeredar)}</span>
            </>
          )}
        </p>
      </div>

      {!bendahara && (
        <Peringatan nada="info">
          Peran Ketua RT hanya dapat melihat data karyawan. Kasbon dan gajian dicatat oleh Bendahara.
        </Peringatan>
      )}

      {bendahara && (
        <Kartu>
          <JudulSeksi>Tambah karyawan</JudulSeksi>
          <PanelKaryawan mode="tambah" />
        </Kartu>
      )}

      {karyawan.length === 0 ? (
        <Kartu>
          <Kosong pesan="Belum ada data karyawan." />
        </Kartu>
      ) : (
        <div className="space-y-3">
          {karyawan.map((k) => (
            <Kartu key={k.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{k.nama}</span>
                    <span className="rounded-md bg-plane px-1.5 py-0.5 text-xs text-ink-2 ring-1 ring-inset ring-hairline">
                      {JABATAN_LABEL[k.jabatan] ?? k.jabatan}
                    </span>
                    {!k.aktif && (
                      <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-xs text-ink-muted">Nonaktif</span>
                    )}
                    {k.sudahDigajiBulanIni && (
                      <span className="rounded-md bg-[#0ca30c]/10 px-1.5 py-0.5 text-xs text-[#0a7c0a]">
                        Sudah digaji bulan ini
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-2">
                    Gaji pokok <span className="tabular font-medium text-ink">{rupiah(k.gajiPokok)}</span>/bulan
                    {k.totalKasbonBelumLunas > 0 && (
                      <>
                        {' '}
                        · kasbon belum lunas{' '}
                        <span className="tabular font-medium text-kritis">{rupiah(k.totalKasbonBelumLunas)}</span>
                      </>
                    )}
                  </p>
                </div>
                {bendahara && <PanelKaryawan mode="ubah" karyawan={k} />}
              </div>

              {bendahara && (
                <div className="mt-3 border-t border-grid pt-3">
                  <PanelKasbonGajian
                    karyawanId={k.id}
                    gajiPokok={k.gajiPokok}
                    totalKasbonBelumLunas={k.totalKasbonBelumLunas}
                    sudahDigajiBulanIni={k.sudahDigajiBulanIni}
                    periodeIni={periodeIni}
                  />
                </div>
              )}
            </Kartu>
          ))}
        </div>
      )}

      <Kartu>
        <JudulSeksi keterangan="15 gajian terakhir yang diproses.">Riwayat gajian</JudulSeksi>
        {riwayatGajian.length === 0 ? (
          <Kosong pesan="Belum ada gajian yang diproses." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-grid text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Karyawan</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Bulan</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Gaji pokok</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Potongan kasbon</th>
                  <th scope="col" className="py-2 text-right font-medium">Dibayar</th>
                </tr>
              </thead>
              <tbody>
                {riwayatGajian.map((g) => (
                  <tr key={g.id} className="border-b border-grid last:border-0">
                    <td className="py-2 pr-3">{g.karyawan.nama}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-ink-2">
                      {new Date(`${g.periode}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="tabular py-2 pr-3 text-right">{rupiah(g.gajiPokok)}</td>
                    <td className="tabular py-2 pr-3 text-right text-ink-2">
                      {g.totalPotongan > 0 ? rupiah(g.totalPotongan) : '—'}
                    </td>
                    <td className="tabular py-2 text-right font-medium">{rupiah(g.totalDibayar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kartu>
    </div>
  )
}
