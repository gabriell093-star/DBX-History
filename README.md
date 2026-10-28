# DBX History — S1

Arsip kompetitif komunitas Death Battle Xtreme berdasarkan PRD dan UI/UX Requirements v1.0 (27 Oktober 2026).

## Aplikasi
- Website responsif: beranda, arsip dan detail turnamen, daftar juara pertama terverifikasi, profil Debatter, serta statistik dari catatan yang tersedia.
- Login admin di website memakai **username + kata sandi**, bukan kolom Gmail.
- Username dipetakan oleh Edge Function username-login ke akun Supabase Auth yang sudah disetujui. Email hanya merupakan identitas backend Supabase; email tidak ditampilkan di formulir situs dan fitur login tidak mengirim email.
- Dashboard admin untuk mengelola turnamen, Debatter, gelar juara, pertandingan, karakter, tier, partisipasi, penggunaan karakter; unggah gambar ke Storage; audit log.
- Open Graph/Twitter Card menggunakan gambar raster 1200×630 dari `/dbx-og-image.png` pada domain produksi. Metadata memakai satu URL gambar absolut dan cache key `v=20261028-3`.
- Konfigurasi static-site Vercel di vercel.json.

## Menjalankan lokal
Jalankan python -m http.server 4173 dari root repo lalu buka http://localhost:4173.

## Login admin
Login website menampilkan kolom username kosong dengan placeholder `Masukkan username`. Dua akun Founder yang saat ini terdaftar di database adalah `ellias8890` dan `daffxy7778`.
- Form login browser hanya meminta username dan kata sandi.
- Edge Function: supabase/functions/username-login/index.ts, aktif pada project qtzailwtwasgbmvinmxz.
- Tabel pemetaan username dilindungi RLS. Pemetaan hanya dapat dibaca backend Edge Function, bukan klien anon.
- Akun Founder saat ini sudah dibuat dan terdaftar di `public.admin_users` serta `public.admin_usernames`. Login dengan salah satu username di atas dan kata sandi yang sudah Anda tetapkan. Jangan menuliskan kata sandi di chat atau repo.
- Untuk menyiapkan instalasi baru, buat kedua akun Auth dengan email alias internal yang dijelaskan pada `supabase/setup-two-founders.sql`, konfirmasi keduanya, lalu jalankan skrip tersebut di SQL Editor.

### Otorisasi Founder
1. Database memiliki kolom `admin_users.role` (`founder` atau `editor`); saat ini hanya dua username yang disetujui ditetapkan sebagai Founder.
2. Kebijakan RLS pada tabel arsip, audit log, dan Storage mengharuskan role `founder`; login biasa tidak memberi akses edit.
3. Hak INSERT/UPDATE/DELETE ke tabel membership `admin_users` dicabut dari `anon` dan `authenticated`. Tambah atau ubah keanggotaan hanya melalui jalur administratif yang dipercaya.
4. Pada setup baru, terapkan migrasi utama, `202610280001_admin_usernames.sql`, `202610280002_founder_only_access.sql`, dan `202610280003_allow_two_founders.sql`. Untuk project saat ini, dua user Founder sudah aktif.
5. Jangan pernah menyimpan service-role/secret key pada frontend atau repositori.

## Audit PRD/UI/UX
Lihat [`docs/prd-uiux-audit.md`](docs/prd-uiux-audit.md) untuk status fitur per PRD, temuan keamanan, kekurangan yang belum terverifikasi, dan prioritas berikutnya.

## Database & integritas
Semua tabel publik memakai RLS; gelar hanya dipublikasikan untuk status verified atau corrected dan jika Debatter serta turnamennya dipublikasikan. Statistik menggunakan data yang tersedia dan tidak mengklaim rekor sepanjang masa bila arsip belum lengkap. Data historis tidak diisi dengan angka rekaan.

## Share preview
Tag Open Graph dan Twitter Card tersedia di `index.html`. Gambar pratinjau utama disajikan dari `https://dbx-history.vercel.app/dbx-og-image.png?v=20261028-3`, sehingga crawler dapat mengambil aset dari root domain produksi. Untuk menguji ulang WhatsApp setelah deployment, bagikan URL baru `https://dbx-history.vercel.app/?share=20261028-3`. Preview lama dapat tetap tersimpan di cache WhatsApp meskipun metadata website telah berubah.

## Deploy Vercel
- Repository: gabriell093-star/DBX-History
- Production branch: main
- Framework: Other / static site
- Root directory: root repo
- Output directory: . (karena index.html ada di root)
- Domain: https://dbx-history.vercel.app/

Jika masih 404 meski deployment Ready dan domain Valid Configuration, periksa URL Visit pada deployment Production terbaru serta pastikan alias domain menempel ke deployment yang sama.
