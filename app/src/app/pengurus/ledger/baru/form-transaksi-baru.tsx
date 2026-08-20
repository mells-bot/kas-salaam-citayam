'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  aksiCatatIuranAtasNamaWarga,
  aksiCatatPemasukanLain,
  aksiCatatPengeluaran,
  type HasilAksi,
} from '../../actions'
import { PemilihAlokasi, type BarisTertagih } from '@/components/form-alokasi'
import { UnggahBukti } from '@/components/unggah-bukti'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

interface UnitPilihan {
  id: string
  kode: string
  namaWarga: string
  tertagih: BarisTertagih[]
}

type Tab = 'PENGELUARAN' | 'IURAN' | 'LAIN'

function Kirim({ label, nonaktif = false }: { label: string; nonaktif?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending || nonaktif} className="w-full">
      {pending ? 'Menyimpan…' : label}
    </Tombol>
  )
}

function tanggalHariIni() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FormTransaksiBaru({ unit, kategori }: { unit: UnitPilihan[]; kategori: string[] }) {
  const [tab, setTab] = useState<Tab>('PENGELUARAN')

  const [hasilKeluar, aksiKeluar] = useActionState<HasilAksi | null, FormData>(aksiCatatPengeluaran, null)
  const [hasilIuran, aksiIuran] = useActionState<HasilAksi | null, FormData>(aksiCatatIuranAtasNamaWarga, null)
  const [hasilLain, aksiLain] = useActionState<HasilAksi | null, FormData>(aksiCatatPemasukanLain, null)

  const [unitTerpilih, setUnitTerpilih] = useState<string>('')
  const dipilih = unit.find((u) => u.id === unitTerpilih)

  const hariIni = tanggalHariIni()
  const hasil = tab === 'PENGELUARAN' ? hasilKeluar : tab === 'IURAN' ? hasilIuran : hasilLain

  const tabs: { key: Tab; label: string }[] = [
    { key: 'PENGELUARAN', label: 'Pengeluaran' },
    { key: 'IURAN', label: 'Iuran warga' },
    { key: 'LAIN', label: 'Pemasukan lain' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg bg-plane p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}
      {hasil?.ok && <Peringatan nada="info">{hasil.pesan}</Peringatan>}

      {/* --- Pengeluaran (F-05) --- */}
      {tab === 'PENGELUARAN' && (
        <form action={aksiKeluar} className="space-y-4" key="form-keluar">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label wajib>Tanggal</Label>
              <input type="date" name="tanggal" required defaultValue={hariIni} max={hariIni} className={KELAS_INPUT} />
            </div>
            <div>
              <Label wajib>Nominal</Label>
              <input type="number" name="nominal" required min={1} inputMode="numeric" className={`${KELAS_INPUT} tabular`} />
            </div>
          </div>

          <div>
            <Label wajib>Uraian</Label>
            <input
              name="uraian"
              required
              minLength={3}
              maxLength={300}
              placeholder="Contoh: Honor security Agustus 2026"
              className={KELAS_INPUT}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label wajib>Kategori</Label>
              <select name="kategori" required defaultValue={kategori[0] ?? ''} className={KELAS_INPUT}>
                {kategori.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-muted">
                Kelola daftar kategori lewat menu Pengaturan.
              </p>
            </div>
            <div>
              <Label wajib>Metode</Label>
              <select name="metode" required defaultValue="TRANSFER" className={KELAS_INPUT}>
                <option value="TRANSFER">Transfer bank</option>
                <option value="TUNAI">Tunai</option>
              </select>
            </div>
          </div>

          <UnggahBukti />

          <div>
            <Label>Catatan (opsional)</Label>
            <textarea name="remark" rows={2} maxLength={500} className={KELAS_INPUT} />
          </div>

          <Kirim label="Catat pengeluaran" />
        </form>
      )}

      {/* --- Iuran atas nama warga --- */}
      {tab === 'IURAN' && (
        <form action={aksiIuran} className="space-y-4" key="form-iuran">
          <Peringatan nada="info">
            Gunakan ini bila warga membayar lewat WhatsApp atau tunai dan tidak melapor sendiri lewat aplikasi.
            Transaksi langsung disetujui karena Anda sendiri yang mencatatnya.
          </Peringatan>

          <div>
            <Label wajib>Unit warga</Label>
            <select
              name="unitId"
              required
              value={unitTerpilih}
              onChange={(e) => setUnitTerpilih(e.target.value)}
              className={KELAS_INPUT}
            >
              <option value="">— pilih unit —</option>
              {unit.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.kode} — {u.namaWarga}
                  {u.tertagih.length > 0 ? ` (${u.tertagih.length} bulan belum lunas)` : ' (lunas)'}
                </option>
              ))}
            </select>
          </div>

          {dipilih ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label wajib>Tanggal bayar</Label>
                  <input type="date" name="tanggal" required defaultValue={hariIni} max={hariIni} className={KELAS_INPUT} />
                </div>
                <div>
                  <Label wajib>Metode</Label>
                  <select name="metode" required defaultValue="TRANSFER" className={KELAS_INPUT}>
                    <option value="TRANSFER">Transfer bank</option>
                    <option value="TUNAI">Tunai</option>
                  </select>
                </div>
              </div>

              {/* key memaksa pemilih di-reset saat unit berganti, agar alokasi
                  tidak terbawa dari unit sebelumnya. */}
              <PemilihAlokasi key={dipilih.id} tertagih={dipilih.tertagih} />

              <UnggahBukti />

              <div>
                <Label>Catatan (opsional)</Label>
                <textarea
                  name="remark"
                  rows={2}
                  maxLength={500}
                  placeholder="Contoh: dibayar tunai ke bendahara, rapel dua bulan"
                  className={KELAS_INPUT}
                />
              </div>

              <Kirim label="Catat iuran warga" nonaktif={dipilih.tertagih.length === 0} />
            </>
          ) : (
            <p className="text-sm text-ink-muted">Pilih unit terlebih dahulu untuk melihat bulan yang tertagih.</p>
          )}
        </form>
      )}

      {/* --- Pemasukan non-iuran --- */}
      {tab === 'LAIN' && (
        <form action={aksiLain} className="space-y-4" key="form-lain">
          <Peringatan nada="info">
            Untuk pemasukan yang bukan iuran bulanan: donasi, bunga bank, sisa dana kegiatan. Tidak dikaitkan ke
            periode iuran mana pun, jadi tidak mengubah status lunas warga.
          </Peringatan>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label wajib>Tanggal</Label>
              <input type="date" name="tanggal" required defaultValue={hariIni} max={hariIni} className={KELAS_INPUT} />
            </div>
            <div>
              <Label wajib>Nominal</Label>
              <input type="number" name="nominal" required min={1} inputMode="numeric" className={`${KELAS_INPUT} tabular`} />
            </div>
          </div>

          <div>
            <Label wajib>Uraian</Label>
            <input
              name="uraian"
              required
              minLength={3}
              maxLength={300}
              placeholder="Contoh: Donasi warga untuk perbaikan pos jaga"
              className={KELAS_INPUT}
            />
          </div>

          <div>
            <Label wajib>Metode</Label>
            <select name="metode" required defaultValue="TRANSFER" className={KELAS_INPUT}>
              <option value="TRANSFER">Transfer bank</option>
              <option value="TUNAI">Tunai</option>
            </select>
          </div>

          <div>
            <Label>Catatan (opsional)</Label>
            <textarea name="remark" rows={2} maxLength={500} className={KELAS_INPUT} />
          </div>

          <Kirim label="Catat pemasukan" />
        </form>
      )}
    </div>
  )
}
