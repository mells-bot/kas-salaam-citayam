'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export interface ItemMenu {
  href: string
  label: string
  /** Tampilkan lencana angka, mis. jumlah laporan menunggu verifikasi. */
  lencana?: number
}

function aktifkan(pathname: string, href: string) {
  // Rute induk hanya aktif bila sama persis, agar tidak ikut menyala
  // ketika pengguna berada di sub-halamannya.
  if (href === '/pengurus' || href === '/warga') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Navigasi({
  menu,
  nama,
  peran,
  namaCluster,
}: {
  menu: ItemMenu[]
  nama: string
  peran: string
  namaCluster: string
}) {
  const pathname = usePathname()
  const [buka, setBuka] = useState(false)

  return (
    <header className="no-print sticky top-0 z-30 border-b border-hairline bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href={menu[0].href} className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2a78d6] text-white">
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 9.5 12 4l9 5.5M5 10.5V19h14v-8.5M9.5 19v-4.5h5V19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm leading-tight font-semibold text-ink">Kas Cluster</span>
            <span className="block truncate text-[11px] leading-tight text-ink-muted">{namaCluster}</span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-0.5 lg:flex">
          {menu.map((m) => {
            const on = aktifkan(pathname, m.href)
            return (
              <Link
                key={m.href}
                href={m.href}
                aria-current={on ? 'page' : undefined}
                className={`relative rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  on ? 'bg-[#2a78d6]/10 text-[#1c5cab]' : 'text-ink-2 hover:bg-black/5'
                }`}
              >
                {m.label}
                {m.lencana ? (
                  <span className="tabular ml-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#d03b3b] px-1 text-[10px] font-semibold text-white">
                    {m.lencana}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          <div className="hidden text-right sm:block">
            <p className="max-w-[10rem] truncate text-xs leading-tight font-medium text-ink">{nama}</p>
            <p className="text-[11px] leading-tight text-ink-muted">{peran}</p>
          </div>
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-baseline hover:bg-plane"
            >
              Keluar
            </button>
          </form>
          <button
            type="button"
            onClick={() => setBuka((b) => !b)}
            aria-expanded={buka}
            aria-label="Menu navigasi"
            className="rounded-lg p-1.5 text-ink-2 ring-1 ring-inset ring-baseline hover:bg-plane lg:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {buka ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {buka && (
        <nav className="border-t border-hairline px-3 pb-3 lg:hidden">
          <div className="grid grid-cols-2 gap-1.5 pt-2 sm:grid-cols-3">
            {menu.map((m) => {
              const on = aktifkan(pathname, m.href)
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setBuka(false)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex items-center justify-between gap-1 rounded-lg px-3 py-2 text-sm font-medium ${
                    on ? 'bg-[#2a78d6]/10 text-[#1c5cab]' : 'text-ink-2 hover:bg-black/5'
                  }`}
                >
                  {m.label}
                  {m.lencana ? (
                    <span className="tabular inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#d03b3b] px-1 text-[10px] font-semibold text-white">
                      {m.lencana}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </header>
  )
}
