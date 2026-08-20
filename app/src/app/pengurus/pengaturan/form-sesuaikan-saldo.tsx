'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiSesuaikanSaldo, type HasilAksi } from '../actions'
import { rupiah } from '@/lib/format'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

function tanggalHariIni() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Kirim({ nonaktif }: { nonaktif: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending || nonaktif}>
      {pending ? 'Menyesuaikan…' : 'Sesuaikan saldo'}
    </Tombol>
  )
}

export default function FormSesuaikanSaldo({ saldoTerhitung }: { saldoTerhitung: number }) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiSesuaikanSaldo, null)
  const [buka, setBuka] = useState(false)
  const [saldoRiil, setSaldoRiil] = useState<string>('')

  const nilai = saldoRiil === '' ? null : Number(saldoRiil)
  const selisih = nilai === null || Number.isNaN(nilai) ? null : nilai - saldoTerhitung

  if (!buka) {
    return (
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="text-xs font-medium text-[#1c5cab] hover:underline"
      >
        Saldo di kas/bank tidak sama dengan ini? Sesuaikan →
      </button>
    )
  }

  return (
    <form action={aksi} className="space-y-3 border-t border-grid pt-3">
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}
      {hasil?.ok && <Peringatan nada="info">{hasil.pesan}</Peringatan>}

      <Peringatan nada="info">
        Ini TIDAK mengubah saldo awal atau riwayat bulan-bulan sebelumnya. Selisihnya akan dicatat
        sebagai satu transaksi baru bertanggal hari ini (atau tanggal yang Anda pilih) di buku kas,
        supaya tetap ada jejaknya.
      </Peringatan>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label wajib>Saldo riil kas/bank saat ini</Label>
          <input
            type="number"
            name="saldoRiil"
            required
            value={saldoRiil}
            onChange={(e) => setSaldoRiil(e.target.value)}
            placeholder={String(saldoTerhitung)}
            className={`${KELAS_INPUT} tabular`}
          />
        </div>
        <div>
          <Label wajib>Tanggal penyesuaian</Label>
          <input type="date" name="tanggal" required defaultValue={tanggalHariIni()} className={KELAS_INPUT} />
        </div>
      </div>

      {selisih !== null && selisih !== 0 && (
        <div className="rounded-lg bg-plane px-3 py-2 text-sm">
          <p className="flex justify-between">
            <span className="text-ink-2">Saldo terhitung saat ini</span>
            <span className="tabular">{rupiah(saldoTerhitung)}</span>
          </p>
          <p className="mt-1 flex justify-between font-semibold">
            <span className="text-ink">{selisih > 0 ? 'Akan dicatat sebagai pemasukan' : 'Akan dicatat sebagai pengeluaran'}</span>
            <span className={`tabular ${selisih > 0 ? 'text-sukses-teks' : 'text-kritis'}`}>
              {rupiah(Math.abs(selisih))}
            </span>
          </p>
        </div>
      )}
      {selisih === 0 && (
        <p className="text-xs text-ink-muted">Sama dengan saldo terhitung — tidak perlu penyesuaian.</p>
      )}

      <div>
        <Label>Keterangan (opsional)</Label>
        <textarea
          name="keterangan"
          rows={2}
          maxLength={500}
          placeholder="Contoh: penyesuaian saat peralihan dari Google Sheets ke sistem ini"
          className={KELAS_INPUT}
        />
      </div>

      <div className="flex gap-2">
        <Kirim nonaktif={selisih === null || selisih === 0} />
        <Tombol variasi="polos" type="button" onClick={() => setBuka(false)}>
          Batal
        </Tombol>
      </div>
    </form>
  )
}
