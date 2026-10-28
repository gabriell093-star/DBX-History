# DBX History — S1

Arsip kompetitif komunitas Death Battle Xtreme berdasarkan PRD dan UI/UX Requirements v1.0 (27 Oktober 2026).

## Aplikasi
- Website responsif: beranda, arsip dan detail turnamen, daftar juara pertama terverifikasi, profil Debatter, serta statistik dari catatan yang tersedia.
- Login admin di website memakai **username + kata sandi**, bukan kolom Gmail.
- Username dipetakan oleh Edge Function username-login ke akun Supabase Auth yang sudah disetujui. Email hanya merupakan identitas backend Supabase; email tidak ditampilkan di formulir situs dan fitur login tidak mengirim email.
- Dashboard admin untuk mengelola turnamen, Debatter, gelar juara, pertandingan, karakter, tier, partisipasi, penggunaan karakter; unggah gambar ke Storage; audit log.
- Open Graph/Twitter Card dan gambar preview sosial 1200×630 pada public/dbx-og-image.png.
- Konfigurasi static-site Vercel di vercel.json.

## Menjalankan lokal
Jalankan python -m http.server 4173 dari root repo lalu buka http://localhost:4173.

## Login admin
Akun Auth yang sudah ada pada project tersambung telah dipetakan menjadi username **gabriellumbantoruan093** dan dimasukkan ke public.admin_users. Gunakan username tersebut dengan kata sandi akun Supabase Auth yang dibuat sebelumnya.
- Form login browser hanya meminta username dan kata sandi.
- Edge Function: supabase/functions/username-login/index.ts, aktif pada project qtzailwtwasgbmvinmxz.
- Tabel pemetaan username dilindungi RLS. Pemetaan hanya dapat dibaca backend Edge Function, bukan klien anon.
- Jika kata sandi tidak diketahui, jangan bagikan kata sandi di chat. Reset kata sandi melalui Supabase Dashboard. Karena email backend mungkin Gmail, reset via email tetap memakai alamat Auth tersebut. Jika benar-benar ingin tanpa alamat Gmail yang tersimpan, buat akun internal baru dengan alias email non-Gmail dan auto-confirm, lalu perbarui mapping administrator.

### Menyiapkan admin pertama pada project baru
1. Buat user melalui Supabase Dashboard → Authentication → Users dengan alamat email yang diterima Supabase dan kata sandi kuat.
2. Terapkan migrasi skema utama, indeks, dan 202610280001_admin_usernames.sql.
3. Pastikan hanya ada satu user Auth yang dimaksudkan sebagai administrator sebelum menjalankan supabase/setup-first-admin.sql; skrip menolak otomatis jika jumlah user bukan satu.
4. Username dihasilkan dari bagian sebelum @ pada email, dengan karakter yang tidak didukung dihapus. Hanya user yang terdaftar pada admin_users dapat memakai dashboard.
5. Jangan pernah menyimpan service-role/secret key pada frontend atau repositori.

## Database & integritas
Semua tabel publik memakai RLS; gelar hanya dipublikasikan untuk status verified atau corrected dan jika Debatter serta turnamennya dipublikasikan. Statistik menggunakan data yang tersedia dan tidak mengklaim rekor sepanjang masa bila arsip belum lengkap. Data historis tidak diisi dengan angka rekaan.

## Share preview
Tag Open Graph dan Twitter Card tersedia di index.html; gambar pratinjau menggunakan URL absolut GitHub Raw. Platform media sosial dapat menyimpan cache metadata lama; lakukan scrape ulang jika preview lama masih muncul.

## Deploy Vercel
- Repository: gabriell093-star/DBX-History
- Production branch: main
- Framework: Other / static site
- Root directory: root repo
- Output directory: . (karena index.html ada di root)
- Domain: https://dbx-history.vercel.app/

Jika masih 404 meski deployment Ready dan domain Valid Configuration, periksa URL Visit pada deployment Production terbaru serta pastikan alias domain menempel ke deployment yang sama.
