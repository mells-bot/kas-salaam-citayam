'use client'

import { useMemo, useState } from 'react'
import { labelPeriode, rupiah } from '@/lib/format'
import { KELAS_INPUT, Label, Peringatan } from './ui'

/*
 * Pemilih alokasi periode iuran.
 *
 * Inilah pengganti kolom "Remark" bebas teks di Google Sheets. Warga memilih
 * bulan dan komponen mana yang dibayar, lalu sistem menyimpannya sebagai baris
 * terstruktur — sehingga status lunas bisa DIHITUNG, bukan ditafsirkan dari
 * kalimat seperti "NOVEMBER DESEMBER 2025".
 */

export interface BarisTertagih {
  periode: string
  kurangSampah: number
  kurangSecurity: number
  totalKurang: number
}

interface Pilihan {
  sampah: number
  security: number
}

export function PemilihAlokasi({
  tertagih,
  namaFieldNominal = 'nominal',
  nominalAwal,
}: {
  tertagih: BarisTertagih[]
  namaFieldNominal?: string
  nominalAwal?: number
}) {
  // Bawaan: bulan tertunggak paling lama dicentang lebih dulu. Membayar
  // tunggakan terlama duluan adalah perilaku yang hampir selalu diinginkan.
  const [pilihan, setPilihan] = useState<Record<string, Pilihan>>(() => {
    const awal: Record<string, Pilihan> = {}
    const pertama = tertagih[0]
    if (pertama) {
      awal[pertama.periode] = { sampah: pertama.kurangSampah, security: pertama.kurangSecurity }
    }
    return awal
  })
  const [nominalManual, setNominalManual] = useState<string>('')

  const alokasi = useMemo(
    () =>
      Object.entries(pilihan).flatMap(([periode, p]) =>
        [
          { periode, jenisIuran: 'SAMPAH', nominal: p.sampah },
          { periode, jenisIuran: 'SECURITY', nominal: p.security },
        ].filter((a) => a.nominal > 0),
      ),
    [pilihan],
  )

  const totalAlokasi = alokasi.reduce((s, a) => s + a.nominal, 0)
  // Nominal mengikuti total alokasi kecuali warga menimpanya secara sadar,
  // supaya kasus umum (bayar pas) tidak perlu mengetik angka dua kali.
  const nominalEfektif = nominalManual === '' ? totalAlokasi : Number(nominalManual) || 0
  const selisih = nominalEfektif - totalAlokasi

  function ubah(periode: string, jenis: keyof Pilihan, nilai: number, maks: number) {
    setPilihan((p) => {
      const kini = p[periode] ?? { sampah: 0, security: 0 }
      const baru = { ...kini, [jenis]: Math.max(0, Math.min(nilai, maks)) }
      const next = { ...p, [periode]: baru }
      if (baru.sampah === 0 && baru.security === 0) delete next[periode]
      return next
    })
  }

  function togglePeriode(b: BarisTertagih, aktif: boolean) {
    setPilihan((p) => {
      const next = { ...p }
      if (aktif) next[b.periode] = { sampah: b.kurangSampah, security: b.kurangSecurity }
      else delete next[b.periode]
      return next
    })
  }

  if (tertagih.length === 0) {
    return (
      <Peringatan nada="info" judul="Tidak ada tagihan tertunggak">
        Seluruh iuran unit ini sudah lunas sampai bulan berjalan. Bila Anda ingin membayar di muka untuk
        bulan berikutnya, hubungi bendahara agar periodenya dibuka.
      </Peringatan>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label wajib>Bulan yang dibayar</Label>
        <p className="mb-2 text-xs text-ink-2">
          Centang bulan yang Anda bayar. Nominal per komponen bisa disesuaikan bila Anda hanya membayar
          sebagian.
        </p>

        <div className="space-y-2">
          {tertagih.map((b) => {
            const aktif = Boolean(pilihan[b.periode])
            const p = pilihan[b.periode] ?? { sampah: 0, security: 0 }
            return (
              <div
                key={b.periode}
                className={`rounded-lg border p-3 transition-colors ${
                  aktif ? 'border-[#2a78d6] bg-[#2a78d6]/4' : 'border-baseline bg-white'
                }`}
              >
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={aktif}
                    onChange={(e) => togglePeriode(b, e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-[#2a78d6]"
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink">{labelPeriode(b.periode)}</span>
                  <span className="tabular text-xs text-ink-2">kurang {rupiah(b.totalKurang)}</span>
                </label>

                {aktif && (
                  <div className="mt-3 grid gap-2 pl-[26px] sm:grid-cols-2">
                    {b.kurangSampah > 0 && (
                      <div>
                        <label className="mb-1 block text-xs text-ink-2">
                          Sampah <span className="text-ink-muted">(maks {rupiah(b.kurangSampah)})</span>
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={b.kurangSampah}
                          value={p.sampah || ''}
                          onChange={(e) => ubah(b.periode, 'sampah', Number(e.target.value), b.kurangSampah)}
                          className={`${KELAS_INPUT} tabular py-1.5`}
                        />
                      </div>
                    )}
                    {b.kurangSecurity > 0 && (
                      <div>
                        <label className="mb-1 block text-xs text-ink-2">
                          Security <span className="text-ink-muted">(maks {rupiah(b.kurangSecurity)})</span>
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={b.kurangSecurity}
                          value={p.security || ''}
                          onChange={(e) => ubah(b.periode, 'security', Number(e.target.value), b.kurangSecurity)}
                          className={`${KELAS_INPUT} tabular py-1.5`}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Alokasi dikirim sebagai field tersembunyi supaya server memvalidasi ulang
          angka yang sama persis dengan yang dilihat pengguna. */}
      {alokasi.map((a, i) => (
        <div key={`${a.periode}-${a.jenisIuran}`}>
          <input type="hidden" name={`alokasi[${i}][periode]`} value={a.periode} />
          <input type="hidden" name={`alokasi[${i}][jenisIuran]`} value={a.jenisIuran} />
          <input type="hidden" name={`alokasi[${i}][nominal]`} value={a.nominal} />
        </div>
      ))}

      <div>
        <Label wajib>Nominal yang ditransfer</Label>
        <input
          type="number"
          name={namaFieldNominal}
          inputMode="numeric"
          min={1}
          required
          value={nominalManual === '' ? (nominalAwal ?? totalAlokasi) || '' : nominalManual}
          onChange={(e) => setNominalManual(e.target.value)}
          className={`${KELAS_INPUT} tabular`}
        />
        <div className="mt-2 space-y-1.5 rounded-lg bg-plane px-3 py-2 text-xs">
          <p className="flex justify-between">
            <span className="text-ink-2">Total dialokasikan ke bulan terpilih</span>
            <span className="tabular font-semibold text-ink">{rupiah(totalAlokasi)}</span>
          </p>
          {selisih !== 0 && (
            <p className="flex justify-between">
              <span className="text-ink-2">{selisih > 0 ? 'Belum dialokasikan' : 'Kelebihan alokasi'}</span>
              <span className={`tabular font-semibold ${selisih > 0 ? 'text-[#8a5d00]' : 'text-kritis'}`}>
                {rupiah(Math.abs(selisih))}
              </span>
            </p>
          )}
        </div>

        {selisih < 0 && (
          <div className="mt-2">
            <Peringatan nada="kritis">
              Total alokasi melebihi nominal yang ditransfer. Kurangi alokasi atau perbaiki nominalnya.
            </Peringatan>
          </div>
        )}
        {selisih > 0 && (
          <div className="mt-2">
            <Peringatan nada="ingat">
              Ada {rupiah(selisih)} yang belum ditandai untuk bulan tertentu. Uangnya tetap tercatat masuk,
              tetapi tidak mengurangi tunggakan bulan mana pun sampai bendahara mengalokasikannya.
            </Peringatan>
          </div>
        )}
      </div>
    </div>
  )
}
