# Product Requirements Document

## Sistem Pencatatan Keuangan Iuran Warga

Cluster Salaam Citayam

Dokumen No: SALAAM.PRD.FIN-01

Versi: 1.0

Tanggal: 19 Agustus 2026

*Status: Draft untuk direview*

## 1. Ringkasan Eksekutif

Cluster Salaam Citayam saat ini mencatat seluruh transaksi keuangan iuran warga (security dan sampah) menggunakan Google Sheets dalam format buku kas manual (ledger berjalan). Sistem ini telah berjalan sejak tahun 2020 dan terbukti bisa dipakai, namun bergantung penuh pada satu bendahara yang mengetik setiap baris transaksi secara manual, tanpa validasi otomatis, tanpa pelacakan periode iuran yang eksplisit, dan tanpa mekanisme verifikasi independen.

Dokumen ini mendefinisikan kebutuhan untuk membangun aplikasi web sederhana yang menggantikan Google Sheets tersebut, dengan kemampuan: warga melaporkan pembayaran sendiri, pengurus memverifikasi, sistem melacak status iuran per warga per bulan secara akurat (termasuk kasus rapel/bayar sebagian/campur jenis iuran), dan menghasilkan laporan kas otomatis.

Keputusan paling berdampak dalam dokumen ini: melibatkan warga sebagai pelapor mandiri (self-service reporting) mengubah sistem dari alat pencatatan internal menjadi aplikasi multi-pengguna dengan kebutuhan autentikasi, alur approval, dan potensi sengketa data. Ini dicatat eksplisit di bagian Risiko (bagian 8), bukan diasumsikan sepele.

## 2. Latar Belakang

Data historis Google Sheets "CASHFLOW_Salaam_Citayam" menunjukkan pola berikut, yang menjadi dasar seluruh requirement di dokumen ini:

- Ledger berjalan sejak April 2020 hingga saat ini (Agustus 2026), dengan total puluhan hingga ratusan baris transaksi per tahun.

- Skema iuran saat ini: Rp35.000/bulan (sampah) + Rp140.000/bulan (security) = Rp175.000/bulan/unit, berlaku untuk 34 unit rumah.

- Nominal transaksi tidak selalu Rp175.000 flat. Ditemukan variasi: Rp140.000 (hanya bayar security, tanpa sampah), Rp150.000/Rp185.000 (kombinasi bulan berjalan + rapel bulan sebelumnya), dan Rp350.000 (bayar 2 bulan sekaligus).

- Kolom "Remark" digunakan untuk mencatat konteks tunggakan atau periode yang dibayar (contoh: transaksi FAHRI Rp350.000 diberi keterangan "NOVEMBER DESEMBER 2025"). Tanpa kolom ini, tidak mungkin diketahui pembayaran berlaku untuk bulan apa.

- Header pemisah bulan (contoh: "Januari 2026") disisipkan sebagai baris manual di tengah data, dan batasnya tidak tegas — transaksi akhir bulan sebelumnya kerap tercampur setelah header bulan baru.

- Pengeluaran rutin (honor security, bayar iuran sampah ke pihak ketiga) dan pengeluaran ad-hoc (ATK, konsumsi kerja bakti, material) dicatat di kolom Kredit pada ledger yang sama dengan pemasukan.

Kesimpulan: kebutuhan sesungguhnya bukan sekadar tabel status "Lunas/Belum" per bulan per warga, melainkan ledger transaksi granular yang mampu memetakan satu transaksi ke satu atau lebih periode iuran secara eksplisit.

## 3. Kondisi Saat Ini (As-Is)

| **Aspek**               | **Kondisi As-Is**                                                                                                          |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------|
| Media pencatatan        | Google Sheets, 1 file, banyak sheet (list warga, simulasi biaya, ledger, iuran renov, dsb.)                                |
| Input transaksi         | Manual oleh 1 bendahara, ketik nomor, tanggal, uraian, debit/kredit, saldo dihitung manual atau semi-formula               |
| Pelacakan periode iuran | Tidak terstruktur — bergantung pada teks bebas di kolom Remark atau uraian transaksi                                       |
| Verifikasi              | Tidak ada proses verifikasi independen; bendahara mencatat berdasarkan laporan warga (transfer/tunai) tanpa jejak approval |
| Pelaporan ke warga      | Tidak terstruktur/manual, kemungkinan hanya sewaktu-waktu ditanya                                                          |
| Akses warga             | Tidak ada. Warga tidak bisa melihat status iuran sendiri secara mandiri                                                    |
| Risiko utama            | Human error pencatatan, single point of failure (1 bendahara), sulit diaudit, riwayat rapel/tunggakan sulit ditelusuri     |

## 4. Kondisi Diharapkan (To-Be)

| **Aspek**               | **Kondisi To-Be**                                                                                                                                                        |
|-------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Media                   | Aplikasi web sederhana (form input + dashboard), menggantikan Google Sheets sebagai sumber kebenaran (source of truth)                                                   |
| Input transaksi         | Warga melaporkan pembayaran sendiri (jumlah, tanggal, metode, bukti/foto transfer opsional); pengeluaran tetap diinput pengurus                                          |
| Verifikasi              | Setiap laporan warga berstatus "Menunggu verifikasi" sampai pengurus/bendahara menyetujui (approve/reject) sebelum masuk saldo resmi                                     |
| Pelacakan periode iuran | Setiap transaksi wajib ditandai untuk periode bulan apa berlaku (bisa lebih dari satu bulan dalam satu transaksi, atau sebagian nominal untuk jenis iuran tertentu saja) |
| Dashboard               | Ringkasan saldo kas berjalan, status lunas/tunggak per warga per bulan, grafik pemasukan vs pengeluaran                                                                  |
| Akses warga             | Warga login (akun sederhana per unit rumah) untuk melihat riwayat pembayaran sendiri dan submit laporan bayar baru                                                       |
| Akses pengurus          | Pengurus/bendahara melihat semua data, approve/reject laporan warga, input pengeluaran, generate laporan bulanan                                                         |
| Audit trail             | Setiap perubahan data (siapa input, siapa approve, kapan) tercatat dan tidak bisa dihapus permanen                                                                       |

## 5. Analisis Gap As-Is vs To-Be

| **Gap**                                     | **Dampak jika Tidak Ditangani**                                                             | **Prioritas** |
|---------------------------------------------|---------------------------------------------------------------------------------------------|---------------|
| Tidak ada pelacakan periode iuran eksplisit | Sulit menagih tunggakan akurat; sengketa "saya sudah bayar bulan itu" tidak bisa dibuktikan | Tinggi        |
| Tidak ada verifikasi berlapis               | Kesalahan pencatatan tidak terdeteksi; ketergantungan penuh pada 1 orang                    | Tinggi        |
| Warga tidak bisa self-check status          | Warga terus bertanya manual ke bendahara; beban administratif tinggi                        | Sedang        |
| Tidak ada audit trail                       | Tidak bisa ditelusuri siapa mengubah data apa; risiko saat audit tahunan                    | Sedang        |
| Laporan tidak otomatis                      | Waktu pengurus habis untuk rekap manual tiap bulan                                          | Sedang        |

## 6. User Story dan Use Case

### 6.1 Peran Pengguna

- Warga: penghuni unit rumah, melaporkan pembayaran iuran, melihat riwayat dan status sendiri.

- Bendahara: menginput pengeluaran, memverifikasi laporan warga, mengelola data master warga.

- Ketua RT/Pengurus: melihat laporan ringkasan, approval pengeluaran besar (opsional), tidak input harian.

### 6.2 User Story

1.  Sebagai warga, saya ingin melaporkan bahwa saya sudah transfer iuran bulan ini, agar tercatat tanpa harus menghubungi bendahara secara manual.

2.  Sebagai warga, saya ingin melihat riwayat pembayaran dan status tunggakan saya sendiri, agar saya tahu apakah ada bulan yang belum terbayar.

3.  Sebagai bendahara, saya ingin memverifikasi setiap laporan pembayaran warga sebelum masuk ke saldo resmi, agar data kas tetap akurat dan bisa dipertanggungjawabkan.

4.  Sebagai bendahara, saya ingin mencatat satu transaksi untuk beberapa periode bulan sekaligus (rapel), agar histori pembayaran tetap benar meski warga membayar tidak tepat waktu.

5.  Sebagai bendahara, saya ingin mencatat pengeluaran rutin (honor security, iuran sampah ke pihak ketiga) dan pengeluaran ad-hoc, agar saldo kas selalu mencerminkan kondisi riil.

6.  Sebagai pengurus, saya ingin melihat dashboard ringkasan bulanan (saldo, jumlah warga lunas/tunggak, grafik arus kas), agar bisa mengambil keputusan tanpa membuka data mentah.

7.  Sebagai pengurus, saya ingin sistem menyimpan jejak siapa mengubah data apa dan kapan, agar bisa diaudit bila terjadi perselisihan.

## 7. Kebutuhan Fungsional dan Non-Fungsional

### 7.1 Kebutuhan Fungsional

| **ID** | **Requirement**                                                                                                                      | **Prioritas** |
|--------|--------------------------------------------------------------------------------------------------------------------------------------|---------------|
| F-01   | Warga dapat submit laporan pembayaran (nominal, tanggal, metode, periode bulan yang dibayar, opsional upload bukti transfer)         | Wajib         |
| F-02   | Satu laporan pembayaran dapat mencakup lebih dari satu periode bulan atau nominal parsial per jenis iuran (sampah/security terpisah) | Wajib         |
| F-03   | Setiap laporan warga berstatus default "Menunggu verifikasi" dan tidak memengaruhi saldo resmi sampai disetujui pengurus             | Wajib         |
| F-04   | Pengurus dapat menyetujui (approve) atau menolak (reject dengan alasan) laporan warga                                                | Wajib         |
| F-05   | Bendahara dapat menginput transaksi pengeluaran dengan kategori (honor security, iuran sampah pihak ketiga, operasional, lain-lain)  | Wajib         |
| F-06   | Sistem menghitung saldo kas berjalan otomatis (akumulatif) setiap kali transaksi disetujui/diinput                                   | Wajib         |
| F-07   | Warga dapat melihat riwayat pembayaran dan status lunas/tunggak per bulan miliknya sendiri                                           | Wajib         |
| F-08   | Pengurus dapat melihat status lunas/tunggak seluruh 34 unit per bulan dalam satu tampilan                                            | Wajib         |
| F-09   | Dashboard menampilkan saldo kas terkini, grafik arus kas bulanan, dan daftar warga menunggak                                         | Wajib         |
| F-10   | Sistem mencatat log audit (siapa, aksi apa, kapan) untuk setiap input/approve/edit transaksi                                         | Wajib         |
| F-11   | Data master 34 unit warga (blok, nama, kontak) dapat dikelola (tambah/edit) oleh bendahara                                           | Wajib         |
| F-12   | Ekspor laporan bulanan ke PDF/Excel untuk arsip atau dibagikan ke warga                                                              | Sebaiknya ada |
| F-13   | Notifikasi ke warga saat laporan disetujui/ditolak                                                                                   | Sebaiknya ada |
| F-14   | Import data historis dari Google Sheets (2020-2026) sebagai riwayat awal sistem                                                      | Sebaiknya ada |

### 7.2 Kebutuhan Non-Fungsional

| **ID** | **Requirement**                                                                                                                 |
|--------|---------------------------------------------------------------------------------------------------------------------------------|
| NF-01  | Setiap warga hanya bisa melihat dan mengedit data miliknya sendiri, tidak bisa melihat data warga lain (kecuali pengurus)       |
| NF-02  | Autentikasi minimal berbasis nomor unit rumah + PIN/password sederhana (tidak perlu OTP/SSO kompleks untuk skala 34 unit)       |
| NF-03  | Sistem dapat diakses dari HP (responsive/mobile-friendly), karena warga kemungkinan besar akan mengakses lewat HP               |
| NF-04  | Data transaksi tidak dapat dihapus permanen oleh siapapun; penghapusan hanya berupa pembatalan (soft delete) dengan jejak audit |
| NF-05  | Backup data otomatis berkala untuk mencegah kehilangan data kas                                                                 |

## 8. Risiko dan Pertimbangan

- **Kompleksitas naik signifikan dengan model self-service warga: butuh autentikasi per unit, alur approval, dan penanganan sengketa ("saya klaim sudah bayar, sistem bilang belum"). Ini bukan proyek Excel-ke-formula lagi, melainkan aplikasi multi-user dengan manajemen akun.**

- Adopsi warga adalah risiko non-teknis terbesar: jika warga tidak terbiasa pakai aplikasi (preferensi WhatsApp/transfer manual), fitur self-service bisa tidak terpakai dan sistem tetap bergantung pada bendahara menginput manual atas nama warga.

- Migrasi data historis dari Google Sheets (2020-2026, format tidak konsisten, banyak sheet campur aduk) akan memakan waktu signifikan jika ingin riwayat lengkap terbawa; disarankan mulai fresh dengan saldo awal dari saldo akhir Sheets, dan riwayat lama tetap diarsipkan terpisah sebagai referensi.

- Kolom Remark bebas teks pada data lama (contoh: "NOVEMBER DESEMBER 2025") tidak terstruktur dan tidak bisa diparse otomatis secara andal; migrasi periode iuran historis kemungkinan perlu diinput ulang manual per baris.

## 9. Alur Data (Ringkasan)

Alur detail disertakan sebagai diagram terpisah pada saat implementasi. Ringkasan tekstual:

1.  Warga login → submit laporan pembayaran (nominal, tanggal, periode bulan, jenis iuran, bukti opsional).

2.  Laporan masuk status "Menunggu verifikasi", tidak memengaruhi saldo.

3.  Bendahara meninjau → approve (masuk ke ledger resmi, saldo terupdate) atau reject (kembali ke warga dengan alasan).

4.  Bendahara input transaksi pengeluaran langsung ke ledger resmi (tidak perlu approval berlapis untuk pengeluaran rutin).

5.  Sistem menghitung status lunas/tunggak per warga per bulan berdasarkan akumulasi transaksi yang disetujui dan periode yang ditandai.

6.  Dashboard dan laporan bulanan ditarik otomatis dari ledger resmi.

## 10. Lampiran: Skema Iuran Saat Ini

| **Jenis Iuran** | **Nominal/Bulan/Unit** | **Jumlah Unit** |
|-----------------|------------------------|-----------------|
| Sampah          | Rp 35.000              | 34 unit         |
| Security        | Rp 140.000             | 34 unit         |
| Total per unit  | Rp 175.000             | \-              |

*Catatan: sebagian warga (contoh: Santo) tercatat hanya membayar komponen security (Rp140.000) tanpa sampah pada beberapa periode — perlu konfirmasi ke bendahara apakah ini pengecualian permanen atau keterlambatan pembayaran sampah yang belum terselesaikan.*
