# Audit Workspace Admin & Keamanan — 30 Oktober 2026

## Ringkasan

Audit ini membandingkan workspace admin dan infrastruktur Supabase dengan PRD DBX History S1. Pemeriksaan dilakukan pada source code, skema database produksi, kebijakan RLS, trigger, Storage, dan konfigurasi Edge Function.

Status ini adalah snapshot pada tanggal audit. Ini bukan jaminan bahwa sistem bebas dari semua kerentanan, dan belum menggantikan pengujian browser dengan sesi Founder pada data uji yang terkontrol.

## 1. Audit Log

### Penyebab tombol tidak bekerja

Route `#/admin/audit` sebelumnya tidak dikenali sebagai section valid karena hanya key dalam konfigurasi CRUD yang diperbolehkan. Akibatnya route Audit Log dialihkan ke bagian Turnamen sebelum loader audit sempat dijalankan.

### Perbaikan

- Route Audit Log dikenali secara eksplisit.
- Log dimuat memakai pagination agar tidak berhenti di 100 baris.
- Ditambahkan tombol Muat ulang.
- Tampilan menyertakan waktu, jenis entitas, aksi, ID data, ID admin, dan detail sebelum/sesudah.
- Kondisi kosong menjelaskan bahwa fitur tetap aktif dan menunggu perubahan konten.
- Trigger database mencatat INSERT, UPDATE, dan DELETE untuk turnamen, Debatter, gelar, pertandingan, karakter, tier, partisipasi, dan penggunaan karakter.

### Kondisi data saat audit

Tabel `audit_logs` berisi 0 baris dan tabel konten kompetitif juga belum memiliki entri. Karena itu, layar kosong setelah perbaikan adalah keadaan yang sah sampai ada perubahan konten nyata. Jangan membuat perubahan produksi hanya demi mengisi contoh log.

## 2. Workspace Admin dibandingkan dengan PRD

| Area | Pemeriksaan dan perubahan |
|---|---|
| Turnamen | Form berisi nama, penyelenggara, jadwal, status, Tier resmi, poster, deskripsi, peraturan, format, hadiah, ketentuan peserta, pendaftaran WhatsApp/URL, ringkasan hasil, dan publikasi. |
| Publikasi / arsip | Ditambahkan aksi Publikasikan / Arsipkan. Konten dapat disembunyikan tanpa menghapus catatan historis. |
| Debatter | Profil, foto, deskripsi, publikasi, serta validasi nama duplikat. |
| Gelar juara | Status draf, perlu verifikasi, terverifikasi, atau dikoreksi. Gelar terverifikasi kini mensyaratkan catatan partisipasi dengan posisi 1 dan status dikonfirmasi. |
| Pertandingan | Validasi peserta berbeda, pemenang harus salah satu peserta, skor tidak negatif, dan pertandingan berstatus selesai harus memiliki pemenang. |
| Karakter | Katalog, gambar, deskripsi, publikasi, dan relasi penggunaan karakter. |
| Penggunaan karakter | Relasi ke pertandingan, Debatter, dan karakter; duplikasi tuple dicegah oleh unique index. |
| Partisipasi | Relasi Debatter-turnamen, posisi akhir, dan status; duplikasi kombinasi dicegah oleh unique index. |
| Tier resmi | Sumber referensi, tanggal berlaku, deskripsi, dan status aktif/nonaktif. Tier tidak diisi berdasarkan perkiraan. |
| Upload | PNG/JPEG/WebP/GIF, maksimal 5 MB, validasi signature file, preview, nama file unik, dan cleanup ketika penyimpanan catatan gagal. |
| Audit | Semua mutasi pada entitas kompetitif dicatat database dan hanya dapat dibaca Founder. |

### Perlindungan riwayat

Sebelumnya beberapa foreign key memakai `ON DELETE CASCADE`, sehingga penghapusan induk berisiko menghapus catatan gelar, partisipasi, pertandingan, atau penggunaan karakter. Kebijakan foreign key terkait sekarang memakai `RESTRICT`.

Workspace juga:
- memblokir penghapusan turnamen selesai, pertandingan selesai, gelar terverifikasi, partisipasi terkonfirmasi, konten yang masih dipublikasikan, dan Tier aktif;
- memeriksa relasi sebelum penghapusan;
- mengarahkan admin untuk mengarsipkan atau mengubah status, bukan membuang sejarah.

Validasi penting juga ditegakkan di database, bukan hanya lewat form browser. Gelar verified/corrected harus memiliki waktu konfirmasi dan partisipasi juara pertama yang dikonfirmasi. Partisipasi posisi pertama itu dilindungi dari perubahan/penghapusan selama gelarnya masih terverifikasi.

## 3. Temuan Keamanan

### Kontrol yang sudah terpasang dan diverifikasi

- Seluruh tabel pada schema `public` yang diperiksa memiliki Row Level Security (RLS) aktif.
- Pembaca publik hanya mendapatkan baris yang memenuhi kondisi publikasi / verifikasi.
- Operasi tulis terhadap tabel kompetitif mensyaratkan membership dengan role `founder`, termasuk pemeriksaan pada kebijakan database.
- Tabel `admin_users` hanya mengizinkan akun membaca membership miliknya sendiri.
- `audit_logs` hanya dapat dibaca Founder.
- `admin_usernames` dan `admin_login_rate_limits` sengaja tidak memiliki policy untuk `anon` atau `authenticated`, serta tidak diberikan table privilege kepada kedua role tersebut. Backend Edge Function memakai service role. Temuan advisor RLS-tanpa-policy pada dua tabel internal ini adalah informational; jangan menambahkan policy publik.
- Frontend menggunakan Supabase publishable key. Secret/service-role key tidak dimasukkan ke bundle browser.
- Username login dipetakan ke Auth user di Edge Function. Password diverifikasi melalui Supabase Auth `signInWithPassword`; pemetaan username tidak diberikan kepada browser.
- Login endpoint memeriksa method, origin allowlist, JSON content-type, ukuran payload, format username, dan memberi pesan gagal yang generik.
- Percobaan masuk dibatasi server-side berdasarkan hash HMAC untuk IP dan username: maksimum 20 percobaan per IP serta 5 per username dalam jendela 15 menit; bucket username dibersihkan setelah login berhasil.
- Vercel sudah mengirim header HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, dan Permissions-Policy.
- Edge Function dan browser SDK dipin ke versi Supabase JS yang sama (2.118.0) agar tidak bergantung pada versi major yang berubah.

### Hal yang masih perlu tindakan Founder

**MFA belum aktif.** Pada saat audit, ketiga akun Founder yang terdaftar belum memiliki faktor MFA TOTP terverifikasi (0 dari 3). MFA belum diwajibkan oleh policy karena belum ada akun yang menyelesaikan enrollment; langsung mewajibkan AAL2 sekarang berisiko mengunci semua Founder.

Tindakan:
1. Masing-masing Founder masuk ke akun Supabase Auth miliknya dan mengaktifkan MFA TOTP melalui aplikasi authenticator.
2. Pastikan ketiga faktor berstatus verified.
3. Setelah semua siap, tambahkan pemeriksaan AAL2 untuk operasi admin berisiko tinggi dan uji seluruh akun sebelum enforcement penuh. Jangan mengaktifkannya sebelum enrollment selesai.

**Leaked Password Protection nonaktif.** Supabase Security Advisor menandai bahwa pemeriksaan kata sandi yang diketahui bocor belum diaktifkan. Aktifkan di Supabase Dashboard → Authentication → Settings / Password Security jika paket proyek mendukung fitur ini (dokumentasi Supabase menyatakan fitur ini memerlukan paket Pro atau lebih tinggi). Tetapkan minimum 12 karakter, gunakan kata sandi unik per Founder, dan jangan gunakan ulang kata sandi dari layanan lain.

**Riwayat repository.** File README dan skrip setup pada branch ini sudah tidak memuat username atau email akun aktual; skrip setup menggunakan placeholder yang wajib diganti pada salinan SQL privat. Namun, identifier yang pernah masuk ke commit terdahulu dapat tetap terlihat di Git history. Jika repository dapat diakses publik, pertimbangkan membatasi akses repository atau mengganti username login setelah koordinasi dan pembaruan mapping. Jangan memasukkan password atau secret ke repository.

## 4. Catatan penerapan dan batas pengujian

- Perubahan foreign key dan constraint database diterapkan pada proyek produksi. Tidak ada baris konten kompetitif yang terpengaruh pada saat migrasi karena tabel konten masih kosong.
- Uji sintaks JavaScript dan regression assertions dijalankan melalui GitHub Actions sebelum merge.
- Deployment Vercel/Edge Function perlu diverifikasi setelah merge.
- Tidak dilakukan CRUD browser dengan akun Founder nyata terhadap produksi: database belum memiliki data arsip, dan membuat/menghapus data fiktif pada produksi akan melanggar aturan PRD untuk memisahkan data uji dari produksi. Uji alur nyata sebaiknya memakai Supabase staging atau satu set data uji yang memang disetujui.

## 5. Rujukan

- PRD DBX History S1: FR-02 sampai FR-18, aturan bisnis, kebutuhan nonfungsional, serta kriteria penerimaan.
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Password Security: https://supabase.com/docs/guides/auth/password-security
