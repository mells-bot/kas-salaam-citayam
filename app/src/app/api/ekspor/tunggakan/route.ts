import { sesiSaatIni, isPengurus } from '@/lib/auth'
import { kartuIuranSemuaUnit } from '@/lib/iuran'
import { periodeSekarang } from '@/lib/periode'
import { isPeriodeValid } from '@/lib/periode'
import { labelPeriode } from '@/lib/format'

/** Ekspor daftar tunggakan per unit ke CSV — dipakai bahan menagih (F-12). */

function sel(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  const aman = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${aman.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const sesi = await sesiSaatIni()
  if (!sesi || !isPengurus(sesi.role)) return new Response('Tidak berwenang', { status: 403 })

  const p = new URL(request.url).searchParams
  const periodeParam = p.get('periode')
  const hingga = periodeParam && isPeriodeValid(periodeParam) ? periodeParam : periodeSekarang()

  const kartu = await kartuIuranSemuaUnit(hingga)

  const larik: string[] = []
  larik.push(
    ['Unit', 'Blok', 'Nomor', 'Nama Warga', 'Bulan Belum Lunas', 'Bulan Tertua Belum Lunas', 'Total Tunggakan', 'Rincian Per Bulan']
      .map(sel)
      .join(','),
  )

  for (const k of kartu) {
    const belum = k.baris.filter((b) => b.totalKurang > 0)
    const rincian = belum.map((b) => `${labelPeriode(b.periode)}: kurang ${b.totalKurang}`).join(' | ')
    larik.push(
      [
        sel(k.kode),
        sel(k.blok),
        sel(k.nomor),
        sel(k.namaWarga),
        sel(belum.length),
        sel(belum[0] ? labelPeriode(belum[0].periode) : ''),
        sel(k.totalTunggakan),
        sel(rincian),
      ].join(','),
    )
  }

  const csv = `﻿${larik.join('\r\n')}\r\n`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tunggakan-sd-${hingga}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
