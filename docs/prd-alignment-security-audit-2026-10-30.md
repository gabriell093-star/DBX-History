# Audit Kesesuaian PRD & Keamanan — DBX History S1

Tanggal audit: 30 Oktober 2026  
Basis: PRD DBX History S1 v1.0 (27 Oktober 2026), source `main` pada commit `754683523136ebbc9aea7a9140c700660caa4f62`, konfigurasi live Supabase, dan deployment produksi Vercel.

## Ringkasan

**Status keseluruhan: PARTIAL — fondasi utama tersedia, tetapi belum layak dinyatakan patuh penuh terhadap PRD.**

DBX History sudah mempunyai tiga area publik, struktur arsip turnamen, daftar dan profil juara, beberapa Fun Fact, workspace Founder, RLS, login dengan pembatasan percobaan, serta audit log. Namun, ada kesenjangan kebijakan/produk yang harus diputuskan sebelum menambah fungsi yang mengubah alur atau struktur data.

Semua tabel konten inti dan audit log yang diperiksa saat audit berisi 0 baris. Karena itu, pemeriksaan kode dan database dapat dilakukan, tetapi alur nyata dengan contoh turnamen, juara, hasil pertandingan, dan statistik belum dapat dibuktikan end-to-end. Tidak ada data contoh yang dimasukkan ke produksi.

## 1. Pemahaman prinsip PRD

PRD menetapkan DBX History sebagai **arsip dokumentasi kompetitif komunitas**, bukan platform pendaftaran internal, sistem bracket langsung, atau sistem pertandingan. Data yang tidak diketahui tetap kosong; statistik hanya ditampilkan bila sumber dan metode hitung memadai; gelar utama S1 hanya untuk juara pertama yang dikonfirmasi. Tier juga harus mengikuti aturan resmi yang dikonfirmasi, bukan perkiraan admin.

## 2. Otoritas dan hak akses

| Area | Status | Temuan |
|---|---|---|
| Login administrator | PASS (struktur) | Username/password dipetakan ke Supabase Auth melalui Edge Function. Akses admin baru diberikan setelah sesi valid. |
| Otorisasi penulisan | PASS (kebijakan live) | RLS tabel arsip mengizinkan perubahan hanya jika user memiliki membership `founder`. UI juga memeriksa role Founder sebelum membuka workspace. |
| Jumlah akun aktif | PASS (konfigurasi saat audit) | Terdapat tiga membership Founder yang aktif. Tidak ada akun dengan role `editor` pada database saat audit. |
| Role Editor | GAP / perlu keputusan | Constraint database menerima `founder` dan `editor`, tetapi UI menolak role selain Founder dan kebijakan RLS tidak memberikan kewenangan menulis kepada Editor. Jadi role Editor saat ini hanya ada sebagai nilai skema, bukan hak akses yang berfungsi. |
| Pengelolaan admin | PARTIAL | Tidak ada menu untuk Founder menambah, menonaktifkan, mengubah role, atau mengganti username admin. Pemetaan dilakukan melalui pengaturan database/SQL yang terpisah. |
| Audit log | PASS (struktur), PARTIAL (cakupan UI) | Trigger mencatat INSERT/UPDATE/DELETE delapan tabel kompetitif dengan identitas admin dan snapshot data lama/baru. UI Audit Log hanya menampilkan 100 perubahan terbaru dan tidak menyediakan pagination. |

**Kesesuaian PRD:** PRD 5.2 menyebut Founder dan administrator yang diberi wewenang. Implementasi aktual saat ini adalah model Founder-only. Ini aman dan konsisten bila memang hanya Founder yang akan mengelola konten, tetapi belum memenuhi model delegasi Editor/Admin apabila itu yang dimaksud dalam PRD.

## 3. Audit Turnamen

| Kebutuhan | Status | Temuan |
|---|---|---|
| Daftar, pencarian, filter status/tahun | PASS (kode) | Daftar dinamis memakai record yang dapat dibaca publik, dengan pencarian nama/penyelenggara dan filter status/tahun. |
| Data terstruktur FR-02/FR-03 | PASS (struktur) | Tersedia nama, penyelenggara, tanggal mulai/akhir, status, tier, poster, deskripsi, aturan, format, hadiah, ketentuan peserta, URL pendaftaran, dan ringkasan hasil. Field opsional dapat kosong. |
| Lima status turnamen | PASS (struktur) | Database membatasi status ke upcoming, ongoing, completed, postponed, dan cancelled. |
| Poster FR-04 | PARTIAL | Poster dapat disimpan dan ditampilkan, tetapi poster harus tetap diperlakukan sebagai sumber pendukung; isi pentingnya harus dicatat di field terstruktur dan diperiksa saat ada perbedaan informasi. Tidak ada mekanisme otomatis untuk membaca/memverifikasi poster. |
| Pendaftaran WhatsApp FR-05 | PARTIAL | CTA detail record hanya muncul ketika `registration_open` aktif dan URL HTTPS valid. Namun, halaman daftar juga memiliki panel unggulan Open Registration yang hardcoded pada kode, memuat poster, nominal hadiah, periode, dan dua tautan WhatsApp statis. Panel itu tidak membaca `registration_open`, tidak dapat dimatikan dari Admin, dan tidak mengikuti perubahan data turnamen. |
| Arsip turnamen selesai FR-06 | PARTIAL | Status completed tetap menjadi record turnamen dan tidak dihapus otomatis. Namun belum ada status arsip/soft-delete yang terpisah; operasi Hapus masih tersedia di workspace untuk record yang tidak sedang direferensikan, sedangkan menyembunyikan publikasi bukan hal yang sama dengan mengarsipkan. |
| Tier resmi FR-10 | PARTIAL | Entitas Tier memiliki nama, deskripsi, tanggal berlaku, sumber referensi, dan flag aktif. Sistem belum dapat memastikan kebenaran referensi tersebut; definisi tier resmi sendiri masih termasuk hal yang belum ditentukan pada PRD. |

**Hal yang perlu dikonfirmasi:** apakah panel registrasi unggulan harus dihapus, atau diganti menjadi panel dinamis yang mengambil turnamen dari database (misalnya dengan penanda featured). Ini mengubah UI dan sumber data sehingga tidak saya ubah tanpa persetujuan.

## 4. Audit Juara

| Kebutuhan | Status | Temuan |
|---|---|---|
| Arsip hanya juara pertama FR-07 | PASS (aturan database dan kode) | Daftar publik mengelompokkan gelar verified/corrected per Debatter. Database juga memiliki trigger yang menolak gelar verified/corrected kecuali Debatter mempunyai partisipasi confirmed dengan placement = 1 pada turnamen terkait. |
| Perlindungan hasil juara | PASS (aturan database) | Partisipasi juara pertama tidak dapat dihapus/diubah ketika gelarnya masih verified/corrected; gelar perlu dikoreksi atau diturunkan statusnya terlebih dahulu. |
| Pencegahan gelar ganda FR-09 | PASS (aturan database) | Unique constraint mencegah pasangan Debatter-turnamen yang sama dicatat sebagai gelar berulang. |
| Profil FR-08 | PARTIAL | Profil mendukung nama, foto, deskripsi, riwayat gelar, tier/tanggal turnamen, riwayat pertandingan, lawan/skor jika tersedia, penggunaan karakter, serta statistik menang/kalah/win rate. Riwayat pertandingan yang ditampilkan dibatasi ke delapan pertandingan terbaru. Bracket visual khusus belum tersedia; ringkasan hasil dapat dicatat sebagai teks di turnamen. |
| Kaitan ke status turnamen | PARTIAL / perlu keputusan | Database memastikan partisipasi juara pertama berstatus confirmed, tetapi belum memaksa status turnamen menjadi completed sebelum gelar dapat diverifikasi. Apakah status completed harus menjadi prasyarat tambahan perlu disepakati. |

**Catatan integritas tambahan:** aturan juara pertama sudah lebih kuat daripada sekadar validasi formulir karena ditegakkan di database. Ini perlu dipertahankan. Yang belum dipastikan adalah apakah satu turnamen selalu hanya boleh memiliki tepat satu Debatter juara pertama, terutama bila ada hasil seri/juara bersama; PRD belum menetapkan aturan tersebut.

## 5. Audit Fun Fact dan statistik

| Kategori PRD | Status implementasi |
|---|---|
| Debatter dengan kemenangan terbanyak | Ada sebagai Most Wins, berdasarkan pertandingan selesai dengan pemenang valid yang dapat dibaca publik. |
| Win streak terpanjang | Ada; streak hanya dihitung jika urutan pertandingan yang digunakan memiliki tanggal. Tetap perlu aturan urutan jika dua pertandingan Debatter memiliki timestamp yang sama. |
| Jumlah gelar terbanyak | Ada; sumbernya tabel gelar verified/corrected, bukan jumlah kemenangan pertandingan. |
| Karakter paling sering digunakan | Ada; sumbernya catatan penggunaan karakter yang dapat dibaca publik. |
| Win rate Debatter | Ada di profil masing-masing Debatter bila pertandingan tersedia; belum menjadi kartu peringkat global di Fun Fact. |
| Win rate karakter dan statistik matchup | Belum diaktifkan. Ini boleh ditunda sampai format pertandingan dan aturan penggunaan karakter DBX dikonfirmasi serta data memadai. |
| Jumlah partisipasi turnamen | Ada; hanya menghitung partisipasi confirmed pada turnamen publik. |

Fun Fact membedakan cakupan data tersedia dari klaim rekor sepanjang masa dan tidak mengisi statistik yang tidak tersedia dengan angka nol. Saat audit belum ada record, sehingga semua kartu statistik publik memang belum dapat dibuktikan dengan data riil.

**Bug/risiko hitung yang ditemukan:** dua pertandingan pada timestamp yang sama dapat diurutkan berdasarkan ID, padahal ID bukan urutan pertandingan yang disahkan. Hal ini dapat mengubah hasil win streak. Ada pula penanganan error penggunaan karakter di profil yang saat ini mengubah kegagalan query menjadi keadaan kosong, sehingga kegagalan pemuatan dapat terlihat seperti tidak ada data. Kedua perubahan ini memengaruhi konten/state yang terlihat dan perlu persetujuan sebelum saya ubah.

## 6. Kesesuaian lintas kebutuhan PRD

| PRD | Status | Temuan |
|---|---|---|
| FR-01 Beranda | PASS (struktur) | Beranda mengarahkan ke tiga fitur utama dan menyebut prinsip arsip. Kredit Founder perlu diselaraskan dengan dokumen (lihat FR-15). |
| FR-15 Kredit Founder | PERLU KEPUTUSAN | PRD mencantumkan Gabriel dan Daffxy, sedangkan website saat ini menampilkan Gabriel, Daffxy, dan Maru. Saya tidak mengubah salah satunya tanpa keputusan Anda. |
| FR-16 Identitas arsip komunitas | PASS (teks) | Website menyebut dirinya arsip komunitas dan menjelaskan bahwa ia bukan kanal resmi penyelenggara. |
| FR-17 Pengelolaan konten | PARTIAL | CRUD untuk turnamen, Debatter, gelar, pertandingan, karakter, penggunaan karakter, partisipasi, dan tier tersedia. Namun alur arsip/soft-delete dan delegasi Editor belum lengkap. |
| FR-18 Verifikasi dan riwayat perubahan | PARTIAL | Status draft/needs_verification/verified/corrected tersedia untuk gelar. Untuk turnamen, Debatter, Tier dan hasil pertandingan belum ada lifecycle verifikasi umum yang setara; audit log mencatat perubahan tetapi tidak menggantikan status verifikasi. |
| NFR 10.5 Backup/pemulihan | BELUM TERVERIFIKASI | Dari akses yang tersedia pada audit ini belum ada bukti konfigurasi backup, retensi, prosedur restore, dan uji pemulihan. |
| Aturan bisnis pemisahan data uji/produksi | BELUM TERVERIFIKASI | Belum ada bukti environment staging terpisah yang diuji. Jangan masukkan data uji ke produksi. |

## 7. Audit keamanan dan kualitas

### Kontrol yang sudah ada

- Semua tabel inti yang diperiksa menggunakan RLS.
- Penulisan tabel arsip dikunci oleh membership Founder, bukan hanya oleh UI.
- Login menggunakan Edge Function; secret/service-role key hanya diakses dari server.
- Endpoint login membatasi Origin, metode, Content-Type, ukuran request, dan format username; memberi pesan kredensial generik; serta membatasi percobaan berdasarkan hash username dan IP.
- Storage membatasi unggah/perubahan/penghapusan ke Founder; pembacaan publik pada bucket aset sesuai kebutuhan poster/foto publik.
- Audit log memakai trigger database dan dibatasi baca ke Founder.
- Header produksi mencakup CSP, HSTS, clickjacking protection, MIME sniffing protection, dan Permissions Policy.

### Perbaikan langsung yang sudah dilakukan

**Privilege tabel database diperketat melalui migrasi `20261030024552_least_privilege_archive_table_grants`.** Sebelumnya, privilege efektif pada role `anon` dan `authenticated` mencakup operasi SQL yang tidak diperlukan seperti TRUNCATE/REFERENCES/TRIGGER; privilege ini tidak dikendalikan oleh RLS. Kini:
- `anon` hanya memiliki SELECT pada tabel arsip publik; tidak lagi memiliki INSERT/UPDATE/DELETE/TRUNCATE.
- `authenticated` tetap memiliki SELECT dan CRUD agar sesi Founder bisa bekerja, tetapi tidak memiliki TRUNCATE/REFERENCES/TRIGGER; RLS tetap mensyaratkan role Founder.
- `admin_users` dan `audit_logs` tidak dapat dibaca oleh `anon`; authenticated hanya memiliki SELECT yang tetap dibatasi RLS.
- Hak service_role untuk proses server tidak diubah.

Hak efektif telah diperiksa ulang setelah migrasi: anon/authenticated tidak lagi memiliki privilege TRUNCATE pada tabel-tabel tersebut. Perubahan ini tidak mengubah UI atau alur CRUD Founder.

### Temuan yang masih perlu ditangani

1. **Peringatan Auth:** Supabase Security Advisor melaporkan leaked-password protection belum aktif. Aktifkan pemeriksaan password bocor melalui konfigurasi Auth setelah persetujuan, karena ini mengubah kebijakan penerimaan/perubahan password.
2. **MFA:** aplikasi belum memaksa tingkat autentikasi MFA/AAL2 sebelum membuka workspace. Penerapan membutuhkan penyesuaian autentikasi dan kesiapan seluruh Founder agar tidak terkunci.
3. **Relasi penggunaan karakter:** database memastikan match dan Debatter valid, tetapi belum memastikan Debatter pada `match_characters` adalah peserta A atau B dari match tersebut. Catatan yang salah dapat mengotori statistik karakter dan profil.
4. **Konsistensi migration source:** migration history live Supabase memuat `preserve_competitive_history_on_delete` dan `enforce_valid_champion_and_match_records`, tetapi file SQL dengan nama/version tersebut belum ditemukan di repository. Ini menimbulkan risiko environment baru tidak mereplikasi seluruh aturan database live. Perlu rekonsiliasi source migration sebelum membuat staging atau melakukan restore/reset.
5. **Backup/staging:** belum terverifikasi; perlu bukti konfigurasi dan uji restore terpisah dari produksi.
6. **Kinerja:** advisor menandai beberapa index belum terpakai dan beberapa SELECT policy permissive ganda. Index yang belum terpakai kemungkinan karena tabel masih kosong; jangan hapus berdasarkan temuan ini saja. Policy SELECT yang tumpang tindih berasal dari gabungan akses publik baca dan Founder manage, bukan bukti bypass otorisasi.

## 8. Persetujuan yang dibutuhkan sebelum perubahan lintas fitur

1. **Model otoritas:** tetap Founder-only, atau perlu role Editor/Admin yang dapat ditugaskan? Jika perlu Editor, tentukan apakah boleh CRUD semua konten, tetapi tidak boleh mengelola akun, tier resmi, dan Audit Log.
2. **Panel registrasi unggulan:** hapus panel statis, atau jadikan panel dinamis dari data turnamen dan status registrasi database?
3. **Lifecycle verifikasi:** apakah status draft/needs_verification/verified/corrected perlu diterapkan ke Turnamen, Debatter, Tier, dan hasil pertandingan juga? Tentukan juga apakah gelar verified mensyaratkan turnamen berstatus completed.
4. **Penggunaan karakter:** setujui validasi database dan formulir bahwa Debatter yang memakai karakter harus merupakan peserta pada pertandingan terkait?
5. **Aturan juara bersama/seri:** apakah satu turnamen hanya boleh punya satu juara pertama, atau juara bersama diperbolehkan? Ini menentukan constraint gelar dan aturan hasil.
6. **Win streak dan error state profil:** setujui agar streak tidak ditampilkan ketika urutan waktu ambigu dan kegagalan query karakter ditampilkan sebagai error, bukan empty state?
7. **Keamanan Auth:** setujui mengaktifkan leaked-password protection dan merancang MFA wajib untuk Founder?
8. **Kredit Founder:** apakah PRD diperbarui agar mencantumkan Maru, atau kredit website harus mengikuti PRD yang saat ini hanya menyebut Gabriel dan Daffxy?
9. **Operasional data:** tetapkan staging terpisah, kebijakan backup/retensi, dan uji restore.

## 9. Batas pemeriksaan

Audit ini memeriksa sumber kode, konfigurasi, kebijakan RLS, grant efektif, constraint, trigger, migration history, Supabase Security/Performance Advisor, dan status deployment. Ini bukan penetration test eksternal atau browser E2E lengkap untuk seluruh alur login/CRUD/upload. Karena seluruh tabel konten kosong, operasi CRUD berantai dan perhitungan statistik belum divalidasi menggunakan data uji pada staging.

