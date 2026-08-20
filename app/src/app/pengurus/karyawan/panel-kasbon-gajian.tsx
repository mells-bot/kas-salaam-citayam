'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiCatatKasbon, aksiProsesGajian, type HasilAksi } from './actions'
import { rupiah } from '@/lib/format'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

type Tab = 'GAJIAN' | 'KASBON'

function tanggalHariIni() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Kirim({ label, nonaktif = false }: { label: string; nonaktif?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending || nonaktif}>
      {pending ? 'Memproses…' : label}
    </Tombol>
  )
}

function FormGajian({
  karyawanId,
  gajiPokok,
  totalKasbonBelumLunas,
  sudahDigajiBulanIni,
  periodeIni,
}: {
  karyawanId: string
  gajiPokok: number
  totalKasbonBelumLunas: number
  sudahDigajiBulanIni: boolean
  periodeIni: string
}) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiProsesGajian, null)
  const saran = Math.min(gajiPokok, totalKasbonBelumLunas)
  const [potongan, setPotongan] = useState(saran)
  const totalDibayar = Math.max(0, gajiPokok - potongan)

  if (sudahDigajiBulanIni && !hasil?.ok) {
    return (
      <Peringatan nada="info">
        Karyawan ini sudah digaji untuk bulan berjalan. Riwayat gajian ada di tabel di bawah.
      </Peringatan>
    )
  }

  if (hasil?.ok) {
    return <Peringatan nada="info">{hasil.pesan}</Peringatan>
  }

  return (
    <form action={aksi} className="space-y-3">
      <input type="hidden" name="karyawanId" value={karyawanId} />
      <input type="hidden" name="periode" value={periodeIni} />
      <input type="hidden" name="gajiPokok" value={gajiPokok} />

      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label wajib>Tanggal bayar</Label>
          <input type="date" name="tanggal" required defaultValue={tanggalHariIni()} className={KELAS_INPUT} />
        </div>
        <div>
          <Label>Gaji pokok</Label>
          <p className="tabular flex h-[38px] items-center text-sm font-medium text-ink">{rupiah(gajiPokok)}</p>
        </div>
      </div>

      <div>
        <Label wajib>Potongan kasbon</Label>
        <input
          type="number"
          name="totalPotongan"
          required
          min={0}
          max={Math.min(gajiPokok, totalKasbonBelumLunas)}
          value={potongan}
          // readOnly (bukan disabled) supaya nilainya tetap terkirim saat submit —
          // input disabled tidak ikut terkirim dalam FormData sama sekali.
          readOnly={totalKasbonBelumLunas === 0}
          // Dibatasi di sini juga (bukan cuma lewat atribut max) supaya nilai
          // tidak sempat tersimpan tidak valid dan bikin submit gagal tanpa
          // penjelasan yang jelas ke bendahara.
          onChange={(e) => setPotongan(Math.max(0, Math.min(Number(e.target.value) || 0, Math.min(gajiPokok, totalKasbonBelumLunas))))}
          className={`${KELAS_INPUT} tabular read-only:bg-plane read-only:text-ink-muted`}
        />
        <p className="mt-1 text-xs text-ink-muted">
          {totalKasbonBelumLunas === 0
            ? 'Karyawan ini tidak punya kasbon aktif, jadi tidak ada yang bisa dipotong bulan ini.'
            : `Sisa kasbon belum lunas: ${rupiah(totalKasbonBelumLunas)}. Saran potongan: ${rupiah(saran)} (bisa diubah, maksimal sebesar sisa kasbon atau gaji pokok).`}
        </p>
      </div>

      <div className="rounded-lg bg-plane px-3 py-2 text-sm">
        <p className="flex justify-between">
          <span className="text-ink-2">Dibayar ke karyawan</span>
          <span className="tabular font-semibold text-ink">{rupiah(totalDibayar)}</span>
        </p>
      </div>

      <Kirim label="Proses gajian" nonaktif={gajiPokok <= 0} />
    </form>
  )
}

function FormKasbon({ karyawanId }: { karyawanId: string }) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiCatatKasbon, null)

  return (
    <form action={aksi} className="space-y-3">
      <input type="hidden" name="karyawanId" value={karyawanId} />
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}
      {hasil?.ok && <Peringatan nada="info">{hasil.pesan}</Peringatan>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label wajib>Tanggal</Label>
          <input type="date" name="tanggal" required defaultValue={tanggalHariIni()} className={KELAS_INPUT} />
        </div>
        <div>
          <Label wajib>Nominal</Label>
          <input type="number" name="nominal" required min={1} inputMode="numeric" className={`${KELAS_INPUT} tabular`} />
        </div>
      </div>

      <div>
        <Label>Keterangan (opsional)</Label>
        <textarea name="keterangan" rows={2} maxLength={300} placeholder="Contoh: keperluan mendesak keluarga" className={KELAS_INPUT} />
      </div>

      <Kirim label="Catat kasbon" />
    </form>
  )
}

export default function PanelKasbonGajian({
  karyawanId,
  gajiPokok,
  totalKasbonBelumLunas,
  sudahDigajiBulanIni,
  periodeIni,
}: {
  karyawanId: string
  gajiPokok: number
  totalKasbonBelumLunas: number
  sudahDigajiBulanIni: boolean
  periodeIni: string
}) {
  const [tab, setTab] = useState<Tab>('GAJIAN')

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-lg bg-plane p-1">
        {(['GAJIAN', 'KASBON'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {t === 'GAJIAN' ? 'Proses gajian' : 'Catat kasbon'}
          </button>
        ))}
      </div>

      {tab === 'GAJIAN' ? (
        <FormGajian
          karyawanId={karyawanId}
          gajiPokok={gajiPokok}
          totalKasbonBelumLunas={totalKasbonBelumLunas}
          sudahDigajiBulanIni={sudahDigajiBulanIni}
          periodeIni={periodeIni}
        />
      ) : (
        <FormKasbon karyawanId={karyawanId} />
      )}
    </div>
  )
}
