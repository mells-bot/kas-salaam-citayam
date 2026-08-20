import { db } from './db'
import { STATUS_KASBON } from './constants'

/*
 * Kasbon & penggajian karyawan (security, kebersihan).
 *
 * Gajian tidak memotong kasbon secara penuh-otomatis — bendahara menentukan
 * sendiri nominal potongan tiap gajian (bisa kurang dari sisa kasbon, misal
 * ada kesepakatan cicilan). Sistem hanya MENYARANKAN nominal potongan
 * (minimum antara total sisa kasbon dan gaji pokok bulan itu).
 */

export interface RingkasanKaryawan {
  id: string
  nama: string
  jabatan: string
  gajiPokok: number
  aktif: boolean
  totalKasbonBelumLunas: number
  sudahDigajiBulanIni: boolean
}

/// Daftar karyawan aktif beserta total kasbon yang masih tersisa.
export async function daftarKaryawan(periodeIni: string): Promise<RingkasanKaryawan[]> {
  const karyawan = await db.karyawan.findMany({
    orderBy: [{ aktif: 'desc' }, { jabatan: 'asc' }, { nama: 'asc' }],
    include: {
      kasbon: { where: { status: STATUS_KASBON.BELUM_LUNAS }, select: { sisaBelumLunas: true } },
      gajian: { where: { periode: periodeIni }, select: { id: true } },
    },
  })

  return karyawan.map((k) => ({
    id: k.id,
    nama: k.nama,
    jabatan: k.jabatan,
    gajiPokok: k.gajiPokok,
    aktif: k.aktif,
    totalKasbonBelumLunas: k.kasbon.reduce((s, x) => s + x.sisaBelumLunas, 0),
    sudahDigajiBulanIni: k.gajian.length > 0,
  }))
}

/// Nominal potongan yang disarankan sistem — bendahara boleh mengubahnya.
export function saranPotongan(gajiPokok: number, totalKasbonBelumLunas: number): number {
  return Math.min(gajiPokok, totalKasbonBelumLunas)
}

export interface DetailKasbon {
  id: string
  tanggal: Date
  nominal: number
  sisaBelumLunas: number
  keterangan: string | null
  status: string
}

/// Kasbon aktif satu karyawan, diurutkan dari yang paling lama (FIFO untuk pemotongan).
export async function kasbonAktifKaryawan(karyawanId: string): Promise<DetailKasbon[]> {
  const rows = await db.kasbon.findMany({
    where: { karyawanId, status: STATUS_KASBON.BELUM_LUNAS },
    orderBy: { tanggal: 'asc' },
  })
  return rows
}
