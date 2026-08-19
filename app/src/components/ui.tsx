import type { ReactNode } from 'react'
import { STATUS } from '@/lib/constants'
import { rupiah } from '@/lib/format'
import type { StatusPeriode } from '@/lib/iuran'

export function Kartu({
  children,
  className = '',
  padat = false,
}: {
  children: ReactNode
  className?: string
  padat?: boolean
}) {
  return (
    <div
      className={`rounded-xl border border-hairline bg-surface ${padat ? 'p-3' : 'p-4 sm:p-5'} ${className}`}
    >
      {children}
    </div>
  )
}

export function JudulSeksi({
  children,
  aksi,
  keterangan,
}: {
  children: ReactNode
  aksi?: ReactNode
  keterangan?: string
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-ink">{children}</h2>
        {keterangan && <p className="mt-0.5 text-xs text-ink-muted">{keterangan}</p>}
      </div>
      {aksi}
    </div>
  )
}

/**
 * Kartu angka utama. Untuk satu angka headline, angka besar lebih mudah dibaca
 * daripada grafik — grafik disimpan untuk data yang punya dimensi waktu.
 */
export function KartuAngka({
  label,
  nilai,
  satuan,
  catatan,
  nada = 'netral',
}: {
  label: string
  nilai: string
  satuan?: string
  catatan?: string
  nada?: 'netral' | 'baik' | 'kritis' | 'ingat'
}) {
  const warnaNilai = {
    netral: 'text-ink',
    baik: 'text-sukses-teks',
    kritis: 'text-kritis',
    ingat: 'text-ink',
  }[nada]

  return (
    <Kartu>
      <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</p>
      <p className={`mt-1.5 text-2xl leading-tight font-semibold sm:text-3xl ${warnaNilai}`}>
        {nilai}
        {satuan && <span className="ml-1 text-base font-normal text-ink-2">{satuan}</span>}
      </p>
      {catatan && <p className="mt-1.5 text-xs text-ink-2">{catatan}</p>}
    </Kartu>
  )
}

/** Ikon kecil pendamping status — status tidak boleh dibedakan dari warna saja. */
function IkonStatus({ bentuk }: { bentuk: 'centang' | 'separuh' | 'silang' | 'jam' }) {
  const c = 'h-3.5 w-3.5 shrink-0'
  if (bentuk === 'centang')
    return (
      <svg className={c} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 8.5 6.2 11.7 13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  if (bentuk === 'separuh')
    return (
      <svg className={c} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
        <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
      </svg>
    )
  if (bentuk === 'jam')
    return (
      <svg className={c} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
        <path d="M8 4.8V8l2.2 1.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  return (
    <svg className={c} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const GAYA_STATUS_PERIODE: Record<
  StatusPeriode,
  { label: string; kelas: string; bentuk: 'centang' | 'separuh' | 'silang' }
> = {
  LUNAS: {
    label: 'Lunas',
    kelas: 'bg-[#0ca30c]/10 text-[#0a7c0a] ring-[#0ca30c]/30',
    bentuk: 'centang',
  },
  SEBAGIAN: {
    label: 'Sebagian',
    kelas: 'bg-[#fab219]/15 text-[#8a5d00] ring-[#fab219]/40',
    bentuk: 'separuh',
  },
  BELUM: {
    label: 'Belum bayar',
    kelas: 'bg-[#d03b3b]/10 text-[#b02f2f] ring-[#d03b3b]/30',
    bentuk: 'silang',
  },
}

/** Lencana status iuran per periode: warna + ikon + teks. */
export function LencanaStatus({ status, ringkas = false }: { status: StatusPeriode; ringkas?: boolean }) {
  const g = GAYA_STATUS_PERIODE[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${g.kelas}`}
    >
      <IkonStatus bentuk={g.bentuk} />
      {!ringkas && g.label}
    </span>
  )
}

const GAYA_STATUS_TRX: Record<string, { label: string; kelas: string; bentuk: 'centang' | 'jam' | 'silang' }> = {
  [STATUS.PENDING]: {
    label: 'Menunggu verifikasi',
    kelas: 'bg-[#fab219]/15 text-[#8a5d00] ring-[#fab219]/40',
    bentuk: 'jam',
  },
  [STATUS.APPROVED]: {
    label: 'Disetujui',
    kelas: 'bg-[#0ca30c]/10 text-[#0a7c0a] ring-[#0ca30c]/30',
    bentuk: 'centang',
  },
  [STATUS.REJECTED]: {
    label: 'Ditolak',
    kelas: 'bg-[#d03b3b]/10 text-[#b02f2f] ring-[#d03b3b]/30',
    bentuk: 'silang',
  },
  [STATUS.VOID]: {
    label: 'Dibatalkan',
    kelas: 'bg-black/5 text-ink-2 ring-black/10',
    bentuk: 'silang',
  },
}

/** Lencana status transaksi (alur verifikasi F-03/F-04). */
export function LencanaStatusTransaksi({ status }: { status: string }) {
  const g = GAYA_STATUS_TRX[status] ?? GAYA_STATUS_TRX[STATUS.VOID]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${g.kelas}`}
    >
      <IkonStatus bentuk={g.bentuk} />
      {g.label}
    </span>
  )
}

export function Nominal({
  nilai,
  tanda,
  className = '',
}: {
  nilai: number
  tanda?: 'masuk' | 'keluar'
  className?: string
}) {
  const warna =
    tanda === 'masuk' ? 'text-sukses-teks' : tanda === 'keluar' ? 'text-kritis' : 'text-ink'
  const prefix = tanda === 'masuk' ? '+' : tanda === 'keluar' ? '−' : ''
  return (
    <span className={`tabular whitespace-nowrap ${warna} ${className}`}>
      {prefix}
      {rupiah(nilai)}
    </span>
  )
}

export function Kosong({ pesan, aksi }: { pesan: string; aksi?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-baseline px-4 py-10 text-center">
      <p className="text-sm text-ink-2">{pesan}</p>
      {aksi && <div className="mt-3">{aksi}</div>}
    </div>
  )
}

export function Peringatan({
  judul,
  children,
  nada = 'ingat',
}: {
  judul?: string
  children: ReactNode
  nada?: 'ingat' | 'kritis' | 'info'
}) {
  const kelas = {
    ingat: 'bg-[#fab219]/10 ring-[#fab219]/40 text-[#6b4900]',
    kritis: 'bg-[#d03b3b]/8 ring-[#d03b3b]/35 text-[#8f2626]',
    info: 'bg-[#2a78d6]/8 ring-[#2a78d6]/30 text-[#1c5cab]',
  }[nada]
  return (
    <div className={`rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset ${kelas}`}>
      {judul && <p className="font-semibold">{judul}</p>}
      <div className={judul ? 'mt-0.5' : ''}>{children}</div>
    </div>
  )
}

export function Tombol({
  children,
  variasi = 'utama',
  ukuran = 'sedang',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variasi?: 'utama' | 'sekunder' | 'bahaya' | 'polos'
  ukuran?: 'kecil' | 'sedang'
}) {
  const dasar =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
  const uk = ukuran === 'kecil' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
  const v = {
    utama: 'bg-[#2a78d6] text-white hover:bg-[#256abf]',
    sekunder: 'bg-white text-ink ring-1 ring-inset ring-baseline hover:bg-plane',
    bahaya: 'bg-[#d03b3b] text-white hover:bg-[#b02f2f]',
    polos: 'text-ink-2 hover:bg-black/5',
  }[variasi]
  return (
    <button className={`${dasar} ${uk} ${v} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Label({ children, wajib }: { children: ReactNode; wajib?: boolean }) {
  return (
    <label className="mb-1 block text-sm font-medium text-ink">
      {children}
      {wajib && <span className="ml-0.5 text-kritis">*</span>}
    </label>
  )
}

export const KELAS_INPUT =
  'w-full rounded-lg border border-baseline bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-[#2a78d6] focus:outline-none'

export function GalatField({ pesan }: { pesan?: string }) {
  if (!pesan) return null
  return <p className="mt-1 text-xs text-kritis">{pesan}</p>
}
