'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiSimpanKaryawan, type HasilAksi } from './actions'
import { JABATAN_LABEL } from '@/lib/constants'
import { KELAS_INPUT, Label, Peringatan, Tombol } from '@/components/ui'

interface KaryawanForm {
  id: string
  nama: string
  jabatan: string
  gajiPokok: number
  aktif: boolean
}

function Simpan({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </Tombol>
  )
}

function FormKaryawan({ karyawan, onTutup }: { karyawan?: KaryawanForm; onTutup: () => void }) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiSimpanKaryawan, null)
  const ubah = Boolean(karyawan)

  return (
    <div className="space-y-3">
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}
      {hasil?.ok && <Peringatan nada="info">{hasil.pesan}</Peringatan>}

      <form action={aksi} className="space-y-3">
        {karyawan && <input type="hidden" name="id" value={karyawan.id} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label wajib>Nama</Label>
            <input name="nama" required minLength={2} defaultValue={karyawan?.nama ?? ''} className={KELAS_INPUT} />
          </div>
          <div>
            <Label wajib>Jabatan</Label>
            <select name="jabatan" required defaultValue={karyawan?.jabatan ?? 'SECURITY'} className={KELAS_INPUT}>
              {Object.entries(JABATAN_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label wajib>Gaji pokok / bulan</Label>
          <input
            type="number"
            name="gajiPokok"
            required
            min={1}
            defaultValue={karyawan?.gajiPokok ?? ''}
            className={`${KELAS_INPUT} tabular`}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="aktif"
            defaultChecked={karyawan ? karyawan.aktif : true}
            className="h-4 w-4 accent-[#2a78d6]"
          />
          <span className="text-ink">Aktif (masih bekerja saat ini)</span>
        </label>

        <div className="flex gap-2">
          <Simpan label={ubah ? 'Simpan perubahan' : 'Tambah karyawan'} />
          <Tombol variasi="polos" type="button" onClick={onTutup}>
            Tutup
          </Tombol>
        </div>
      </form>
    </div>
  )
}

export default function PanelKaryawan({ mode, karyawan }: { mode: 'tambah' | 'ubah'; karyawan?: KaryawanForm }) {
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
      <div className="w-[min(28rem,80vw)] rounded-lg bg-plane p-3">
        <FormKaryawan karyawan={karyawan} onTutup={() => setBuka(false)} />
      </div>
    )
  }

  if (!buka) {
    return <Tombol onClick={() => setBuka(true)}>Tambah karyawan</Tombol>
  }

  return <FormKaryawan onTutup={() => setBuka(false)} />
}
