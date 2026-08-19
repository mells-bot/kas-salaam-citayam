'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiResetPinWarga, aksiSimpanUnit, type HasilAksi } from '../actions'
import { periodeSekarang } from '@/lib/periode'
import { Kartu, KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

interface UnitForm {
  id: string
  kode: string
  blok: string
  nomor: string
  namaWarga: string
  urutan: number
  kontak: string
  tarifSampah: number
  tarifSecurity: number
  mulaiPeriode: string
  aktif: boolean
  catatan: string
}

function Simpan({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </Tombol>
  )
}

/// useFormStatus hanya melihat form induknya, jadi tombolnya harus jadi
/// komponen terpisah di dalam <form>, bukan bersaudara dengannya.
function TombolResetPin() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm('Reset PIN akun warga unit ini? PIN lama langsung tidak berlaku.')) e.preventDefault()
      }}
      className="text-xs font-medium text-[#1c5cab] hover:underline disabled:opacity-50"
    >
      {pending ? 'Mereset…' : 'Reset PIN akun warga'}
    </button>
  )
}

function ResetPin({ unitId }: { unitId: string }) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiResetPinWarga, null)

  return (
    <div className="mt-3 border-t border-grid pt-3">
      <form action={aksi}>
        <input type="hidden" name="unitId" value={unitId} />
        <TombolResetPin />
      </form>
      {hasil?.galat && <p className="mt-1 text-xs text-[#b02f2f]">{hasil.galat}</p>}
      {/* PIN baru hanya ditampilkan sekali di sini — tidak pernah disimpan sebagai teks. */}
      {hasil?.ok && (
        <div className="mt-2">
          <Peringatan nada="ingat">{hasil.pesan}</Peringatan>
        </div>
      )}
    </div>
  )
}

function FormUnit({ unit, onTutup }: { unit?: UnitForm; onTutup: () => void }) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiSimpanUnit, null)
  const ubah = Boolean(unit)

  return (
    <div className="space-y-3">
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}
      {hasil?.ok && <Peringatan nada="info">{hasil.pesan}</Peringatan>}

      <form action={aksi} className="space-y-3">
        {unit && <input type="hidden" name="id" value={unit.id} />}

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label wajib>No urut</Label>
            <input
              type="number"
              name="urutan"
              required
              min={0}
              defaultValue={unit?.urutan ?? 0}
              className={`${KELAS_INPUT} tabular`}
            />
            <p className="mt-1 text-xs text-ink-muted">Menentukan urutan daftar.</p>
          </div>
          <div>
            <Label wajib>Kode unit</Label>
            <input
              name="kode"
              required
              defaultValue={unit?.kode ?? ''}
              placeholder="A1"
              className={`${KELAS_INPUT} tabular`}
            />
            <p className="mt-1 text-xs text-ink-muted">Dipakai warga untuk login.</p>
          </div>
          <div>
            <Label wajib>Blok</Label>
            <input name="blok" required defaultValue={unit?.blok ?? ''} placeholder="A" className={KELAS_INPUT} />
          </div>
          <div>
            <Label wajib>Nomor</Label>
            <input name="nomor" required defaultValue={unit?.nomor ?? ''} placeholder="1 atau 1a" className={KELAS_INPUT} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label wajib>Nama warga</Label>
            <input name="namaWarga" required minLength={2} defaultValue={unit?.namaWarga ?? ''} className={KELAS_INPUT} />
          </div>
          <div>
            <Label>Kontak (opsional)</Label>
            <input
              name="kontak"
              defaultValue={unit?.kontak ?? ''}
              placeholder="0812xxxxxxx"
              className={KELAS_INPUT}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label wajib>Tarif sampah / bulan</Label>
            <input
              type="number"
              name="tarifSampah"
              required
              min={0}
              defaultValue={unit?.tarifSampah ?? 35000}
              className={`${KELAS_INPUT} tabular`}
            />
          </div>
          <div>
            <Label wajib>Tarif security / bulan</Label>
            <input
              type="number"
              name="tarifSecurity"
              required
              min={0}
              defaultValue={unit?.tarifSecurity ?? 140000}
              className={`${KELAS_INPUT} tabular`}
            />
          </div>
          <div>
            <Label wajib>Ditagih sejak</Label>
            <input
              name="mulaiPeriode"
              required
              placeholder="2026-01"
              pattern="\d{4}-\d{2}"
              defaultValue={unit?.mulaiPeriode ?? periodeSekarang()}
              className={`${KELAS_INPUT} tabular`}
            />
            <p className="mt-1 text-xs text-ink-muted">Format YYYY-MM.</p>
          </div>
        </div>

        <p className="text-xs text-ink-muted">
          Isi tarif <span className="tabular">0</span> untuk komponen yang tidak ditagih ke unit ini — bulan
          tersebut tetap bisa berstatus lunas tanpa membayar komponen itu.
        </p>

        <div>
          <Label>Catatan internal (opsional)</Label>
          <textarea
            name="catatan"
            rows={2}
            maxLength={500}
            defaultValue={unit?.catatan ?? ''}
            placeholder="Contoh: pengecualian tarif sampah, perlu konfirmasi ulang"
            className={KELAS_INPUT}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="aktif"
            defaultChecked={unit ? unit.aktif : true}
            className="h-4 w-4 accent-[#2a78d6]"
          />
          <span className="text-ink">Unit aktif (dihitung dalam tagihan iuran)</span>
        </label>

        <div className="flex gap-2">
          <Simpan label={ubah ? 'Simpan perubahan' : 'Tambah unit'} />
          <Tombol variasi="polos" type="button" onClick={onTutup}>
            Tutup
          </Tombol>
        </div>
      </form>

      {unit && <ResetPin unitId={unit.id} />}
    </div>
  )
}

export default function PanelWarga({ mode, unit }: { mode: 'tambah' | 'ubah'; unit?: UnitForm }) {
  const [buka, setBuka] = useState(false)

  if (mode === 'ubah') {
    if (!buka) {
      return (
        <button
          type="button"
          onClick={() => setBuka(true)}
          className="rounded-md px-2 py-1 text-xs font-medium text-[#1c5cab] hover:bg-[#2a78d6]/8"
        >
          Ubah
        </button>
      )
    }
    return (
      <div className="w-[min(38rem,80vw)] rounded-lg bg-plane p-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Ubah unit {unit?.kode}
        </p>
        <FormUnit unit={unit} onTutup={() => setBuka(false)} />
      </div>
    )
  }

  if (!buka) {
    return (
      <Tombol onClick={() => setBuka(true)}>Tambah unit warga</Tombol>
    )
  }

  return (
    <Kartu>
      <p className="mb-3 text-sm font-semibold text-ink">Tambah unit warga baru</p>
      <FormUnit onTutup={() => setBuka(false)} />
    </Kartu>
  )
}
