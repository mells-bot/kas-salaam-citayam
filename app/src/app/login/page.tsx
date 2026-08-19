import { redirect } from 'next/navigation'
import { sesiSaatIni, isPengurus } from '@/lib/auth'
import FormLogin from './form-login'

export const metadata = { title: 'Masuk · Kas Cluster Salaam Citayam' }

export default async function HalamanLogin() {
  const sesi = await sesiSaatIni()
  if (sesi) redirect(isPengurus(sesi.role) ? '/pengurus' : '/warga')

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#2a78d6] text-white">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 9.5 12 4l9 5.5M5 10.5V19h14v-8.5M9.5 19v-4.5h5V19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-ink">Kas Cluster Salaam Citayam</h1>
          <p className="mt-1 text-sm text-ink-2">Pencatatan keuangan iuran warga</p>
        </div>

        <FormLogin />

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-muted">
          Warga masuk dengan <strong className="font-semibold text-ink-2">kode unit</strong> (contoh:{' '}
          <span className="tabular">A1</span>, <span className="tabular">B1a</span>) dan PIN.
          <br />
          Lupa PIN? Hubungi bendahara untuk direset.
        </p>
      </div>
    </main>
  )
}
