'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiNonaktifkanKategori, aksiTambahKategori, type HasilAksi } from '../actions'
import { KELAS_INPUT, Peringatan, Tombol } from '@/components/ui'

interface Kategori {
  id: string
  nama: string
  aktif: boolean
}

function TombolTambah() {
  const { pending } = useFormStatus()
  return (
    <Tombol type="submit" ukuran="kecil" disabled={pending}>
      {pending ? 'Menambah…' : 'Tambah'}
    </Tombol>
  )
}

function FormTambah() {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiTambahKategori, null)
  return (
    <form action={aksi} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="nama"
          required
          minLength={2}
          maxLength={100}
          placeholder="Contoh: Iuran Renovasi"
          className={`${KELAS_INPUT} flex-1`}
        />
        <TombolTambah />
      </div>
      {hasil?.galat && <Peringatan nada="kritis">{hasil.galat}</Peringatan>}
      {hasil?.ok && <Peringatan nada="info">{hasil.pesan}</Peringatan>}
    </form>
  )
}

function TombolNonaktifkan({ kategori }: { kategori: Kategori }) {
  const [hasil, aksi] = useActionState<HasilAksi | null, FormData>(aksiNonaktifkanKategori, null)
  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={aksi}
        onSubmit={(e) => {
          if (!confirm(`Nonaktifkan kategori "${kategori.nama}"? Transaksi lama yang memakainya tetap tersimpan apa adanya.`)) {
            e.preventDefault()
          }
        }}
      >
        <input type="hidden" name="id" value={kategori.id} />
        <button type="submit" className="text-xs font-medium text-ink-muted hover:text-kritis">
          Nonaktifkan
        </button>
      </form>
      {hasil?.galat && <p className="text-xs text-[#b02f2f]">{hasil.galat}</p>}
    </div>
  )
}

export default function PanelKategori({ kategori }: { kategori: Kategori[] }) {
  const [tambahBuka, setTambahBuka] = useState(false)
  const aktif = kategori.filter((k) => k.aktif)
  const nonaktif = kategori.filter((k) => !k.aktif)

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-grid">
        {aktif.map((k) => (
          <li key={k.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-ink">{k.nama}</span>
            <TombolNonaktifkan kategori={k} />
          </li>
        ))}
      </ul>

      {nonaktif.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-ink-muted hover:text-ink-2">
            {nonaktif.length} kategori nonaktif
          </summary>
          <ul className="mt-1 divide-y divide-grid">
            {nonaktif.map((k) => (
              <li key={k.id} className="py-1.5 text-sm text-ink-muted line-through">
                {k.nama}
              </li>
            ))}
          </ul>
        </details>
      )}

      {tambahBuka ? (
        <FormTambah />
      ) : (
        <Tombol variasi="sekunder" ukuran="kecil" onClick={() => setTambahBuka(true)}>
          + Tambah kategori
        </Tombol>
      )}
    </div>
  )
}
