'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { aksiLogin, type HasilLogin } from './actions'
import { Kartu, KELAS_INPUT, Label, Peringatan } from '@/components/ui'

function TombolKirim() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-[#2a78d6] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#256abf] disabled:opacity-60"
    >
      {pending ? 'Memeriksa…' : 'Masuk'}
    </button>
  )
}

export default function FormLogin() {
  const [hasil, aksi] = useActionState<HasilLogin | null, FormData>(aksiLogin, null)

  return (
    <Kartu>
      <form action={aksi} className="space-y-4">
        {hasil?.galat && (
          <Peringatan nada="kritis">
            <span>{hasil.galat}</span>
          </Peringatan>
        )}

        <div>
          <Label wajib>Kode unit / username</Label>
          <input
            name="username"
            required
            autoComplete="username"
            autoCapitalize="characters"
            placeholder="A1"
            className={KELAS_INPUT}
          />
        </div>

        <div>
          <Label wajib>PIN</Label>
          <input
            name="pin"
            type="password"
            required
            autoComplete="current-password"
            inputMode="numeric"
            placeholder="••••••"
            className={KELAS_INPUT}
          />
        </div>

        <TombolKirim />
      </form>
    </Kartu>
  )
}
