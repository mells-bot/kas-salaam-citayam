import { sesiSaatIni, isPengurus } from '@/lib/auth'
import { ledgerBerjalan } from '@/lib/kas'
import { KATEGORI_PENGELUARAN } from '@/lib/constants'
import { labelPeriode } from '@/lib/format'

/**
 * Ekspor buku kas ke CSV (F-12).
 *
 * CSV dipilih daripada XLSX karena bisa dibuat tanpa pustaka apa pun dan tetap
 * langsung terbuka di Excel maupun Google Sheets.
 */

/** Pembungkus field CSV. Prefix tanda kutip pada karakter formula mencegah
 *  injeksi rumus saat berkas dibuka di Excel/Sheets. */
function sel(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  const aman = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${aman.replace(/"/g, '""')}"`
}

function tanggalIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(request: Request) {
  const sesi = await sesiSaatIni()
  // NF-01: ekspor seluruh buku kas hanya untuk pengurus.
  if (!sesi || !isPengurus(sesi.role)) {
    return new Response('Tidak berwenang', { status: 403 })
  }

  const url = new URL(request.url)
  const p = url.searchParams

  const parseTgl = (s: string | null) => {
    if (!s) return undefined
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? undefined : d
  }

  const dari = parseTgl(p.get('dari'))
  const sampaiMentah = parseTgl(p.get('sampai'))
  const sampai = sampaiMentah ? new Date(sampaiMentah.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined
  const jenisParam = p.get('jenis')
  const jenis = jenisParam === 'MASUK' || jenisParam === 'KELUAR' ? jenisParam : undefined
  const kategoriParam = p.get('kategori')
  const kategori = kategoriParam && KATEGORI_PENGELUARAN.includes(kategoriParam as never) ? kategoriParam : undefined

  const { saldoPembuka, baris, saldoPenutup } = await ledgerBerjalan({
    dari,
    sampai,
    jenis,
    kategori,
    unitId: p.get('unit') || undefined,
  })

  const judul = [
    'No',
    'Tanggal',
    'Uraian',
    'Unit',
    'Nama Warga',
    'Kategori',
    'Metode',
    'Periode Iuran',
    'Debit (Masuk)',
    'Kredit (Keluar)',
    'Saldo',
    'Catatan',
  ]

  const larik: string[] = []
  larik.push(judul.map(sel).join(','))
  larik.push(
    [sel(''), sel(''), sel('SALDO PEMBUKA'), sel(''), sel(''), sel(''), sel(''), sel(''), sel(''), sel(''), sel(saldoPembuka), sel('')].join(','),
  )

  baris.forEach((b, i) => {
    const periode = b.alokasi.map((a) => `${labelPeriode(a.periode)} ${a.jenisIuran} ${a.nominal}`).join(' | ')
    larik.push(
      [
        sel(i + 1),
        sel(tanggalIso(b.tanggal)),
        sel(b.uraian),
        sel(b.unit?.kode ?? ''),
        sel(b.unit?.namaWarga ?? ''),
        sel(b.kategori ?? ''),
        sel(b.metode),
        sel(periode),
        sel(b.debit || ''),
        sel(b.kredit || ''),
        sel(b.saldo),
        sel(b.remark ?? ''),
      ].join(','),
    )
  })

  larik.push(
    [sel(''), sel(''), sel('SALDO PENUTUP'), sel(''), sel(''), sel(''), sel(''), sel(''), sel(''), sel(''), sel(saldoPenutup), sel('')].join(','),
  )

  // BOM UTF-8 supaya Excel di Windows membaca huruf beraksen dengan benar.
  const csv = `﻿${larik.join('\r\n')}\r\n`
  const namaBerkas = `buku-kas${dari ? `-${tanggalIso(dari)}` : ''}${sampaiMentah ? `-sd-${tanggalIso(sampaiMentah)}` : ''}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${namaBerkas}"`,
      'Cache-Control': 'no-store',
    },
  })
}
