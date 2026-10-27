# DBX History — S1

Arsip kompetitif komunitas Death Battle Xtreme berdasarkan PRD dan UI/UX Requirements v1.0 (27 Oktober 2026).

## Aplikasi
- Website responsif: beranda, arsip dan detail turnamen, daftar juara pertama terverifikasi, profil Debatter, serta statistik dari catatan yang tersedia.
- Dashboard admin memakai Supabase Auth; login situs memakai **username + kata sandi**, bukan Gmail. Di belakang layar Supabase Auth memakai alias internal `<username>@dbx-history.vercel.app`; alias tersebut tidak dipakai untuk menerima email.
- CRUD admin untuk turnamen, Debatter, gelar, pertandingan, karakter, tier, partisipasi, dan penggunaan karakter.
- Upload gambar ke bucket `dbx-assets`, kontrol akses RLS, dan audit log.
- Open Graph/Twitter Card dan gambar preview sosial 1200×630 pada `public/dbx-og-image.png`.
- Konfigurasi statis Vercel pada `vercel.json`.

## Menjalankan lokal
Jalankan `python -m http.server 4173` dari root repo lalu buka http://localhost:4173.

## Setup admin tanpa Gmail
1. Buka Supabase Dashboard → **Authentication → Users → Add user → Create new user**.
2. Isi email internal sesuai username yang akan dipakai di website. Contoh jika username adalah `gabriel`, email internalnya `gabriel@dbx-history.vercel.app`. Buat kata sandi yang kuat dan aktifkan **Auto Confirm User** jika opsi ditampilkan. Alamat ini bukan kotak surat; jangan mengandalkan email untuk reset password.
3. Setelah user dibuat, buka **SQL Editor** dan ganti username `gabriel` pada contoh ini jika memilih username lain. Query mencari UUID otomatis sehingga UUID tidak perlu disalin:
```sql
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('gabriel@dbx-history.vercel.app')
  limit 1;

  if v_user_id is null then
    raise exception 'User internal gabriel@dbx-history.vercel.app belum ditemukan di Authentication → Users.';
  end if;

  insert into public.admin_users (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;
end $$;
```
4. Buka situs → Admin dan login dengan username `gabriel` serta kata sandi tadi. Jangan ketik email pada form login situs.
5. Jangan mengaktifkan signup publik untuk admin. Hak administrator tetap berasal dari `admin_users` dan kebijakan RLS.

## Database
Skema sudah diterapkan pada project Supabase DBX. SQL sumber tersedia di `supabase/migrations/`. Semua tabel publik memakai RLS; gelar publik dibatasi pada status `verified` / `corrected`, dan statistik hanya memakai data yang tersedia.

## Berbagi tautan
Tag Open Graph dan Twitter Card tersedia pada `index.html`, menggunakan gambar absolut dari repo publik. Platform media sosial dapat menyimpan cache preview; scrape ulang URL produksi jika metadata lama masih muncul.

## Deploy Vercel
Repository: `gabriell093-star/DBX-History`, production branch `main`, static site.
- Framework preset: **Other**
- Root Directory: repo root
- Build Command: kosong / autodetect
- Output Directory: kosong / autodetect

Domain produksi: `https://dbx-history.vercel.app/`. Jika URL mengembalikan 404 meski domain berstatus valid, periksa deployment `Ready` di Vercel → Deployments, tekan Visit, lalu pastikan alias `dbx-history.vercel.app` terpasang pada deployment Production yang benar.
