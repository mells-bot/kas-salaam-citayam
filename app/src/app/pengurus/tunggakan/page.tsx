import { kartuIuranSemuaUnit } from '@/lib/iuran'
import { periodeSekarang, tambahBulan } from '@/lib/periode'
import { labelPeriode, labelPeriodeSingkat, rupiah } from '@/lib/format'
import { Kartu, JudulSeksi, Kosong, LencanaStatus, Peringatan } from '@/components/ui'

export const metadata = { title: 'Matriks Tunggakan · Kas Cluster' }

const JUMLAH_BULAN_TAMPIL = 12

/** Matriks status lunas/tunggak seluruh unit per bulan dalam satu tampilan (F-08). */
export default async function HalamanTunggakan() {
  const periodeIni = periodeSekarang()
  const kartu = await kartuIuranSemuaUnit(periodeIni)

  if (kartu.length === 0) {
    return (
      <Kartu>
        <Kosong pesan="Belum ada unit terdaftar. Tambahkan data warga terlebih dahulu." />
      </Kartu>
    )
  }

  // Jendela 12 bulan terakhir, tapi tidak melewati bulan pertama unit tertagih.
  const periodeAwalSemua = kartu.reduce(
    (min, k) => (k.baris[0] && k.baris[0].periode < min ? k.baris[0].periode : min),
    periodeIni,
  )
  const mulaiJendela = [tambahBulan(periodeIni, -(JUMLAH_BULAN_TAMPIL - 1)), periodeAwalSemua].sort().at(-1)!
  const kolom: string[] = []
  for (let p = mulaiJendela; p <= periodeIni; p = tambahBulan(p, 1)) kolom.push(p)

  const totalTunggakan = kartu.reduce((s, k) => s + k.totalTunggakan, 0)
  const unitMenunggak = kartu.filter((k) => k.totalTunggakan > 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-ink">Matriks tunggakan</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            {kartu.length} unit aktif · {unitMenunggak.length} punya tunggakan · total{' '}
            <span className="tabular font-medium text-kritis">{rupiah(totalTunggakan)}</span>
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-3 text-xs">
          {(['LUNAS', 'SEBAGIAN', 'BELUM'] as const).map((s) => (
            <LencanaStatus key={s} status={s} />
          ))}
        </div>
      </div>

      <Peringatan nada="info">
        Sampah dan security dihitung <strong>terpisah</strong>. Sebuah bulan hanya berstatus lunas bila kedua
        komponennya terpenuhi — jadi kelebihan bayar security tidak bisa menutupi kekurangan sampah.
      </Peringatan>

      <Kartu padat>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Status iuran per unit per bulan, {labelPeriode(mulaiJendela)} sampai {labelPeriode(periodeIni)}
            </caption>
            <thead>
              <tr className="text-xs text-ink-muted">
                <th
                  scope="col"
                  className="sticky left-0 z-10 border-b border-grid bg-surface py-2 pr-3 pl-1 text-left font-medium"
                >
                  Unit
                </th>
                {kolom.map((p) => (
                  <th
                    key={p}
                    scope="col"
                    className={`border-b border-grid px-1 py-2 text-center font-medium whitespace-nowrap ${
                      p === periodeIni ? 'text-[#1c5cab]' : ''
                    }`}
                  >
                    {labelPeriodeSingkat(p)}
                  </th>
                ))}
                <th scope="col" className="border-b border-grid py-2 pr-1 pl-3 text-right font-medium">
                  Tunggakan
                </th>
              </tr>
            </thead>
            <tbody>
              {kartu.map((k) => (
                <tr key={k.unitId} className="hover:bg-plane">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-grid bg-surface py-1.5 pr-3 pl-1 text-left font-normal"
                  >
                    <span className="tabular block font-medium text-ink">{k.kode}</span>
                    <span className="block max-w-[9rem] truncate text-xs text-ink-muted">{k.namaWarga}</span>
                  </th>

                  {kolom.map((p) => {
                    const b = k.baris.find((x) => x.periode === p)
                    return (
                      <td key={p} className="border-b border-grid px-1 py-1.5 text-center">
                        {b ? (
                          <span
                            title={
                              b.totalKurang > 0
                                ? `${labelPeriode(p)}: kurang ${rupiah(b.totalKurang)}`
                                : `${labelPeriode(p)}: lunas`
                            }
                          >
                            <LencanaStatus status={b.status} ringkas />
                          </span>
                        ) : (
                          <span className="text-ink-muted" title="Belum ditagih pada periode ini">
                            ·
                          </span>
                        )}
                      </td>
                    )
                  })}

                  <td className="tabular border-b border-grid py-1.5 pr-1 pl-3 text-right whitespace-nowrap">
                    {k.totalTunggakan > 0 ? (
                      <span className="font-medium text-kritis">{rupiah(k.totalTunggakan)}</span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="sticky left-0 bg-surface py-2 pr-3 pl-1 text-left text-xs font-medium">
                  Total
                </th>
                {kolom.map((p) => {
                  const kurang = kartu.reduce(
                    (s, k) => s + (k.baris.find((x) => x.periode === p)?.totalKurang ?? 0),
                    0,
                  )
                  return (
                    <td key={p} className="tabular px-1 py-2 text-center text-[10px] text-ink-2">
                      {kurang > 0 ? rupiah(kurang).replace('Rp', '') : '—'}
                    </td>
                  )
                })}
                <td className="tabular py-2 pr-1 pl-3 text-right text-xs font-semibold text-kritis">
                  {rupiah(totalTunggakan)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Kartu>

      {unitMenunggak.length > 0 && (
        <Kartu>
          <JudulSeksi keterangan="Daftar siap dipakai untuk menagih, diurutkan dari tunggakan terbesar.">
            Rincian penunggak
          </JudulSeksi>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-grid text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Unit</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Nama warga</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Bulan belum lunas</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Bulan tertua</th>
                  <th scope="col" className="py-2 text-right font-medium">Total tunggakan</th>
                </tr>
              </thead>
              <tbody>
                {[...unitMenunggak]
                  .sort((a, b) => b.totalTunggakan - a.totalTunggakan)
                  .map((k) => {
                    const tertua = k.baris.find((b) => b.totalKurang > 0)
                    return (
                      <tr key={k.unitId} className="border-b border-grid last:border-0">
                        <td className="tabular py-2 pr-3 font-medium">{k.kode}</td>
                        <td className="py-2 pr-3 text-ink-2">{k.namaWarga}</td>
                        <td className="tabular py-2 pr-3 text-right text-ink-2">{k.jumlahBulanTunggak}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-ink-2">
                          {tertua ? labelPeriode(tertua.periode) : '—'}
                        </td>
                        <td className="tabular py-2 text-right font-medium text-kritis">
                          {rupiah(k.totalTunggakan)}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Kartu>
      )}
    </div>
  )
}
