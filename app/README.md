# Sistem Pencatatan Keuangan Iuran Warga — Cluster Salaam Citayam

Implementasi dari `PRD_Sistem_Keuangan_Cluster_Salaam_Citayam.md` (SALAAM.PRD.FIN-01 v1.0).

Menggantikan buku kas Google Sheets dengan aplikasi web: warga melapor sendiri, pengurus
memverifikasi, dan status lunas/tunggak per warga per bulan **dihitung** — bukan ditafsirkan dari
teks bebas seperti `"NOVEMBER DESEMBER 2025"`.

---

## Jalankan dalam 3 perintah

```bash
cd app
npm install
npm run setup      # generate Prisma client + buat database + isi data awal
npm run dev        # buka http://localhost:3000
```

`npm run setup` membuat `prisma/dev.db` (SQLite) — tidak perlu memasang database apa pun.

### Akun untuk mencoba

| Peran | Login | PIN |
|---|---|---|
| Bendahara | `bendahara` | `pengurus123` |
| Ketua RT | `ketua` | `pengurus123` |
| Warga | kode unit: `A1`–`A12`, `B1a`, `B1b`, `B2`, `B3`, `B5`–`B12`, `C1`–`C10` | `123456` |

Login warga tidak peka huruf besar/kecil — `b1a`, `B1a`, dan `B1A` semuanya masuk ke unit B1a.

Coba unit dengan kondisi khusus, yang dipetakan ke kasus nyata di PRD:

| Unit | Warga | Kondisi |
|---|---|---|
| `A12` | Bp. Santo | Hanya membayar komponen security Rp140.000 — persis contoh di PRD bag. 10 |
| `A6` | Bp. Fakhri Ihsan | Rapel 2 bulan sekaligus Rp350.000 — pola transaksi "FAHRI" di PRD bag. 2 |
| `B2` | Bp. Ary | Rp185.000: bulan berjalan penuh + sisa sampah bulan lalu |
| `B1a`, `B1b` | Bp. Ferry, Bp. Amran | Satu nomor rumah terbagi dua unit |
| `C7`–`C10` | | Menunggak beberapa bulan |
| `A9`, `B7`, `C3` | | Punya laporan yang menunggu verifikasi |

Catatan daftar unit: blok B **tidak punya B4**, dan B1 terbagi menjadi B1a & B1b. Nama "Bp. Asep"
muncul dua kali (A1 dan A3) — keduanya dibedakan lewat kode unit, bukan nama.

**Ganti semua PIN bawaan sebelum dipakai sungguhan.**

---

## Stack dan alasannya

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Frontend + backend satu repo, satu bahasa |
| UI | Tailwind CSS 4 | Mobile-first (NF-03), tanpa dependensi komponen berat |
| Database | Prisma + SQLite → Turso di produksi | Jalan instan tanpa setup; Turso memakai dialek yang sama, jadi naik produksi tanpa ubah kode |
| Autentikasi | Cookie session sendiri (JWT + bcrypt) | Sesuai NF-02: kode unit + PIN. Tanpa vendor, tanpa biaya |
| Grafik | SVG + HTML buatan sendiri | Nol dependensi charting |
| PDF | Print stylesheet + dialog cetak peramban | "Simpan sebagai PDF" tanpa pustaka PDF |
| Bukti transfer | Dikompres di peramban, disimpan di database | Tanpa object storage berbayar |
| Hosting | Vercel Hobby | Gratis, deploy otomatis dari Git |

Total biaya bulanan: **Rp0** pada skala 34 unit.

Sengaja **tidak** memakai Supabase/Firebase Auth: untuk 34 unit dengan login PIN, itu menambah
vendor tanpa manfaat nyata. Bukti transfer juga disimpan sebagai data URL terkompres (±100–200 KB
per gambar) alih-alih object storage — dengan ±34 unit × 12 bulan, ini puluhan MB per tahun, masih
jauh di bawah kuota gratis. Bila kelak volumenya membengkak, pindahkan kolom `Transaction.buktiUrl`
ke object storage tanpa mengubah logika lain.

---

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan mode pengembangan |
| `npm run build` / `npm start` | Build & jalankan mode produksi |
| `npm run setup` | Generate client + buat skema + isi data awal |
| `npm run db:reset` | Kosongkan dan isi ulang data awal |
| `npm run db:studio` | Buka penjelajah database (Prisma Studio) |
| `npm run verify` | Verifikasi logika perhitungan & kredensial (tanpa server) |
| `npm run verify:ui` | Verifikasi tampilan & batas akses lewat HTTP (server harus hidup) |
| `npm run typecheck` | Periksa tipe tanpa build |

`npm run verify` menghitung ulang saldo dari SQL mentah lalu membandingkannya dengan hasil pustaka,
dan menguji kasus-kasus nominal nyata dari PRD (rapel, bayar sebagian, tarif nol). Jalankan ini
setelah mengubah apa pun di `src/lib/iuran.ts` atau `src/lib/kas.ts`.

---

## Keputusan desain yang penting dipahami

### 1. Alokasi periode adalah inti sistem

Gap prioritas Tinggi di PRD adalah tidak adanya pelacakan periode iuran yang eksplisit. Solusinya
tabel `Allocation`: satu transaksi dipetakan ke satu atau lebih baris `(periode, jenisIuran, nominal)`.

Transaksi Rp350.000 milik A6 (Bp. Fakhri Ihsan) tersimpan sebagai empat baris alokasi:

```
2026-07 SAMPAH   35.000      2026-08 SAMPAH   35.000
2026-07 SECURITY 140.000     2026-08 SECURITY 140.000
```

Karena itu pertanyaan "bulan apa yang sudah dibayar" dijawab dengan kueri, bukan dengan membaca
kolom catatan.

### 2. Sampah dan security dihitung terpisah

Sebuah bulan hanya berstatus **Lunas** bila *kedua* komponen terpenuhi. Kekurangan dijumlahkan
per komponen, bukan dari selisih total — kalau tidak, kelebihan bayar security bisa menutupi
kekurangan sampah dan tunggakan jadi tersembunyi. Ini diuji di `npm run verify`.

### 3. Status: Lunas / Sebagian / Belum bayar

Tiga status, bukan dua. Data lama menunjukkan pembayaran sebagian itu nyata dan sering; memaksanya
jadi "Lunas/Belum" akan menghilangkan informasi yang justru dibutuhkan untuk menagih.

### 4. Laporan pending tidak pernah menyentuh saldo

Hanya transaksi `APPROVED` dan belum dibatalkan yang masuk saldo resmi (F-03, F-06). Ini juga
diverifikasi otomatis.

### 5. Tidak ada penghapusan, hanya pembatalan

Sesuai NF-04, pembatalan menetapkan status `VOID` + `dibatalkanPada` + alasan wajib. Barisnya tetap
ada dan tampil di bagian "Transaksi dibatalkan" pada Buku Kas.

### 6. Tarif diatur per unit, bukan konstanta global

PRD bag. 10 mencatat ada warga yang hanya membayar komponen security. Sistem mendukung ini lewat
`tarifSampah = 0` pada unit tersebut, sehingga pengecualian tidak perlu diakali lewat data transaksi.

Unit yang dimaksud PRD itu ternyata **A12 (Bp. Santo)**, ada di daftar warga. Tapi tarif sampahnya
**sengaja dibiarkan normal Rp35.000**, bukan di-nol-kan, dan diberi catatan "PERLU KONFIRMASI" yang
tampil di menu Data Warga. Alasannya: PRD sendiri belum tahu apakah ini pengecualian permanen atau
tunggakan yang belum selesai. Menagih lalu ternyata dibebaskan itu bisa diperbaiki; membebaskan
diam-diam padahal masih berutang tidak akan pernah terdeteksi. Jadi bawaannya "masih tertagih" —
ubah ke 0 lewat menu Data Warga setelah bendahara mengonfirmasi.

### 6b. Kolom `urutan` untuk pengurutan daftar

Kode unit asli tidak ber-nol-depan dan ada yang bersufiks huruf (`B1a`), sehingga pengurutan teks
menghasilkan `A1, A10, A11, A12, A2` — bukan urutan yang dikenali warga. Karena itu `Unit` punya
kolom `urutan` (kolom "No" 1–34 pada daftar warga Anda) yang dipakai untuk semua pengurutan.
Kolomnya bisa diubah lewat field **No urut** di menu Data Warga.

Konsekuensi lain dari kode bercampur huruf besar-kecil: login **tidak bisa** hanya mencoba varian
uppercase/lowercase, karena `B1a` tidak sama dengan `B1A` maupun `b1a`. Pencocokan dilakukan dengan
`LOWER()` di database, dan pengecekan bentrok kode unit juga case-insensitive agar `b1A` tidak bisa
dibuat saat `B1a` sudah ada.

### 7. Bendahara bisa mencatat atas nama warga

PRD bag. 8 memperingatkan risiko adopsi: warga mungkin tetap membayar lewat WhatsApp/tunai. Menu
**Buku Kas → Catat transaksi → Iuran warga** menyediakan jalur ini. Tanpanya, sistem akan macet
begitu ada satu warga yang tidak mau memakai aplikasi.

---

## Pemetaan requirement PRD

| ID | Requirement | Status | Letaknya |
|---|---|---|---|
| F-01 | Warga submit laporan pembayaran + bukti | Selesai | `/warga/lapor` |
| F-02 | Satu laporan mencakup banyak periode / nominal parsial | Selesai | `components/form-alokasi.tsx`, tabel `Allocation` |
| F-03 | Default "Menunggu verifikasi", tidak memengaruhi saldo | Selesai | `lib/kas.ts` (`FILTER_RESMI`) |
| F-04 | Approve / reject dengan alasan | Selesai | `/pengurus/verifikasi` |
| F-05 | Input pengeluaran berkategori | Selesai | `/pengurus/ledger/baru` |
| F-06 | Saldo kas berjalan otomatis | Selesai | `lib/kas.ts` |
| F-07 | Warga lihat riwayat & status sendiri | Selesai | `/warga`, `/warga/riwayat` |
| F-08 | Status seluruh 34 unit per bulan dalam satu tampilan | Selesai | `/pengurus/tunggakan` |
| F-09 | Dashboard: saldo, grafik arus kas, daftar penunggak | Selesai | `/pengurus` |
| F-10 | Log audit setiap input/approve/edit | Selesai | `/pengurus/audit`, `lib/audit.ts` |
| F-11 | Kelola data master 34 unit | Selesai | `/pengurus/warga` |
| F-12 | Ekspor laporan bulanan (PDF/Excel) | Selesai | `/pengurus/laporan` — cetak/PDF + ekspor CSV |
| F-13 | Notifikasi warga saat disetujui/ditolak | **Sebagian** | Status & alasan tampil di aplikasi; push/WhatsApp belum ada (lihat Belum dikerjakan) |
| F-14 | Import data historis 2020–2026 | **Belum** | Disengaja — lihat di bawah |
| NF-01 | Warga hanya melihat datanya sendiri | Selesai | `lib/auth.ts`; kueri warga dikunci ke `unitId` sesi |
| NF-02 | Autentikasi kode unit + PIN | Selesai | `lib/auth.ts` |
| NF-03 | Mobile-friendly | Selesai | Tata letak mobile-first |
| NF-04 | Tidak bisa dihapus permanen, hanya soft delete | Selesai | Kolom `dibatalkanPada`, status `VOID` |
| NF-05 | Backup otomatis berkala | **Sebagian** | Ekspor CSV manual tersedia; penjadwalan lihat di bawah |

### Belum dikerjakan, dan alasannya

**F-13 (notifikasi keluar aplikasi).** Warga sudah melihat status dan alasan penolakan saat membuka
aplikasi. Notifikasi WhatsApp membutuhkan WhatsApp Business API yang berbayar, dan email belum tentu
dibaca warga. Saran: bendahara menyalin pesan ke grup WhatsApp yang sudah ada — nol biaya dan sesuai
kebiasaan yang berjalan. Bila nanti diinginkan otomatis, titik pasangnya ada di
`aksiSetujui`/`aksiTolak` pada `src/app/pengurus/actions.ts`.

**F-14 (import data historis).** PRD sendiri (bag. 8) menyarankan mulai fresh dengan saldo akhir dari
Google Sheets, karena kolom Remark bebas teks tidak bisa diparse andal dan periode iuran historis
kemungkinan perlu diinput ulang manual per baris. Sistem ini mengikuti saran itu: isi **Pengaturan →
Saldo awal** dengan saldo akhir Sheets, arsipkan Sheets lama sebagai referensi. Membangun importir
otomatis untuk data yang formatnya tidak konsisten berisiko memasukkan angka yang salah ke buku kas —
lebih buruk daripada tidak mengimpor.

**NF-05 (backup otomatis).** Ekspor CSV manual sudah ada di Pengaturan. Untuk otomatis:

- SQLite lokal: salin berkas `prisma/dev.db` lewat tugas terjadwal.
- Turso: `turso db shell <nama-db> .dump > backup.sql` dijalankan lewat cron/GitHub Actions terjadwal.

---

## Naik ke produksi (gratis)

### 1. Database — Turso

Turso memakai dialek SQLite yang sama, jadi skema dan kueri tidak berubah.

```bash
npm i -g @tursodatabase/cli
turso auth signup
turso db create kas-salaam
turso db show kas-salaam --url         # -> libsql://...
turso db tokens create kas-salaam      # -> token
```

Untuk memakai Turso, pasang driver adapter Prisma dan arahkan `DATABASE_URL` ke URL libsql:

```bash
npm i @prisma/adapter-libsql @libsql/client
```

Lalu di `src/lib/db.ts`, ganti pembuatan `PrismaClient` dengan versi beradaptor bila
`TURSO_AUTH_TOKEN` tersedia. Untuk pengembangan lokal, biarkan `DATABASE_URL="file:./dev.db"` —
tidak ada yang perlu diubah.

Alternatif yang lebih sederhana bila tidak ingin menyentuh adapter: pakai **Postgres gratis (Neon)**
dan ubah `provider = "postgresql"` di `prisma/schema.prisma`. Seluruh kode aplikasi tetap sama;
hanya baris provider yang berubah.

### 2. Aplikasi — Vercel

```bash
git init && git add -A && git commit -m "Sistem kas Cluster Salaam Citayam"
# push ke GitHub, lalu impor repo di vercel.com
```

Isi environment variable di Vercel:

| Variabel | Nilai |
|---|---|
| `DATABASE_URL` | URL libsql/Postgres produksi |
| `TURSO_AUTH_TOKEN` | token Turso (bila memakai Turso) |
| `SESSION_SECRET` | string acak ≥32 karakter |

Generate `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Sebelum dipakai sungguhan

1. Login sebagai bendahara → **Pengaturan** → isi saldo awal dengan saldo akhir Google Sheets.
2. **Data Warga** → 34 nama penghuni sudah terisi sesuai daftar pengurus. Lengkapi **kontak**
   (masih kosong semua) dan sesuaikan **Ditagih sejak** per unit bila ada yang berbeda.
3. Konfirmasi kasus **A12 (Bp. Santo)** — pengecualian permanen atau tunggakan sampah yang belum
   selesai? Bila permanen, ubah tarif sampahnya menjadi 0.
4. Reset PIN seluruh warga (**Data Warga → Ubah → Reset PIN**) dan bagikan PIN barunya.
5. Ganti PIN akun `bendahara` dan `ketua` dari nilai bawaan.
6. Hapus transaksi contoh: `npm run db:reset` lalu kosongkan bagian transaksi di `prisma/seed.ts`,
   atau batalkan satu per satu lewat Buku Kas bila ingin jejaknya tetap ada.

---

## Struktur berkas

```
app/
├── prisma/
│   ├── schema.prisma          Skema data + alasan tiap keputusan
│   └── seed.ts                34 data warga asli + variasi nominal dari PRD
├── scripts/
│   ├── verifikasi-logika.ts   Uji saldo, status iuran, kasus PRD, pengurutan unit
│   ├── verifikasi-login.mjs   Uji pencocokan username case-insensitive & hashing PIN
│   └── verifikasi-tampilan.mjs Uji render halaman & batas akses lewat HTTP
└── src/
    ├── lib/
    │   ├── iuran.ts           Mesin perhitungan lunas/tunggak  <- inti sistem
    │   ├── kas.ts             Saldo, arus kas, ledger berjalan  <- inti sistem
    │   ├── periode.ts         Utilitas periode "YYYY-MM"
    │   ├── auth.ts            Sesi, hashing PIN, penjaga peran
    │   ├── audit.ts           Penulis jejak audit
    │   ├── validasi.ts        Skema Zod, termasuk aturan alokasi <= nominal
    │   └── format.ts          Format rupiah & tanggal Indonesia
    ├── components/
    │   ├── form-alokasi.tsx   Pemilih periode iuran  <- pengganti kolom Remark
    │   ├── grafik.tsx         Grafik arus kas & saldo (SVG/HTML)
    │   ├── unggah-bukti.tsx   Kompresi gambar di sisi klien
    │   └── ui.tsx             Kartu, lencana status, tombol, input
    └── app/
        ├── login/
        ├── warga/             Area warga (status, lapor, riwayat, akun)
        ├── pengurus/          Area pengurus (dashboard, verifikasi, tunggakan,
        │                      buku kas, laporan, data warga, audit, pengaturan)
        └── api/ekspor/        Ekspor CSV buku kas & tunggakan
```

## Catatan keamanan

- PIN disimpan sebagai hash bcrypt (cost 10), tidak pernah sebagai teks biasa.
- Sesi berupa JWT HS256 di cookie `httpOnly`, `sameSite=lax`, `secure` di produksi, berlaku 30 hari.
- Setiap permintaan memverifikasi ulang akun ke database, sehingga akun yang dinonaktifkan langsung
  kehilangan akses meski cookie-nya masih berlaku.
- Kueri area warga selalu dikunci ke `unitId` dari sesi, tidak pernah dari parameter URL (NF-01).
- Pesan galat login dibuat seragam agar tidak membocorkan kode unit mana yang terdaftar.
- Field CSV yang diawali `=`, `+`, `-`, atau `@` diberi prefiks kutip untuk mencegah injeksi rumus
  saat berkas dibuka di Excel/Sheets.
- Batas ukuran server action 4 MB, dan gambar bukti dikompres ke ±100–200 KB sebelum dikirim.

## Catatan visualisasi

Warna grafik memakai slot kategorikal biru `#2a78d6` (pemasukan) dan oranye `#eb6834` (pengeluaran),
dan sudah divalidasi terhadap surface `#fcfcfb`: pemisahan buta warna ΔE 24,7 dan kontras ≥3:1.
Status iuran memakai status palette (`#0ca30c` / `#fab219` / `#d03b3b`) yang **selalu** disertai ikon
dan teks, sehingga status tidak pernah dibedakan dari warna saja. Grafik arus kas punya tampilan
tabel sebagai alternatif, dan pemasukan/pengeluaran digambar pada **satu** skala rupiah — bukan dua
sumbu-Y — agar tingginya bisa dibandingkan langsung.

Aplikasi berkomitmen pada satu tampilan (terang) secara sengaja: dipakai bersama-sama oleh warga dan
pengurus di berbagai perangkat, dan tampilan tunggal menghilangkan satu sumber ketidakkonsistenan.
