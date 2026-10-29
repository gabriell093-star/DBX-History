# DBX History S1 — Audit PRD & UI/UX
Tanggal pemeriksaan: 29 Oktober 2026 (pemeriksaan lanjutan)
Basis: PRD DBX History S1 v1.0 dan UI/UX Requirements v1.0 (27 Oktober 2026), source branch `main`, konfigurasi Supabase terkait, dan status deployment dari GitHub/Vercel.

## Ringkasan
**Fondasi produk dan struktur halaman tersedia, tetapi belum dapat dinyatakan lulus penuh.** Pemeriksaan ini mencakup source, aturan database, dan CI statis; bukan pengujian browser end-to-end seluruh alur. Semua tabel konten inti saat diperiksa berisi 0 baris. Karena itu, sebagian besar area publik seharusnya menampilkan empty state sampai data nyata dimasukkan dan diverifikasi.

Status:
- **PASS (kode/konfigurasi):** fitur dan kontrol tersedia pada source atau kebijakan yang diperiksa.
- **PARTIAL:** sebagian kebutuhan tersedia, dibatasi kelengkapan data, cakupan implementasi, atau belum diuji runtime.
- **GAP:** belum ada implementasi atau bukti cukup untuk menyatakan terpenuhi.

## Audit halaman publik

| Area | Status | Temuan |
|---|---|---|
| Beranda | PARTIAL | Identitas DBX History, tujuan arsip, tiga pintu fitur utama, dan kredit Founder Gabriel, Daffxy & Maru tersedia. Sorotan terbaru bersifat statis/tidak diambil dari data dinamis. |
| Daftar turnamen | PASS (struktur), PARTIAL (konten) | Mengambil turnamen publik, pencarian nama/penyelenggara, filter status/tahun, label status, tautan ke detail. Query kini memakai pagination, bukan berhenti pada 200/300 baris. Saat pemeriksaan: 0 turnamen tersimpan. |
| Poster turnamen | PASS (komponen) | Poster yang disetel pada `poster_url` sekarang dirender sebagai thumbnail pada daftar dan gambar utama pada detail. Poster registrasi unggulan di bagian atas daftar merupakan blok informasi khusus berdasarkan poster yang diberikan, bukan otomatis sebuah baris turnamen pada database. |
| Detail turnamen | PASS (struktur), PARTIAL (data) | Menampilkan status, deskripsi, tanggal, penyelenggara, tier, format, hadiah, aturan, ketentuan peserta, poster, hasil dan CTA pendaftaran sesuai data. CTA hanya muncul jika `registration_open` aktif dan URL valid. Tidak ada record saat audit. |
| Daftar juara | PASS (aturan kode), PARTIAL (konten) | Gelar `verified`/`corrected` dikelompokkan per Debatter agar beberapa gelar tetap terhubung ke profil yang sama. Posisi non-juara pertama tidak dicampur dalam kategori juara. Saat audit: 0 gelar dan 0 Debatter. |
| Profil juara | PASS (fitur kode), PARTIAL (data) | Menampilkan identitas, gelar terverifikasi/dikoreksi, pertandingan selesai yang terlihat publik, menang/kalah, win rate, riwayat pertandingan, dan penggunaan karakter jika tercatat. Streak terpanjang hanya ditampilkan jika seluruh pertandingan yang dipakai memiliki tanggal. Belum bisa diverifikasi dengan data nyata karena tabel kosong. |
| Fun Fact | PARTIAL | Menghitung Most Wins, Longest Win Streak jika semua pertandingan diurutkan dengan tanggal, Most Tournament Titles, Most Used Character, dan Tournament Appearances jika partisipasi terkonfirmasi. Global win rate/character win rate/matchup belum ditambahkan karena definisi minimum pertandingan dan kelengkapan data belum dikonfirmasi. PRD mengizinkan kategori tidak ditampilkan saat sumber data tidak memadai. |
| Navigasi dan status | PASS (struktur) | Hash route tersedia untuk Beranda, daftar/detail turnamen, daftar/profil juara, Fun Fact, dan Admin. Ada state loading, empty state, dan error/retry pada query utama. Pengujian semua alur via browser otomatis belum dilakukan. |

## Audit admin, data, dan keamanan

| Area | Status | Temuan |
|---|---|---|
| Pengelolaan konten | PASS (implementasi kode) | Form CRUD tersedia untuk turnamen, Debatter, gelar, pertandingan, karakter, tier, partisipasi, dan penggunaan karakter; unggah file; validasi URL pendaftaran; validasi pemenang dan peserta; konfirmasi penghapusan. Daftar admin memakai pagination tanpa batas 300 baris yang sebelumnya ada. |
| Otorisasi Founder | PASS (kebijakan yang diperiksa) | Role `founder` diperiksa pada UI dan RLS untuk penulisan tabel konten, audit log, serta operasi Storage. Keanggotaan admin tidak bisa dikelola lewat hak INSERT/UPDATE/DELETE biasa di Data API. Tiga pemetaan Founder yang terkonfirmasi di database saat pemeriksaan lanjutan adalah `ellias8890`, `daffxy7778`, dan `maru7712`, seluruhnya role `founder`. |
| Gelar dan verifikasi | PASS (struktur) | Ada status draft, perlu verifikasi, verified, corrected; gelar publik dibatasi pada verified/corrected dan relasi Debatter/turnamen yang dipublikasikan. Constraint unik mencegah gelar ganda untuk pasangan Debatter-turnamen yang sama. |
| Audit log | PASS (struktur) | Trigger mencatat insert/update/delete pada tabel kompetitif. Perubahan dapat dilihat di area audit oleh Founder. Pengujian operasional menyeluruh belum dilakukan. |
| Integritas identitas Debatter | PARTIAL | Nama baru dicek pada formulir dengan normalisasi huruf besar-kecil/spasi, dan unique index database mencegah duplikat nama normalisasi. Alur merge profil duplikat lama (termasuk relasi gelar/pertandingan) belum tersedia. Data Debatter berjumlah 0 pada pemeriksaan ini. |
| Tier resmi | PARTIAL | Form dapat menyimpan sumber referensi dan kebijakan mengharapkan verifikasi, tetapi kebenaran isi tetap perlu diperiksa Founder. Nama game, definisi tier resmi, format pertandingan, dan aturan karakter masih dinyatakan sebagai hal yang belum ditentukan dalam PRD. |
| Backup dan pemulihan | GAP / belum terverifikasi | Belum ada bukti di repo mengenai prosedur backup terjadwal, retensi, dan uji restore. Perlu menetapkan kebijakan backup Supabase serta uji pemulihan sebelum mengandalkan arsip sebagai satu-satunya catatan. |
| Data uji vs produksi | GAP / perlu keputusan | Saat audit, tabel konten produksi kosong, tetapi belum ada bukti environment staging terpisah. Gunakan project staging untuk data percobaan agar tidak tercampur ke arsip resmi. |

## Audit visual dan aksesibilitas

- **PASS pada source:** palet Evergreen Shadow `#043222` dan Almond Cream `#F6E9D9`, tipografi konsisten, indikator fokus, state hover/focus, kartu dan radius teratur, serta komponen poster tanpa blur.
- **PASS pada CSS responsive:** area Admin berubah satu kolom pada lebar ponsel; tabel berada pada kontainer yang dapat digulir; formulir disusun vertikal pada layar sempit.
- **PARTIAL:** masih dibutuhkan pemeriksaan visual langsung terhadap halaman Admin pada beberapa lebar layar dan test keyboard/fokus nyata. Audit source/CSS tidak menggantikan uji perangkat.
- **Perbaikan screenshot saat ini:** rujukan poster diubah dari path `/public/...` ke file root yang disajikan; metadata sosial sekarang memakai satu `og:image` HTTPS absolut di root domain, canonical `og:url`, ukuran 1200×630, dan cache key baru. CI memverifikasi signature dan dimensi PNG, tetapi WhatsApp dapat menyimpan cache lama; preview akhir harus diuji dengan URL share baru setelah deploy.

## Status data saat audit
Query database terhadap tabel konten inti menghasilkan:
- `tournaments`: 0
- `debatters`: 0
- `titles`: 0
- `matches`: 0
- `characters`: 0
- `participations`: 0
- `match_characters`: 0
- `tiers`: 0

Jangan isi arsip dengan data contoh yang terlihat seperti fakta. Untuk menampilkan kompetisi pada daftar dinamis, Founder harus membuat record turnamen terstruktur, memasukkan tanggal/status setelah dikonfirmasi, mengunggah poster, dan memublikasikannya. Tahun tidak boleh disimpulkan dari poster jika tidak disebutkan.

## Prioritas lanjutan
1. **P0 — Uji preview share:** bagikan URL baru setelah deployment dan periksa apakah logo tampil; jika tidak, verifikasi HTTP 200 dan content type gambar publik, serta gunakan debugger crawler yang sesuai.
2. **P1 — Isi data terverifikasi:** buat record turnamen pertama dan hubungan Debatter/gelar hanya dari sumber yang dikonfirmasi.
3. **P1 — Backup/restore:** dokumentasikan backup, retensi, prosedur restore, lalu uji dengan project staging.
4. **P2 — Profil duplikat:** rancang deteksi dan alur merge Debatter tanpa mengubah riwayat gelar.
5. **P2 — Statistik lanjutan:** tambahkan kategori Fun Fact bila data valid, definisi kompetisi sudah dipastikan, dan aturan minimal pertandingan untuk win rate dapat disetujui.
6. **P2 — QA browser:** uji enam halaman publik, operasi CRUD, RLS langsung, upload poster, perilaku error, keyboard, dan tata letak desktop/mobile dengan data staging.

## Bukti otomatis yang tersedia
GitHub Actions memeriksa sintaks JS, tag Open Graph/Twitter, signature/dimensi PNG, keberadaan poster SVG dan kedua tautan WhatsApp, placeholder username, pagination, fitur statistik profil, aturan output Vercel, dan responsive admin CSS. Pemeriksaan statis bukan pengganti integrasi test maupun pemeriksaan preview WhatsApp aktual.
