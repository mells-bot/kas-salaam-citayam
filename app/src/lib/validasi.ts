import { z } from 'zod'
import { JENIS_IURAN, KATEGORI_PENGELUARAN } from './constants'
import { isPeriodeValid } from './periode'

const nominalPositif = z.coerce
  .number({ invalid_type_error: 'Nominal harus berupa angka' })
  .int('Nominal harus bilangan bulat rupiah (tanpa sen)')
  .positive('Nominal harus lebih dari 0')
  .max(1_000_000_000, 'Nominal tidak wajar (melebihi 1 miliar)')

const tanggalTransaksi = z.coerce
  .date({ invalid_type_error: 'Tanggal tidak valid' })
  .refine((d) => d <= new Date(Date.now() + 24 * 60 * 60 * 1000), {
    message: 'Tanggal tidak boleh di masa depan',
  })
  .refine((d) => d >= new Date('2020-01-01'), {
    message: 'Tanggal terlalu lampau (sebelum 2020)',
  })

export const alokasiSchema = z.object({
  periode: z.string().refine(isPeriodeValid, { message: 'Periode harus format YYYY-MM yang valid' }),
  jenisIuran: z.enum([JENIS_IURAN.SAMPAH, JENIS_IURAN.SECURITY]),
  nominal: nominalPositif,
})

/// Laporan pembayaran dari warga (F-01, F-02).
export const laporanBayarSchema = z
  .object({
    tanggal: tanggalTransaksi,
    nominal: nominalPositif,
    metode: z.enum(['TRANSFER', 'TUNAI']),
    remark: z.string().max(500, 'Catatan maksimal 500 karakter').optional().or(z.literal('')),
    buktiUrl: z.string().max(3_000_000).optional().or(z.literal('')),
    alokasi: z.array(alokasiSchema).min(1, 'Pilih minimal satu periode bulan yang dibayar'),
  })
  .superRefine((data, ctx) => {
    const totalAlokasi = data.alokasi.reduce((s, a) => s + a.nominal, 0)
    // Ini aturan integritas paling penting di sistem: uang yang dialokasikan ke
    // periode iuran tidak boleh melebihi uang yang benar-benar masuk.
    if (totalAlokasi > data.nominal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['alokasi'],
        message: `Total alokasi per bulan (${totalAlokasi.toLocaleString('id-ID')}) melebihi nominal transaksi (${data.nominal.toLocaleString('id-ID')})`,
      })
    }
    const kunci = new Set<string>()
    for (const a of data.alokasi) {
      const k = `${a.periode}|${a.jenisIuran}`
      if (kunci.has(k)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['alokasi'],
          message: `Periode ${a.periode} jenis ${a.jenisIuran} terisi lebih dari sekali`,
        })
      }
      kunci.add(k)
    }
  })

/// Bendahara mencatat pembayaran atas nama warga (jalur adopsi rendah, PRD bag. 8).
export const laporanBayarOlehPengurusSchema = z.intersection(
  laporanBayarSchema,
  z.object({ unitId: z.string().min(1, 'Pilih unit warga') }),
)

/// Pengeluaran (F-05).
export const pengeluaranSchema = z.object({
  tanggal: tanggalTransaksi,
  nominal: nominalPositif,
  uraian: z.string().trim().min(3, 'Uraian minimal 3 karakter').max(300),
  kategori: z.enum(KATEGORI_PENGELUARAN),
  metode: z.enum(['TRANSFER', 'TUNAI']),
  remark: z.string().max(500).optional().or(z.literal('')),
  buktiUrl: z.string().max(3_000_000).optional().or(z.literal('')),
})

/// Pemasukan non-iuran (donasi, bunga bank, dsb.) — tanpa alokasi periode.
export const pemasukanLainSchema = z.object({
  tanggal: tanggalTransaksi,
  nominal: nominalPositif,
  uraian: z.string().trim().min(3, 'Uraian minimal 3 karakter').max(300),
  metode: z.enum(['TRANSFER', 'TUNAI']),
  remark: z.string().max(500).optional().or(z.literal('')),
})

export const unitSchema = z.object({
  kode: z.string().trim().min(1, 'Kode unit wajib').max(20)
    .regex(/^[A-Za-z0-9\-\/ ]+$/, 'Kode unit hanya boleh huruf, angka, spasi, - dan /'),
  blok: z.string().trim().min(1, 'Blok wajib').max(20),
  nomor: z.string().trim().min(1, 'Nomor wajib').max(20),
  namaWarga: z.string().trim().min(2, 'Nama warga minimal 2 karakter').max(100),
  /// Nomor urut tampilan. Dipakai untuk mengurutkan daftar karena kode unit
  /// seperti "A10" dan "B1a" tidak terurut benar secara teks.
  urutan: z.coerce.number().int().min(0).max(9999),
  kontak: z.string().trim().max(30).optional().or(z.literal('')),
  tarifSampah: z.coerce.number().int().min(0).max(10_000_000),
  tarifSecurity: z.coerce.number().int().min(0).max(10_000_000),
  mulaiPeriode: z.string().refine(isPeriodeValid, { message: 'Periode mulai harus format YYYY-MM' }),
  aktif: z.coerce.boolean(),
  catatan: z.string().max(500).optional().or(z.literal('')),
})

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Kode unit / username wajib diisi').max(50),
  pin: z.string().min(4, 'PIN minimal 4 karakter').max(72),
})

export const gantiPinSchema = z
  .object({
    pinLama: z.string().min(1, 'PIN lama wajib diisi'),
    pinBaru: z.string().min(6, 'PIN baru minimal 6 karakter').max(72),
    konfirmasi: z.string().min(1, 'Konfirmasi wajib diisi'),
  })
  .refine((d) => d.pinBaru === d.konfirmasi, {
    path: ['konfirmasi'],
    message: 'Konfirmasi PIN tidak sama dengan PIN baru',
  })

// ---------------------------------------------------------------------------
// Tagihan tambahan (THR, dsb.)
// ---------------------------------------------------------------------------

export const tagihanTambahanSchema = z.object({
  nama: z.string().trim().min(3, 'Nama tagihan minimal 3 karakter').max(150),
  periode: z.string().refine(isPeriodeValid, { message: 'Periode harus format YYYY-MM' }),
  nominalPerUnit: nominalPositif,
  keterangan: z.string().max(500).optional().or(z.literal('')),
})

export const laporanTambahanSchema = z.object({
  tagihanTambahanId: z.string().min(1, 'Tagihan tidak valid'),
  tanggal: tanggalTransaksi,
  nominal: nominalPositif,
  metode: z.enum(['TRANSFER', 'TUNAI']),
  remark: z.string().max(500).optional().or(z.literal('')),
  buktiUrl: z.string().max(3_000_000).optional().or(z.literal('')),
})

// ---------------------------------------------------------------------------
// Karyawan, kasbon & gajian
// ---------------------------------------------------------------------------

export const karyawanSchema = z.object({
  nama: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  jabatan: z.enum(['SECURITY', 'KEBERSIHAN']),
  gajiPokok: nominalPositif,
  aktif: z.coerce.boolean(),
  catatan: z.string().max(500).optional().or(z.literal('')),
})

export const kasbonSchema = z.object({
  karyawanId: z.string().min(1, 'Pilih karyawan'),
  tanggal: tanggalTransaksi,
  nominal: nominalPositif,
  keterangan: z.string().max(300).optional().or(z.literal('')),
})

export const gajianSchema = z.object({
  karyawanId: z.string().min(1, 'Pilih karyawan'),
  periode: z.string().refine(isPeriodeValid, { message: 'Periode harus format YYYY-MM' }),
  tanggal: tanggalTransaksi,
  gajiPokok: nominalPositif,
  // 0 diperbolehkan (tidak ada potongan kasbon bulan ini).
  totalPotongan: z.coerce.number().int().min(0).max(1_000_000_000),
})
