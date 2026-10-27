# DBX History — S1

Arsip kompetitif komunitas Death Battle Xtreme berdasarkan PRD dan UI/UX Requirements v1.0 (27 Oktober 2026).

## Isi saat ini
- Beranda responsif, navigasi dan kredit founder (Gabriel & Daffxy).
- Daftar turnamen dengan pencarian dan filter status/tahun; halaman detail turnamen.
- Arsip juara pertama yang mengambil gelar terverifikasi/koreksi saja, dengan profil dan riwayat gelar.
- Fun Fact hanya saat tersedia data pendukung; statistik dibatasi pada catatan yang dapat dibaca publik dan tidak mengklaim rekor sepanjang masa bila arsip belum lengkap.
- Area admin terlindungi Supabase Auth dan membership `admin_users`, CRUD untuk turnamen, Debatter, gelar, pertandingan, karakter, tier, partisipasi, dan penggunaan karakter; unggah gambar ke Storage dan audit log.
- Metadata Open Graph/Twitter Card dan gambar pratinjau sosial `public/dbx-og-image.png`.
- Konfigurasi static-site Vercel di `vercel.json`.

## Menjalankan lokal
Jalankan server statis dari root repo:
```bash
python -m http.server 4173
```
Buka http://localhost:4173. Karena menggunakan JavaScript modules, jangan buka `index.html` langsung melalui `file://`.

## Supabase
Proyek tersambung ke Supabase. Skema dan RLS diterapkan pada proyek `qtzailwtwasgbmvinmxz`. SQL awal dan indeks FK terdokumentasi di `supabase/migrations/`.

### Membuat administrator
1. Di Supabase Dashboard, buka **Authentication → Users**, lalu buat user menggunakan email dan password administrator.
2. Salin UUID user tersebut.
3. Di **SQL Editor**, jalankan:
   ```sql
   insert into public.admin_users (user_id)
   values ('UUID-USER-ADMIN');
   ```
4. Buka website lalu **Admin** untuk login. Login saja tidak memberi hak admin; UUID pada tabel `admin_users` dan kebijakan RLS menentukan akses.
5. Batasi pembuatan akun sesuai kebijakan komunitas. Jangan memasukkan service-role/secret key ke frontend.

## Aturan data
- Status turnamen diatur administrator, tidak dihitung otomatis dari tanggal.
- Gelar hanya ditampilkan untuk status `verified` atau `corrected`, serta jika Debatter dan turnamennya dipublikasikan.
- Statistik hanya menggunakan data sumber yang tersedia. Hindari mengklaim rekor sepanjang masa dari arsip parsial.
- Data yang belum diketahui tidak diisi dengan angka atau profil fiktif.
- Pendaftaran hanya dapat ditautkan saat statusnya aktif dan URL valid.
- DBX History dinyatakan sebagai arsip komunitas, bukan kanal resmi penyelenggara.

## Share preview
Halaman utama berisi tag Open Graph dan Twitter Card. Gambar harus dapat diakses publik tanpa login dan berukuran 1200×630:
`https://raw.githubusercontent.com/gabriell093-star/DBX-History/main/public/dbx-og-image.png`.
Platform seperti WhatsApp/Facebook menyimpan cache pratinjau; setelah deployment, uji URL produksi dan gunakan alat debugger berbagi Facebook bila metadata lama masih tersimpan.

## Deploy Vercel
1. Pastikan project Vercel terhubung ke repository `gabriell093-star/DBX-History` dan branch produksi `main`.
2. Gunakan **Framework Preset: Other**, root directory repo (root/blank), tanpa build command atau output directory khusus untuk static site ini.
3. Push commit ke `main` atau pilih **Redeploy** pada dashboard setelah Git terkoneksi.
4. Buka URL produksi dan periksa `/`, `/#/tournaments`, `/#/champions`, `/#/fun-fact`, serta `/#/admin`.
5. Jika URL publik Vercel berbeda dari nama proyek default, perbarui alamat gambar OG absolute di `index.html` hanya jika host gambar dipindah; gambar sekarang sengaja dilayani dari GitHub raw agar crawler bisa mengambilnya.
