import { wajibLogin } from '@/lib/auth'
import { daftarTagihanAktif, statusUnitUntukTagihan } from '@/lib/tambahan'
import { labelPeriode, rupiah } from '@/lib/format'
import { Kartu, JudulSeksi, Kosong, LencanaStatus } from '@/components/ui'
import FormLaporTambahan from './form-lapor-tambahan'

export const metadata = { title: 'Tagihan Tambahan · Kas Cluster' }

export default async function HalamanTambahanWarga() {
  const sesi = await wajibLogin()
  if (!sesi.unitId) return null

  const tagihanAktif = await daftarTagihanAktif()
  const dengannStatus = await Promise.all(
    tagihanAktif.map(async (t) => ({ tagihan: t, status: await statusUnitUntukTagihan(t.id, sesi.unitId!) })),
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Tagihan tambahan</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          THR dan tagihan sekali/berkala lain di luar iuran bulanan rutin.
        </p>
      </div>

      {dengannStatus.length === 0 ? (
        <Kartu>
          <Kosong pesan="Tidak ada tagihan tambahan yang aktif saat ini." />
        </Kartu>
      ) : (
        <div className="space-y-3">
          {dengannStatus.map(({ tagihan, status }) => (
            <Kartu key={tagihan.id}>
              <JudulSeksi keterangan={labelPeriode(tagihan.periode)}>{tagihan.nama}</JudulSeksi>

              {tagihan.keterangan && <p className="mb-3 text-sm text-ink-2">{tagihan.keterangan}</p>}

              <div className="mb-3 flex flex-wrap items-center gap-3">
                {status && <LencanaStatus status={status.status} />}
                <p className="text-sm text-ink-2">
                  {status ? (
                    <>
                      Sudah dibayar <span className="tabular font-medium text-ink">{rupiah(status.dibayar)}</span>{' '}
                      dari <span className="tabular font-medium text-ink">{rupiah(status.wajib)}</span>
                    </>
                  ) : (
                    `Total tagihan: ${rupiah(tagihan.nominalPerUnit)}`
                  )}
                </p>
              </div>

              {status && status.kurang > 0 ? (
                <FormLaporTambahan tagihanTambahanId={tagihan.id} kurang={status.kurang} />
              ) : (
                <p className="text-sm text-[--color-sukses-teks]">Sudah lunas. Terima kasih.</p>
              )}
            </Kartu>
          ))}
        </div>
      )}
    </div>
  )
}
