const SUPABASE_URL = "https://qtzailwtwasgbmvinmxz.supabase.co";
const SUPABASE_KEY = "sb_publishable_iiwVxKVWncE16hjG8bPAXQ_OeMQS7Io";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const statusLabels = {
  upcoming: "Akan datang", ongoing: "Berlangsung", completed: "Selesai",
  postponed: "Ditunda", cancelled: "Dibatalkan"
};
let supabase = null;
let currentSession = null;
let currentRoute = [];
let currentAdmin = false;
let toastTimer = null;

const dateLabel = (value) => {
  if (!value) return "Jadwal belum tersedia";
  const d = new Date(value.length === 10 ? value + "T12:00:00" : value);
  return Number.isNaN(d.getTime()) ? "Jadwal belum tersedia" :
    d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};
const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
};
function normalizeAdminUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error("Username harus 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.");
  }
  return username;
}
const pill = (status) => '<span class="status ' + esc(status || "") + '">' +
  esc(statusLabels[status] || status || "Belum tersedia") + "</span>";
const heading = (eyebrow, title, description, count = "") =>
  '<div class="page-heading"><div><div class="eyebrow">' + eyebrow +
  '</div><h1>' + title + '</h1><p>' + description +
  '</p></div><div class="page-count">' + esc(count) + "</div></div>";
const emptyState = (title, description, extra = "") =>
  '<div class="empty-state"><div class="empty-mark">DBX / ARCHIVE</div><h2>' +
  esc(title) + "</h2><p>" + esc(description) + "</p>" + extra + "</div>";
const showNotice = (message, isError = false) =>
  '<div class="notice ' + (isError ? "error" : "success") + '" role="status">' + esc(message) + "</div>";

function toast(message) {
  $(".toast")?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.setAttribute("role", "status");
  node.textContent = message;
  document.body.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 4200);
}
function setLoading(message) {
  $("#app").innerHTML = '<div class="loading-state">' + esc(message || "Memuat arsip…") + "</div>";
}
async function queryRows(table, columns = "*", order = "created_at", ascending = false, limit = 200) {
  if (!supabase) throw new Error("Koneksi Supabase belum tersedia.");
  let request = supabase.from(table).select(columns);
  if (order) request = request.order(order, { ascending, nullsFirst: false });
  if (limit) request = request.limit(limit);
  const { data, error } = await request;
  if (error) throw error;
  return data || [];
}

async function queryAllRows(table, columns = "*", order = "id", ascending = true, pageSize = 1000) {
  if (!supabase) throw new Error("Koneksi Supabase belum tersedia.");
  const rows = [];
  let start = 0;
  while (true) {
    let request = supabase.from(table).select(columns);
    if (order) request = request.order(order, { ascending, nullsFirst: false });
    if (order && order !== "id") request = request.order("id", { ascending: true });
    const { data, error } = await request.range(start, start + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    start += pageSize;
  }
  return rows;
}

async function queryRowsEqual(table, columns, filterColumn, filterValue, order = "id", ascending = true, pageSize = 1000) {
  if (!supabase) throw new Error("Koneksi Supabase belum tersedia.");
  const rows = [];
  let start = 0;
  while (true) {
    let request = supabase.from(table).select(columns).eq(filterColumn, filterValue);
    if (order) request = request.order(order, { ascending, nullsFirst: false });
    if (order && order !== "id") request = request.order("id", { ascending: true });
    const { data, error } = await request.range(start, start + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    start += pageSize;
  }
  return rows;
}
function errorView(error, context = "Arsip belum dapat dimuat") {
  console.error(context, error);
  return emptyState(context, "Periksa koneksi dan konfigurasi database, lalu coba muat ulang halaman.",
    '<button class="btn secondary" id="retry-load" type="button">Coba lagi ↻</button>');
}
function wireRetry() {
  $("#retry-load")?.addEventListener("click", renderRoute);
}
function updatePublicNavigation() {
  const activePath = "/" + (currentRoute[0] || "");
  $$(".main-nav a").forEach((link) => link.classList.toggle("active", link.dataset.route === activePath));
  $("#main-nav").classList.remove("open");
  $("#menu-toggle")?.setAttribute("aria-expanded", "false");
}
function homePage() {
  return '<section class="hero"><div><div class="eyebrow">Death Battle Xtreme · Arsip komunitas</div>' +
    '<h1>Every battle<br>leaves a <em>legacy.</em></h1>' +
    '<p class="hero-copy">DBX History mengumpulkan jejak kompetisi komunitas ke dalam satu arsip yang rapi—dari informasi turnamen hingga perjalanan para juara. Sejarah yang tercatat, bukan sekadar diingat.</p>' +
    '</div><aside class="hero-side"><div class="side-index">ARCHIVE NOTE / 001</div>' +
    '<p>Dokumentasi komunitas dengan informasi terstruktur dan hasil yang dapat diverifikasi.</p>' +
    '<a class="text-link" href="#/tournaments">Jelajahi arsip <span>↗</span></a></aside></section>' +
    '<section class="hero-visual"><img class="visual-logo" src="./public/dbx-logo.svg" alt="">' +
    '<div><div class="visual-label">COMPETITIVE ARCHIVE · SEASON 01</div>' +
    '<div class="visual-title">History is made.<br>Let’s keep the record.</div></div>' +
    '<div class="visual-right">COMMUNITY<br>DOCUMENTATION<br>VOL. 001 — S1</div></section>' +
    '<section class="section"><div class="section-head"><div><div class="eyebrow">Jelajahi arsip</div>' +
    '<h2>Tiga pintu menuju<br>sejarah kompetitif.</h2></div>' +
    '<p>Temukan informasi, telusuri prestasi, dan pahami fakta berdasarkan catatan yang tersedia.</p></div>' +
    '<div class="feature-grid"><a class="feature-card" href="#/tournaments"><div class="feature-top"><span class="feature-number">01 / EVENTS</span><span class="feature-icon">↗</span></div>' +
    '<h3>Informasi Turnamen</h3><p>Jadwal, status, penyelenggara, peraturan, dan arsip turnamen DBX.</p><div class="feature-bottom">BUKA ARSIP <b>↗</b></div></a>' +
    '<a class="feature-card" href="#/champions"><div class="feature-top"><span class="feature-number">02 / CHAMPIONS</span><span class="feature-icon">✳</span></div>' +
    '<h3>Juara Turnamen</h3><p>Profil Debatter, gelar terverifikasi, dan perjalanan prestasi.</p><div class="feature-bottom">LIHAT PROFIL <b>↗</b></div></a>' +
    '<a class="feature-card" href="#/fun-fact"><div class="feature-top"><span class="feature-number">03 / DATA</span><span class="feature-icon">⌁</span></div>' +
    '<h3>Fun Fact</h3><p>Statistik kompetitif hanya jika data memadai.</p><div class="feature-bottom">JELAJAHI DATA <b>↗</b></div></a></div></section>' +
    '<section class="archive-band"><div class="archive-band-inner"><div><div class="eyebrow">Prinsip arsip</div>' +
    '<h2>Catat dengan benar.<br>Sajikan dengan jernih.</h2>' +
    '<p>DBX History adalah arsip komunitas, bukan platform pertandingan atau kanal resmi penyelenggara. Data yang belum dikonfirmasi tidak ditampilkan sebagai fakta.</p></div>' +
    '<div><div class="principle"><span class="num">01</span><div><strong>Data terverifikasi</strong><span>Gelar dan hasil dipublikasikan setelah dikonfirmasi.</span></div></div>' +
    '<div class="principle"><span class="num">02</span><div><strong>Riwayat tetap terjaga</strong><span>Turnamen selesai tetap menjadi bagian sejarah.</span></div></div>' +
    '<div class="principle"><span class="num">03</span><div><strong>Statistik yang jujur</strong><span>Tidak ada angka rekaan untuk mengisi ruang kosong.</span></div></div></div></div></section>' +
    '<div class="founder-strip"><p>ARSIP YANG DIBANGUN BERSAMA</p><div class="founder-names">Gabriel <span>×</span> Daffxy</div></div>';
}

async function tournamentsPage() {
  setLoading("Mengumpulkan arsip turnamen…");
  try {
    const tournaments = await queryAllRows("tournaments",
      "id,tournament_name,organizer,start_date,end_date,status,tier_id,poster_url,description,tiers(tier_name)",
      "start_date", false);
    const years = [...new Set(tournaments.map((t) => t.start_date ? t.start_date.slice(0, 4) : "").filter(Boolean))].sort().reverse();
    const draw = (items) => items.length
      ? '<div class="archive-list">' + items.map((t, i) => {
        const poster = safeUrl(t.poster_url);
        return '<a class="archive-row" href="#/tournaments/' + esc(t.id) + '">' +
          '<span class="row-number">' + String(i + 1).padStart(2, "0") + '</span>' +
          '<div class="archive-row-content' + (poster ? ' has-poster' : '') + '">' +
          (poster ? '<img class="archive-poster-thumb" src="' + esc(poster) + '" alt="Poster ' + esc(t.tournament_name) + '" loading="lazy" decoding="async">' : '') +
          '<div><div class="row-title">' + esc(t.tournament_name) + '</div><div class="row-meta"><span>' +
          esc(t.organizer || "Penyelenggara belum tersedia") + '</span><span>' +
          esc(dateLabel(t.start_date)) + (t.end_date && t.end_date !== t.start_date ? " — " + esc(dateLabel(t.end_date)) : "") +
          '</span><span>' + esc(t.tiers?.tier_name || "Tier belum tersedia") +
          '</span></div></div></div>' + pill(t.status) + "</a>";
      }).join("") + "</div>"
      : emptyState("Arsip sedang disiapkan", "Belum ada turnamen yang dipublikasikan. Informasi akan muncul setelah diverifikasi administrator.");
    $("#app").innerHTML = '<section class="page-wrap">' +
      heading("01 / Tournament archive", "Informasi<br>turnamen.", "Jadwal, status, dan dokumentasi kompetisi dalam satu arsip.", String(tournaments.length).padStart(2, "0") + " RECORDS") +
      '<section class="registration-feature" aria-labelledby="registration-title">' +
        '<div class="registration-poster-wrap"><img class="registration-poster" src="./dbx-s1-registration-poster.svg" alt="Poster Open Registration Death Battle Xtreme Season 1. Total hadiah Rp100.000: juara pertama Rp50.000, kedua Rp30.000, ketiga Rp20.000."></div>' +
        '<div class="registration-info"><div class="eyebrow">Featured event / DBX S1</div>' +
        '<span class="registration-kicker">DEATH BATTLE XTREME</span>' +
        '<h2 id="registration-title">Open Registration<br><em>Season 1</em></h2>' +
        '<p class="registration-intro">Informasi pendaftaran dan hadiah berdasarkan poster yang diberikan penyelenggara.</p>' +
        '<div class="registration-prize"><span>Total hadiah</span><strong>Rp100.000</strong><div class="prize-breakdown"><span>1st <b>Rp50.000</b></span><span>2nd <b>Rp30.000</b></span><span>3rd <b>Rp20.000</b></span></div></div>' +
        '<div class="registration-detail"><span>Periode pada poster</span><strong>1–3 Oktober</strong></div>' +
        '<p class="registration-note">Tahun tidak dicantumkan pada poster, dan masa registrasi dapat berubah. Konfirmasikan status terbaru langsung kepada panitia melalui WhatsApp.</p>' +
        '<div class="registration-actions"><a class="btn" href="https://wa.me/628828671206?text=Halo%20panitia%20DBX%2C%20saya%20ingin%20bertanya%20mengenai%20registrasi%20Death%20Battle%20Xtreme%20Season%201." target="_blank" rel="noopener noreferrer">WhatsApp 08828671206 ↗</a>' +
        '<a class="btn secondary" href="https://wa.me/6281225974441?text=Halo%20panitia%20DBX%2C%20saya%20ingin%20bertanya%20mengenai%20registrasi%20Death%20Battle%20Xtreme%20Season%201." target="_blank" rel="noopener noreferrer">WhatsApp 081225974441 ↗</a></div>' +
        '</div></section>' +
      '<div class="toolbar"><input class="field search-field" id="tournament-search" placeholder="Cari turnamen atau penyelenggara…" aria-label="Cari turnamen">' +
      '<select class="field" id="tournament-status" aria-label="Filter status"><option value="">Semua status</option>' +
      Object.keys(statusLabels).map((key) => '<option value="' + key + '">' + statusLabels[key] + "</option>").join("") +
      '</select><select class="field" id="tournament-year" aria-label="Filter tahun"><option value="">Semua tahun</option>' +
      years.map((year) => '<option value="' + year + '">' + year + "</option>").join("") +
      '</select></div><div id="tournament-results">' + draw(tournaments) + "</div></section>";
    const update = () => {
      const q = $("#tournament-search").value.toLowerCase().trim();
      const status = $("#tournament-status").value;
      const year = $("#tournament-year").value;
      const filtered = tournaments.filter((t) =>
        (!q || (t.tournament_name + " " + (t.organizer || "")).toLowerCase().includes(q)) &&
        (!status || t.status === status) && (!year || (t.start_date || "").startsWith(year)));
      $("#tournament-results").innerHTML = draw(filtered);
    };
    $("#tournament-search").addEventListener("input", update);
    $("#tournament-status").addEventListener("change", update);
    $("#tournament-year").addEventListener("change", update);
  } catch (error) {
    $("#app").innerHTML = '<section class="page-wrap">' + errorView(error) + "</section>";
    wireRetry();
  }
}
async function tournamentDetail(id) {
  setLoading("Membuka detail turnamen…");
  try {
    const { data: t, error } = await supabase.from("tournaments")
      .select("*,tiers(tier_name,tier_description)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!t) {
      $("#app").innerHTML = '<section class="page-wrap"><a class="detail-back" href="#/tournaments">← Kembali ke turnamen</a>' +
        emptyState("Turnamen tidak ditemukan", "Data mungkin belum dipublikasikan atau tautannya tidak lagi tersedia.") + "</section>";
      return;
    }
    const rows = [
      ["Tanggal mulai", dateLabel(t.start_date)],
      ["Tanggal selesai", t.end_date ? dateLabel(t.end_date) : ""],
      ["Penyelenggara", t.organizer],
      ["Tier resmi", t.tiers?.tier_name],
      ["Format", t.format],
      ["Hadiah", t.prize],
      ["Ketentuan peserta", t.participant_requirements]
    ].filter((item) => item[1]);
    const register = t.registration_open && safeUrl(t.registration_url)
      ? '<a class="btn" href="' + esc(safeUrl(t.registration_url)) + '" target="_blank" rel="noopener noreferrer">Informasi pendaftaran ↗</a>'
      : "";
    $("#app").innerHTML = '<section class="page-wrap"><a class="detail-back" href="#/tournaments">← Kembali ke arsip turnamen</a>' +
      '<div class="detail-layout"><article class="detail-main"><div class="eyebrow">Tournament record / S1</div>' + pill(t.status) +
      '<h1>' + esc(t.tournament_name) + '</h1>' +
      (safeUrl(t.poster_url) ? '<img class="tournament-poster-detail" src="' + esc(safeUrl(t.poster_url)) + '" alt="Poster ' + esc(t.tournament_name) + '" loading="lazy" decoding="async">' : "") +
      '<p>' + esc(t.description || "Deskripsi turnamen belum tersedia.") + "</p>" +
      (t.rules ? "<h2>Peraturan</h2><p>" + esc(t.rules) + "</p>" : "") +
      (t.results_summary ? "<h2>Hasil akhir</h2><p>" + esc(t.results_summary) + "</p>" : "") +
      register + '</article><aside class="detail-panel"><h3>Ringkasan turnamen</h3>' +
      rows.map((item) => '<div class="detail-item"><span>' + esc(item[0]) + '</span><strong>' + esc(item[1]) + "</strong></div>").join("") +
      "</aside></div></section>";
  } catch (error) {
    $("#app").innerHTML = '<section class="page-wrap"><a class="detail-back" href="#/tournaments">← Kembali</a>' + errorView(error, "Detail turnamen belum dapat dimuat") + "</section>";
    wireRetry();
  }
}
async function championsPage() {
  setLoading("Membuka arsip juara…");
  try {
    const titles = await queryAllRows("titles",
      "id,debatter_id,tournament_id,confirmation_status,confirmed_at,debatters(id,display_name,photo_url),tournaments(id,tournament_name,start_date,tiers(tier_name))",
      "confirmed_at", false);
    const verified = titles.filter((t) => ["verified", "corrected"].includes(t.confirmation_status) && t.debatters);
    const byDebatter = new Map();
    verified.forEach((title) => {
      if (!byDebatter.has(title.debatter_id)) byDebatter.set(title.debatter_id, {
        id: title.debatter_id, name: title.debatters.display_name,
        photoUrl: safeUrl(title.debatters.photo_url), titles: []
      });
      byDebatter.get(title.debatter_id).titles.push(title);
    });
    const people = [...byDebatter.values()].sort((a, b) => a.name.localeCompare(b.name));
    const draw = (items) => items.length
      ? '<div class="archive-list">' + items.map((person, i) =>
        '<a class="archive-row" href="#/champions/' + esc(person.id) + '">' +
        '<span class="row-number">' + String(i + 1).padStart(2, "0") + '</span>' +
        '<div class="archive-row-content has-poster champion-row-content">' +
        (person.photoUrl
          ? '<img class="archive-poster-thumb champion-avatar" src="' + esc(person.photoUrl) + '" alt="Foto ' + esc(person.name) + '" loading="lazy" decoding="async">'
          : '<span class="champion-avatar champion-avatar-placeholder" aria-hidden="true">' + esc(person.name.trim().slice(0, 1).toUpperCase()) + '</span>') +
        '<div><div class="row-title">' + esc(person.name) + '</div><div class="row-meta"><span>' + person.titles.length +
        ' gelar terverifikasi</span><span>' + esc(person.titles[0]?.tournaments?.tournament_name || "Turnamen terdokumentasi") +
        "</span></div></div></div><span class=\"status completed\">Terverifikasi</span></a>").join("") + "</div>"
      : emptyState("Belum ada juara terverifikasi", "Arsip juara pertama akan tampil setelah hasil turnamen dikonfirmasi.");
    $("#app").innerHTML = '<section class="page-wrap">' +
      heading("02 / Champions archive", "Juara<br>turnamen.", "Arsip Debatter yang gelarnya telah diverifikasi.", String(people.length).padStart(2, "0") + " DEBATTERS") +
      '<div class="toolbar"><input class="field search-field" id="champion-search" placeholder="Cari nama Debatter…" aria-label="Cari nama Debatter"></div>' +
      '<div id="champion-results">' + draw(people) + '</div><p class="muted">Arsip S1 hanya mencakup juara pertama yang telah dikonfirmasi; posisi lain tidak dicampur ke dalam daftar ini.</p></section>';
    $("#champion-search").addEventListener("input", (event) => {
      const query = event.target.value.toLowerCase().trim();
      $("#champion-results").innerHTML = draw(people.filter((p) => p.name.toLowerCase().includes(query)));
    });
  } catch (error) {
    $("#app").innerHTML = '<section class="page-wrap">' + errorView(error) + "</section>";
    wireRetry();
  }
}
async function championDetail(id) {
  setLoading("Membuka profil Debatter…");
  try {
    const { data: person, error } = await supabase.from("debatters")
      .select("id,display_name,photo_url,description").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!person) {
      $("#app").innerHTML = '<section class="page-wrap"><a class="detail-back" href="#/champions">← Kembali ke juara</a>' +
        emptyState("Profil tidak ditemukan", "Profil mungkin belum dipublikasikan.") + "</section>";
      return;
    }

    const [titleResult, matchesAResult, matchesBResult] = await Promise.all([
      supabase.from("titles")
        .select("id,confirmation_status,confirmed_at,verification_source,tournaments(id,tournament_name,start_date,tiers(tier_name))")
        .eq("debatter_id", id).in("confirmation_status", ["verified", "corrected"])
        .order("confirmed_at", { ascending: false }),
      supabase.from("matches")
        .select("id,tournament_id,participant_a,participant_b,winner_id,match_status,match_date,round_label,score_a,score_b,tournaments(id,tournament_name,start_date)")
        .eq("participant_a", id).eq("match_status", "completed").not("winner_id", "is", null)
        .order("match_date", { ascending: true, nullsFirst: false }),
      supabase.from("matches")
        .select("id,tournament_id,participant_a,participant_b,winner_id,match_status,match_date,round_label,score_a,score_b,tournaments(id,tournament_name,start_date)")
        .eq("participant_b", id).eq("match_status", "completed").not("winner_id", "is", null)
        .order("match_date", { ascending: true, nullsFirst: false })
    ]);
    if (titleResult.error) throw titleResult.error;
    if (matchesAResult.error) throw matchesAResult.error;
    if (matchesBResult.error) throw matchesBResult.error;
    const wins = titleResult.data || [];
    const completedMatches = [...new Map([
      ...(matchesAResult.data || []),
      ...(matchesBResult.data || [])
    ].map((match) => [match.id, match])).values()]
      .filter((match) => match.match_status === "completed" &&
        match.winner_id && [match.participant_a, match.participant_b].includes(id));
    completedMatches.sort((a, b) => {
      const timeA = a.match_date ? new Date(a.match_date).getTime() : Number.MAX_SAFE_INTEGER;
      const timeB = b.match_date ? new Date(b.match_date).getTime() : Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });
    const winCount = completedMatches.filter((match) => match.winner_id === id).length;
    const lossCount = completedMatches.length - winCount;
    const winRate = completedMatches.length ? (winCount / completedMatches.length * 100).toFixed(1) + "%" : "";
    const hasCompleteDateOrder = completedMatches.length > 0 && completedMatches.every((match) => Boolean(match.match_date));
    let currentStreak = 0;
    let longestStreak = 0;
    if (hasCompleteDateOrder) {
      completedMatches.forEach((match) => {
        if (match.winner_id === id) {
          currentStreak += 1;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      });
    }

    const opponentIds = [...new Set(completedMatches.map((match) =>
      match.participant_a === id ? match.participant_b : match.participant_a
    ))];
    const opponentNames = {};
    if (opponentIds.length) {
      const { data: opponents, error: opponentError } = await supabase
        .from("debatters").select("id,display_name").in("id", opponentIds);
      if (!opponentError) (opponents || []).forEach((opponent) => {
        opponentNames[opponent.id] = opponent.display_name;
      });
    }

    let characterUses = [];
    try {
      characterUses = await queryRowsEqual("match_characters",
        "id,match_id,characters(character_name),matches(match_date,round_label,tournaments(tournament_name))",
        "debatter_id", id, "created_at", false);
    } catch (_) {
      characterUses = [];
    }
    const characterTally = {};
    characterUses.forEach((entry) => {
      const name = entry.characters?.character_name;
      if (name) characterTally[name] = (characterTally[name] || 0) + 1;
    });
    const topCharacters = Object.entries(characterTally).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const profileImage = safeUrl(person.photo_url);
    const matchHistory = completedMatches.length
      ? '<div class="archive-list">' + completedMatches.slice(-8).reverse().map((match, index) => {
        const opponentId = match.participant_a === id ? match.participant_b : match.participant_a;
        const won = match.winner_id === id;
        const ownScore = match.participant_a === id ? match.score_a : match.score_b;
        const opponentScore = match.participant_a === id ? match.score_b : match.score_a;
        const score = ownScore != null && opponentScore != null
          ? String(ownScore) + "–" + String(opponentScore)
          : "Skor belum tersedia";
        const date = match.match_date ? dateLabel(match.match_date.slice(0, 10)) : "Tanggal belum tersedia";
        return '<a class="archive-row" href="#/tournaments/' + esc(match.tournament_id) + '">' +
          '<span class="row-number">' + String(index + 1).padStart(2, "0") + '</span><div>' +
          '<div class="row-title">' + esc(match.tournaments?.tournament_name || "Turnamen") + '</div>' +
          '<div class="row-meta"><span>' + esc(match.round_label || "Pertandingan selesai") + '</span><span>' +
          esc(date) + '</span><span>' + esc(score) + '</span><span>' +
          esc(opponentNames[opponentId] || "Identitas lawan belum dipublikasikan") + '</span></div></div>' +
          '<span class="status ' + (won ? "completed" : "cancelled") + '">' + (won ? "Menang" : "Kalah") + '</span></a>';
      }).join("") + "</div>"
      : emptyState("Belum ada pertandingan selesai", "Riwayat pertandingan akan muncul setelah hasil valid dipublikasikan.");
    const statCards = completedMatches.length
      ? '<div class="stat-grid">' +
        '<article class="stat-card"><div class="stat-label">Pertandingan selesai</div><div class="stat-value">' + completedMatches.length + '</div><p>Catatan pertandingan publik dengan pemenang valid.</p></article>' +
        '<article class="stat-card"><div class="stat-label">Kemenangan</div><div class="stat-value">' + winCount + '</div><p>Menang pada pertandingan selesai yang tercatat.</p></article>' +
        '<article class="stat-card"><div class="stat-label">Kekalahan</div><div class="stat-value">' + lossCount + '</div><p>Kalah pada pertandingan selesai yang tercatat.</p></article>' +
        '<article class="stat-card"><div class="stat-label">Win rate</div><div class="stat-value">' + esc(winRate) + '</div><p>Kemenangan ÷ pertandingan selesai yang tersedia.</p></article>' +
        (hasCompleteDateOrder ? '<article class="stat-card"><div class="stat-label">Win streak terpanjang</div><div class="stat-value">' + longestStreak + '</div><p>Urutan pertandingan bertanggal dalam arsip yang tersedia.</p></article>' : "") +
        '</div><div class="notice">Cakupan statistik: pertandingan selesai yang dipublikasikan. Nilai ini bukan rekor sepanjang masa jika arsip tidak lengkap.</div>'
      : emptyState("Statistik belum tersedia", "Tidak ada pertandingan selesai dengan pemenang valid untuk profil ini.");
    const characterSummary = topCharacters.length
      ? '<div class="archive-list">' + topCharacters.map((entry, index) =>
        '<div class="archive-row"><span class="row-number">' + String(index + 1).padStart(2, "0") +
        '</span><div><div class="row-title">' + esc(entry[0]) + '</div><div class="row-meta"><span>' +
        entry[1] + ' catatan penggunaan</span></div></div></div>').join("") + '</div>'
      : emptyState("Penggunaan karakter belum tersedia", "Karakter hanya ditampilkan jika tercatat pada pertandingan yang sudah dipublikasikan.");

    $("#app").innerHTML = '<section class="page-wrap"><a class="detail-back" href="#/champions">← Kembali ke arsip juara</a>' +
      '<div class="detail-layout"><article class="detail-main"><div class="eyebrow">Champion profile / S1</div>' +
      (profileImage ? '<img src="' + esc(profileImage) + '" alt="Foto ' + esc(person.display_name) + '" class="champion-profile-image" loading="lazy" decoding="async">' : "") +
      '<h1>' + esc(person.display_name) + '</h1>' + (person.description ? "<p>" + esc(person.description) + "</p>" : "") +
      '<h2>Statistik pertandingan</h2>' + statCards +
      '<h2>Riwayat pertandingan</h2>' + matchHistory +
      '<h2>Penggunaan karakter</h2>' + characterSummary +
      '<h2>Riwayat gelar</h2>' + (wins.length
        ? '<div class="archive-list">' + wins.map((title, index) =>
          '<a class="archive-row" href="#/tournaments/' + esc(title.tournaments?.id || "") + '"><span class="row-number">' +
          String(index + 1).padStart(2, "0") + '</span><div><div class="row-title">' +
          esc(title.tournaments?.tournament_name || "Turnamen") + '</div><div class="row-meta"><span>' +
          esc(dateLabel(title.tournaments?.start_date)) + '</span><span>' +
          esc(title.tournaments?.tiers?.tier_name || "Tier belum tersedia") +
          '</span><span>' + (title.confirmation_status === "corrected" ? "Status: dikoreksi" : "Status: terverifikasi") +
          '</span></div></div><span class="status completed">' +
          (title.confirmation_status === "corrected" ? "Dikoreksi" : "Terverifikasi") + '</span></a>').join("") + "</div>"
        : emptyState("Belum ada gelar terverifikasi", "Riwayat gelar yang dikonfirmasi akan muncul di sini.")) +
      '</article><aside class="detail-panel"><h3>Identitas Debatter</h3><div class="detail-item"><span>Nama panggung</span><strong>' +
      esc(person.display_name) + '</strong></div><div class="detail-item"><span>Gelar terverifikasi atau dikoreksi</span><strong>' +
      wins.length + '</strong></div><div class="detail-item"><span>Verifikasi</span><strong>Hanya gelar yang telah dikonfirmasi tampil pada arsip publik.</strong></div></aside></div></section>';
  } catch (error) {
    $("#app").innerHTML = '<section class="page-wrap">' + errorView(error, "Profil belum dapat dimuat") + "</section>";
    wireRetry();
  }
}

async function funFactPage() {
  setLoading("Memeriksa catatan statistik…");
  try {
    const [matches, titles, characterUses, participations, debaters] = await Promise.all([
      queryAllRows("matches", "id,tournament_id,participant_a,participant_b,winner_id,match_status,match_date", "match_date", true),
      queryAllRows("titles", "id,debatter_id,confirmation_status", "id", true),
      queryAllRows("match_characters", "id,match_id,debatter_id,character_id,characters(character_name)", "id", true),
      queryAllRows("participations", "id,debatter_id,tournament_id,participation_status,debatters(display_name)", "id", true),
      queryAllRows("debatters", "id,display_name", "display_name", true)
    ]);
    const validMatches = matches.filter((m) => m.match_status === "completed" &&
      m.winner_id && [m.participant_a, m.participant_b].includes(m.winner_id));
    const validTitles = titles.filter((t) => ["verified", "corrected"].includes(t.confirmation_status));
    const displayNames = new Map(debaters.map((person) => [person.id, person.display_name]));
    const stats = [];

    if (validMatches.length) {
      const winsByDebatter = {};
      validMatches.forEach((match) => {
        winsByDebatter[match.winner_id] = (winsByDebatter[match.winner_id] || 0) + 1;
      });
      const top = Object.entries(winsByDebatter)
        .filter(([id]) => displayNames.has(id))
        .sort((a, b) => b[1] - a[1] || displayNames.get(a[0]).localeCompare(displayNames.get(b[0])))[0];
      if (top) stats.push({
        label: "Most wins",
        value: top[1],
        detail: displayNames.get(top[0]) + " · kemenangan pada pertandingan selesai yang dipublikasikan."
      });

      const matchesByDebatter = new Map();
      validMatches.forEach((match) => {
        for (const participant of [match.participant_a, match.participant_b]) {
          if (!matchesByDebatter.has(participant)) matchesByDebatter.set(participant, []);
          matchesByDebatter.get(participant).push(match);
        }
      });
      const streakResults = [];
      for (const [debatterId, debatterMatches] of matchesByDebatter) {
        // An undated match makes the sequence incomplete, so do not present a streak for that Debatter.
        if (debatterMatches.length < 2 || debatterMatches.some((match) => !match.match_date) || !displayNames.has(debatterId)) continue;
        const ordered = [...debatterMatches].sort((a, b) =>
          new Date(a.match_date).getTime() - new Date(b.match_date).getTime() || a.id.localeCompare(b.id));
        let run = 0;
        let best = 0;
        for (const match of ordered) {
          if (match.winner_id === debatterId) {
            run += 1;
            best = Math.max(best, run);
          } else {
            run = 0;
          }
        }
        if (best >= 2) streakResults.push({ id: debatterId, streak: best });
      }
      streakResults.sort((a, b) => b.streak - a.streak || displayNames.get(a.id).localeCompare(displayNames.get(b.id)));
      if (streakResults.length) {
        const best = streakResults[0];
        stats.push({
          label: "Longest win streak",
          value: best.streak,
          detail: displayNames.get(best.id) + " · urutan pertandingan bertanggal yang tersedia."
        });
      }
    }

    if (validTitles.length) {
      const tally = {};
      validTitles.forEach((title) => {
        if (displayNames.has(title.debatter_id)) tally[title.debatter_id] = (tally[title.debatter_id] || 0) + 1;
      });
      const top = Object.entries(tally)
        .sort((a, b) => b[1] - a[1] || displayNames.get(a[0]).localeCompare(displayNames.get(b[0])))[0];
      if (top) stats.push({
        label: "Most tournament titles",
        value: top[1],
        detail: displayNames.get(top[0]) + " · gelar terverifikasi atau dikoreksi."
      });
    }

    const characterTally = {};
    characterUses.forEach((entry) => {
      const name = entry.characters?.character_name;
      if (name) characterTally[name] = (characterTally[name] || 0) + 1;
    });
    const topCharacter = Object.entries(characterTally)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (topCharacter) stats.push({
      label: "Most used character",
      value: topCharacter[1],
      detail: topCharacter[0] + " · catatan penggunaan karakter pada pertandingan yang dapat dibaca publik."
    });

    const appearances = {};
    const appearanceNames = {};
    participations.forEach((entry) => {
      if (entry.participation_status !== "confirmed" || !entry.debatters?.display_name) return;
      appearances[entry.debatter_id] = (appearances[entry.debatter_id] || 0) + 1;
      appearanceNames[entry.debatter_id] = entry.debatters.display_name;
    });
    const mostAppearances = Object.entries(appearances)
      .sort((a, b) => b[1] - a[1] || appearanceNames[a[0]].localeCompare(appearanceNames[b[0]]))[0];
    if (mostAppearances) stats.push({
      label: "Tournament appearances",
      value: mostAppearances[1],
      detail: appearanceNames[mostAppearances[0]] + " · partisipasi yang telah dikonfirmasi pada turnamen publik."
    });

    $("#app").innerHTML = '<section class="page-wrap">' +
      heading("03 / Competitive insights", "Fun fact<br>&amp; statistik.", "Statistik berdasarkan catatan kompetitif yang tersedia.", String(stats.length).padStart(2, "0") + " INSIGHTS") +
      (stats.length
        ? '<div class="stat-grid">' + stats.map((s) => '<article class="stat-card"><div class="stat-label">' +
          esc(s.label) + '</div><div class="stat-value">' + esc(s.value) + '</div><p>' +
          esc(s.detail) + "</p></article>").join("") + '</div><div class="notice">Cakupan: data yang tersedia dan dipublikasikan. Ini bukan klaim rekor sepanjang masa jika arsip historis belum lengkap. Streak hanya dihitung saat seluruh pertandingan yang dipakai memiliki tanggal.</div>'
        : emptyState("Data belum cukup untuk statistik", "Fun Fact akan muncul saat catatan pertandingan selesai, gelar terverifikasi, partisipasi, dan penggunaan karakter tersedia. Tidak ada angka perkiraan.")
      ) + "</section>";
  } catch (error) {
    $("#app").innerHTML = '<section class="page-wrap">' + errorView(error, "Statistik belum dapat dimuat") + "</section>";
    wireRetry();
  }
}

const field = (key, label, type, required = false, options = {}) => ({ key, label, type, required, ...options });
const adminSections = {
  tournaments: {
    table: "tournaments", title: "Turnamen", description: "Jadwal, status, tier, poster, aturan, dan publikasi.",
    columns: ["tournament_name", "status", "start_date", "is_published"],
    fields: [
      field("tournament_name", "Nama turnamen", "text", true), field("organizer", "Penyelenggara", "text"),
      field("start_date", "Tanggal mulai", "date"), field("end_date", "Tanggal selesai", "date"),
      field("status", "Status", "select", true, { choices: Object.entries(statusLabels).map(([value, label]) => [value, label]) }),
      field("tier_id", "Tier resmi", "relation", false, { table: "tiers", display: "tier_name", nullLabel: "Belum ditentukan" }),
      field("poster_url", "Poster turnamen", "asset"), field("description", "Deskripsi", "textarea"),
      field("rules", "Peraturan", "textarea"), field("format", "Format kompetisi", "text"),
      field("prize", "Hadiah", "text"), field("participant_requirements", "Ketentuan peserta", "textarea"),
      field("registration_url", "URL pendaftaran", "url"), field("registration_open", "Pendaftaran aktif", "checkbox"),
      field("results_summary", "Ringkasan hasil akhir", "textarea"), field("is_published", "Publikasikan ke publik", "checkbox")
    ]
  },
  debaters: {
    table: "debatters", title: "Debatter", description: "Identitas profil dan visibilitas publik.",
    columns: ["display_name", "is_published"],
    fields: [
      field("display_name", "Nama panggung", "text", true), field("photo_url", "Foto atau avatar", "asset"),
      field("description", "Deskripsi singkat", "textarea"), field("is_published", "Publikasikan ke publik", "checkbox")
    ]
  },
  titles: {
    table: "titles", title: "Gelar juara", description: "Gelar juara pertama; pastikan hasil telah diverifikasi sebelum memublikasikan.",
    columns: ["debatter_id", "tournament_id", "confirmation_status", "confirmed_at"],
    fields: [
      field("debatter_id", "Debatter", "relation", true, { table: "debatters", display: "display_name" }),
      field("tournament_id", "Turnamen", "relation", true, { table: "tournaments", display: "tournament_name" }),
      field("confirmation_status", "Status verifikasi", "select", true, { choices: [["draft", "Draf"], ["needs_verification", "Perlu verifikasi"], ["verified", "Terverifikasi"], ["corrected", "Dikoreksi"]] }),
      field("confirmed_at", "Waktu konfirmasi", "datetime-local"), field("verification_source", "Sumber verifikasi", "text"),
      field("notes", "Catatan", "textarea")
    ]
  },
  matches: {
    table: "matches", title: "Pertandingan", description: "Catatan pertandingan yang menjadi sumber statistik.",
    columns: ["tournament_id", "participant_a", "participant_b", "match_status", "winner_id"],
    fields: [
      field("tournament_id", "Turnamen", "relation", true, { table: "tournaments", display: "tournament_name" }),
      field("participant_a", "Debatter A", "relation", true, { table: "debatters", display: "display_name" }),
      field("participant_b", "Debatter B", "relation", true, { table: "debatters", display: "display_name" }),
      field("winner_id", "Pemenang", "relation", false, { table: "debatters", display: "display_name", nullLabel: "Belum ditetapkan" }),
      field("score_a", "Skor A", "number"), field("score_b", "Skor B", "number"),
      field("match_status", "Status pertandingan", "select", true, { choices: [["scheduled", "Terjadwal"], ["completed", "Selesai"], ["cancelled", "Dibatalkan"], ["disputed", "Disengketakan"], ["incomplete", "Belum selesai"]] }),
      field("match_date", "Tanggal dan waktu", "datetime-local"), field("round_label", "Babak", "text"), field("notes", "Catatan", "textarea")
    ]
  },
  characters: {
    table: "characters", title: "Karakter", description: "Katalog karakter yang bisa dihubungkan ke catatan pertandingan.",
    columns: ["character_name", "is_published"],
    fields: [
      field("character_name", "Nama karakter", "text", true), field("image_url", "Gambar karakter", "asset"),
      field("description", "Deskripsi", "textarea"), field("is_published", "Publikasikan ke publik", "checkbox")
    ]
  },
  tiers: {
    table: "tiers", title: "Tier resmi", description: "Gunakan hanya tier dan definisi yang telah dikonfirmasi.",
    columns: ["tier_name", "is_active", "reference_source"],
    fields: [
      field("tier_name", "Nama tier", "text", true), field("tier_description", "Deskripsi tier", "textarea"),
      field("effective_date", "Berlaku sejak", "date"), field("reference_source", "Sumber referensi resmi", "url"),
      field("is_active", "Tier dikonfirmasi dan aktif", "checkbox")
    ]
  },
  participations: {
    table: "participations", title: "Partisipasi", description: "Hubungan Debatter dengan turnamen yang diikuti.",
    columns: ["debatter_id", "tournament_id", "placement", "participation_status"],
    fields: [
      field("debatter_id", "Debatter", "relation", true, { table: "debatters", display: "display_name" }),
      field("tournament_id", "Turnamen", "relation", true, { table: "tournaments", display: "tournament_name" }),
      field("placement", "Posisi akhir (opsional)", "number"),
      field("participation_status", "Status partisipasi", "select", true, { choices: [["confirmed", "Dikonfirmasi"], ["withdrawn", "Mengundurkan diri"], ["disqualified", "Didiskualifikasi"], ["pending", "Menunggu"]] })
    ]
  },
  match_characters: {
    table: "match_characters", title: "Penggunaan karakter", description: "Hubungkan karakter dengan Debatter dan pertandingan tertentu.",
    columns: ["match_id", "debatter_id", "character_id"],
    fields: [
      field("match_id", "Pertandingan", "relation", true, { table: "matches", display: "id" }),
      field("debatter_id", "Debatter", "relation", true, { table: "debatters", display: "display_name" }),
      field("character_id", "Karakter", "relation", true, { table: "characters", display: "character_name" })
    ]
  }
};
let activeAdminSection = "tournaments";
let editingRecordId = null;

async function adminPage() {
  setLoading("Memeriksa izin administrator…");
  if (!supabase) {
    $("#app").innerHTML = '<section class="page-wrap">' + emptyState("Koneksi Supabase belum tersedia", "Periksa koneksi internet lalu coba muat ulang.") + "</section>";
    return;
  }
  if (!currentSession) {
    $("#app").innerHTML = '<section class="page-wrap"><div class="login-card"><div class="eyebrow">Private area / DBX</div>' +
      '<h2>Admin sign in.</h2><p>Area khusus Founder. Akun biasa tidak dapat mengubah, menghapus, atau memublikasikan isi arsip.</p>' +
      '<form id="admin-login"><div class="form-field"><label for="admin-username">Username administrator</label><input id="admin-username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Masukkan username" minlength="3" maxlength="32" required></div>' +
      '<div class="form-field"><label for="admin-password">Kata sandi</label><input id="admin-password" type="password" autocomplete="current-password" required></div>' +
      '<div id="login-message" aria-live="polite"></div><button class="btn" type="submit">Masuk ke dashboard ↗</button></form>' +
      '<p style="font-size:10px;margin-top:18px">Gunakan username yang telah didaftarkan Founder dan kata sandi akun terkait. Gmail tidak diminta pada formulir website. Hak edit diperiksa kembali oleh database.</p></div></section>';
    $("#admin-login").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = $('button[type="submit"]', event.currentTarget);
      button.disabled = true;
      button.textContent = "Memverifikasi…";
      try {
        const username = normalizeAdminUsername($("#admin-username").value);
        const response = await fetch(SUPABASE_URL + "/functions/v1/username-login", {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
          body: JSON.stringify({ username, password: $("#admin-password").value })
        });
        let result = {};
        try { result = await response.json(); } catch { /* keep generic login error */ }
        if (!response.ok || !result.session?.access_token || !result.session?.refresh_token) {
          throw new Error(result.error || "Username atau kata sandi salah.");
        }
        const { error } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token
        });
        if (error) throw error;
      } catch (loginError) {
        const message = loginError instanceof Error && loginError.message.startsWith("Username harus")
          ? loginError.message
          : "Username atau kata sandi salah, atau layanan login sementara tidak tersedia.";
        $("#login-message").innerHTML = showNotice(message, true);
        button.disabled = false;
        button.textContent = "Masuk ke dashboard ↗";
      }
    });
    return;
  }
  const { data: membership, error } = await supabase.from("admin_users")
    .select("user_id,role").eq("user_id", currentSession.user.id).maybeSingle();
  if (error || !membership || membership.role !== "founder") {
    currentAdmin = false;
    $("#app").innerHTML = '<section class="page-wrap">' +
      emptyState("Akses Founder diperlukan", "Hanya akun Founder yang dapat mengubah, menghapus, atau memublikasikan isi arsip. Akun ini tidak memiliki izin Founder.") +
      '<button class="btn secondary" id="admin-sign-out">Keluar</button></section>';
    $("#admin-sign-out").addEventListener("click", async () => { await supabase.auth.signOut(); });
    return;
  }
  currentAdmin = true;
  activeAdminSection = adminSections[currentRoute[1]] ? currentRoute[1] : "tournaments";
  $("#app").innerHTML = '<section class="page-wrap">' +
    heading("Private workspace / DBX", "Admin<br>workspace.", "Kelola konten, periksa verifikasi, dan publikasikan informasi yang valid.") +
    '<div class="admin-shell"><aside class="admin-side"><div class="eyebrow">Control room</div><h2>Archive<br>management.</h2>' +
    '<p>Perubahan penting tercatat di audit log.</p><nav id="admin-navigation">' +
    '<a href="#/admin/tournaments" data-admin-section="tournaments">Turnamen</a>' +
    '<a href="#/admin/debaters" data-admin-section="debaters">Debatter</a>' +
    '<a href="#/admin/titles" data-admin-section="titles">Gelar juara</a>' +
    '<a href="#/admin/matches" data-admin-section="matches">Pertandingan</a>' +
    '<a href="#/admin/characters" data-admin-section="characters">Karakter</a>' +
    '<a href="#/admin/match_characters" data-admin-section="match_characters">Penggunaan karakter</a>' +
    '<a href="#/admin/participations" data-admin-section="participations">Partisipasi</a>' +
    '<a href="#/admin/tiers" data-admin-section="tiers">Tier resmi</a>' +
    '<a href="#/admin/audit" data-admin-section="audit">Audit log</a></nav>' +
    '<button class="btn secondary" id="admin-sign-out" style="width:100%;color:var(--c);border-color:rgba(255,255,255,.25)">Keluar ↗</button></aside>' +
    '<div class="admin-main" id="admin-content"><div class="loading-state">Memuat workspace…</div></div></div></section>';
  $$("#admin-navigation a").forEach((link) => {
    link.classList.toggle("active", link.dataset.adminSection === activeAdminSection);
  });
  $("#admin-sign-out").addEventListener("click", async () => { await supabase.auth.signOut(); });
  await loadAdminSection(activeAdminSection);
}
function displayFieldValue(type, value) {
  if (value == null) return "";
  if (type === "datetime-local") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
  }
  return String(value);
}
async function relationOptions(config) {
  const { data, error } = await supabase.from(config.table).select("id," + config.display)
    .order(config.display, { ascending: true }).limit(500);
  if (error) throw error;
  return data || [];
}
async function renderAdminForm(section, record) {
  const config = adminSections[section];
  const editor = $("#admin-editor");
  if (!config || !editor) return;
  editingRecordId = record?.id || null;
  const options = {};
  try {
    for (const f of config.fields) {
      if (f.type === "relation") options[f.key] = await relationOptions(f);
    }
  } catch (error) {
    editor.innerHTML = showNotice("Daftar pilihan tidak dapat dimuat: " + error.message, true);
    return;
  }
  const controls = config.fields.map((f) => {
    const value = record ? record[f.key] : null;
    const id = "field-" + f.key;
    if (f.type === "checkbox") {
      return '<div class="form-field full"><label for="' + id + '"><input id="' + id + '" type="checkbox" name="' +
        f.key + '" ' + (value ? "checked" : "") + '> ' + esc(f.label) + "</label></div>";
    }
    if (f.type === "textarea") {
      return '<div class="form-field full"><label for="' + id + '">' + esc(f.label) + '</label><textarea id="' +
        id + '" name="' + f.key + '"' + (f.required ? " required" : "") + ">" + esc(value || "") + "</textarea></div>";
    }
    if (f.type === "select" || f.type === "relation") {
      const choices = f.type === "select"
        ? f.choices.map((choice) => ({ id: choice[0], label: choice[1] }))
        : options[f.key].map((item) => ({ id: item.id, label: item[f.display] || item.id }));
      const blankLabel = f.nullLabel || (f.type === "relation" ? "Pilih catatan…" : "Pilih…");
      return '<div class="form-field"><label for="' + id + '">' + esc(f.label) + '</label><select id="' +
        id + '" name="' + f.key + '"' + (f.required ? " required" : "") + '><option value="">' + esc(blankLabel) +
        "</option>" + choices.map((choice) => '<option value="' + esc(choice.id) + '" ' +
          (String(value || "") === String(choice.id) ? "selected" : "") + ">" +
          esc(choice.label) + "</option>").join("") + "</select></div>";
    }
    if (f.type === "asset") {
      const existingImage = safeUrl(value || "");
      return '<div class="form-field full"><label for="' + id + '">' + esc(f.label) + '</label>' +
        '<input id="' + id + '" name="' + f.key + '" type="url" value="' + esc(existingImage) +
        '" placeholder="https://… (URL gambar opsional)">' +
        '<label for="' + id + '-upload">Pilih gambar dari perangkat</label>' +
        '<input id="' + id + '-upload" type="file" data-upload="' + f.key +
        '" accept="image/png,image/jpeg,image/webp,image/gif">' +
        '<img class="admin-image-preview" id="' + id + '-preview" src="' + esc(existingImage) +
        '" alt="Pratinjau ' + esc(f.label) + '"' + (existingImage ? "" : " hidden") + '>' +
        '<small>PNG, JPEG, WebP, atau GIF; maksimal 5 MB. File diperiksa berdasarkan isi, bukan hanya ekstensi.</small></div>';
    }
    const inputType = f.type === "datetime-local" ? "datetime-local" : f.type;
    return '<div class="form-field' + (["description", "rules", "results_summary", "participant_requirements", "notes", "tier_description"].includes(f.key) ? " full" : "") +
      '"><label for="' + id + '">' + esc(f.label) + '</label><input id="' + id + '" name="' + f.key +
      '" type="' + inputType + '" value="' + esc(displayFieldValue(f.type, value)) + '"' +
      (f.required ? " required" : "") + (f.type === "number" ? ' step="any"' : "") + "></div>";
  }).join("");
  editor.innerHTML = '<form id="admin-record-form" class="notice" style="padding:20px">' +
    '<div class="form-grid">' + controls + '</div><div id="admin-form-message" aria-live="polite"></div>' +
    '<div class="form-actions"><button type="button" class="btn secondary" id="cancel-record">Batal</button>' +
    '<button type="submit" class="btn">' + (record ? "Simpan perubahan" : "Simpan catatan") + "</button></div></form>";
  const previewObjectUrls = [];
  for (const f of config.fields.filter((item) => item.type === "asset")) {
    const input = $('input[data-upload="' + f.key + '"]', editor);
    const preview = $("#field-" + f.key + "-preview", editor);
    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!preview) return;
      if (file) {
        const previewUrl = URL.createObjectURL(file);
        previewObjectUrls.push(previewUrl);
        preview.src = previewUrl;
        preview.hidden = false;
      } else {
        const existingImage = safeUrl(record?.[f.key] || "");
        if (existingImage) { preview.src = existingImage; preview.hidden = false; }
        else preview.hidden = true;
      }
    });
  }
  const releasePreviews = () => previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  $("#cancel-record").addEventListener("click", () => {
    releasePreviews();
    editor.innerHTML = "";
    editingRecordId = null;
  });
  $("#admin-record-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = $('button[type="submit"]', form);
    submit.disabled = true;
    submit.textContent = "Menyimpan…";
    const payload = {};
    const uploadedAssets = [];
    let recordSaved = false;
    try {
      for (const f of config.fields) {
        const control = form.elements.namedItem(f.key);
        if (f.type === "checkbox") payload[f.key] = control.checked;
        else if (f.type === "number") payload[f.key] = control.value === "" ? null : Number(control.value);
        else if (f.type === "relation") payload[f.key] = control.value || null;
        else if (f.type === "datetime-local") payload[f.key] = control.value ? new Date(control.value).toISOString() : null;
        else if (f.type === "asset") payload[f.key] = control.value.trim() || null;
        else payload[f.key] = control.value.trim() || null;
      }
      if (section === "debaters") {
        const normalizeName = (name) => String(name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
        const existingDebaters = await queryAllRows("debatters", "id,display_name", "display_name", true);
        const duplicate = existingDebaters.find((item) =>
          item.id !== editingRecordId && normalizeName(item.display_name) === normalizeName(payload.display_name)
        );
        if (duplicate) {
          throw new Error('Nama panggung "' + payload.display_name.trim() + '" sudah digunakan. Buka profil yang sudah ada agar riwayat gelar tidak terpecah.');
        }
      }
      if (section === "tournaments" && payload.registration_open && !safeUrl(payload.registration_url)) {
        throw new Error("Pendaftaran aktif memerlukan URL pendaftaran yang valid.");
      }
      if (section === "matches") {
        if (payload.participant_a === payload.participant_b) throw new Error("Debatter A dan Debatter B harus berbeda.");
        if (payload.winner_id && ![payload.participant_a, payload.participant_b].includes(payload.winner_id)) {
          throw new Error("Pemenang harus salah satu peserta pertandingan.");
        }
        if (payload.match_status === "completed" && !payload.winner_id) throw new Error("Pertandingan selesai harus memiliki pemenang yang dikonfirmasi.");
      }
      for (const f of config.fields.filter((item) => item.type === "asset")) {
        const file = $('input[data-upload="' + f.key + '"]', form)?.files?.[0];
        if (file) {
          const uploaded = await uploadAdminAsset(file, section);
          payload[f.key] = uploaded.publicUrl;
          uploadedAssets.push(uploaded);
        } else {
          payload[f.key] = safeUrl(payload[f.key]) || null;
        }
      }
      if (section === "titles" && ["verified", "corrected"].includes(payload.confirmation_status) && !payload.confirmed_at) {
        payload.confirmed_at = new Date().toISOString();
      }
      const result = editingRecordId
        ? await supabase.from(config.table).update(payload).eq("id", editingRecordId)
        : await supabase.from(config.table).insert(payload);
      if (result.error?.code === "23505" && String(result.error?.message || "").includes("debaters_display_name_normalized_unique_idx")) {
        throw new Error("Nama panggung tersebut sudah digunakan. Buka profil yang sudah ada agar riwayat gelar tidak terpecah.");
      }
      if (result.error) throw result.error;
      recordSaved = true;
      releasePreviews();
      toast("Catatan berhasil disimpan.");
      await loadAdminSection(section);
    } catch (error) {
      if (!recordSaved && uploadedAssets.length) {
        const cleanupResults = await Promise.allSettled(uploadedAssets.map((asset) =>
          supabase.storage.from(asset.bucket).remove([asset.path])
        ));
        if (cleanupResults.some((result) => result.status === "rejected" ||
          (result.status === "fulfilled" && result.value?.error))) {
          console.warn("An uploaded asset could not be cleaned up after the record save failed.");
        }
      }
      $("#admin-form-message").innerHTML = showNotice(error.message || "Data tidak berhasil disimpan.", true);
      submit.disabled = false;
      submit.textContent = editingRecordId ? "Simpan perubahan" : "Simpan catatan";
    }
  });
}
async function uploadAdminAsset(file, section) {
  const maxBytes = 5 * 1024 * 1024;
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    throw new Error("Pilih file gambar yang tidak kosong.");
  }
  if (file.size > maxBytes) throw new Error("Ukuran gambar maksimal 5 MB.");

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const startsWith = (signature) => signature.every((byte, index) => bytes[index] === byte);
  let contentType = "";
  let extension = "";
  if (startsWith([137, 80, 78, 71, 13, 10, 26, 10])) { contentType = "image/png"; extension = "png"; }
  else if (startsWith([255, 216, 255])) { contentType = "image/jpeg"; extension = "jpg"; }
  else if (String.fromCharCode(...bytes.slice(0, 6)) === "GIF87a" ||
           String.fromCharCode(...bytes.slice(0, 6)) === "GIF89a") { contentType = "image/gif"; extension = "gif"; }
  else if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
           String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") { contentType = "image/webp"; extension = "webp"; }
  else throw new Error("File bukan gambar PNG, JPEG, WebP, atau GIF yang valid.");

  const rawName = String(file.name || "foto").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safeBase = rawName.replace(/\.[^.]*$/, "").toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "foto";
  const randomId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  const bucket = "dbx-assets";
  const path = section + "/" + randomId + "-" + safeBase + "." + extension;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000", upsert: false, contentType
  });
  if (error) {
    const code = error.statusCode ? " (" + String(error.statusCode) + ")" : "";
    throw new Error("Foto gagal diunggah" + code + ". Pastikan sesi admin masih aktif, hak Founder tersedia, dan koneksi internet stabil.");
  }
  const publicUrl = safeUrl(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
  if (!publicUrl) {
    await supabase.storage.from(bucket).remove([path]);
    throw new Error("Foto tersimpan, tetapi URL publiknya tidak valid. Coba unggah kembali.");
  }
  return { bucket, path, publicUrl };
}
function adminCell(config, row, key, relationNames) {
  const value = row[key];
  if (value == null || value === "") return "—";
  if (key === "is_published" || key === "is_active") return value ? "Ya" : "Tidak";
  if (key === "status") return statusLabels[value] || value;
  if (key === "confirmation_status") {
    return ({ draft: "Draf", needs_verification: "Perlu verifikasi", verified: "Terverifikasi", corrected: "Dikoreksi" })[value] || value;
  }
  if (key.endsWith("_id")) return relationNames[key]?.[value] || String(value).slice(0, 8) + "…";
  if (key.endsWith("_at") || key.endsWith("_date")) return dateLabel(value);
  return String(value).length > 60 ? String(value).slice(0, 57) + "…" : String(value);
}
async function loadAdminSection(section) {
  const config = adminSections[section];
  const root = $("#admin-content");
  if (!root || !currentAdmin) return;
  activeAdminSection = section;
  editingRecordId = null;
  if (section === "audit") {
    root.innerHTML = '<h2>Audit log</h2><p>Riwayat perubahan data kompetitif untuk keterlacakan.</p><div id="audit-results" class="loading-state">Memuat audit log…</div>';
    try {
      const logs = await queryRows("audit_logs", "id,admin_id,entity_type,entity_id,action,old_data,new_data,created_at", "created_at", false, 100);
      $("#audit-results").innerHTML = logs.length
        ? '<div class="notice">Menampilkan ' + logs.length + ' perubahan terbaru.</div><table class="admin-table"><thead><tr><th>Waktu</th><th>Entitas</th><th>Aksi</th><th>ID data</th><th>Admin</th><th>Perubahan</th></tr></thead><tbody>' +
          logs.map((log) => '<tr><td>' + esc(new Date(log.created_at).toLocaleString("id-ID")) + '</td><td>' +
            esc(log.entity_type) + '</td><td>' + esc(log.action) + '</td><td>' +
            esc(log.entity_id || "—") + '</td><td>' + esc(log.admin_id || "—") + '</td><td>' +
            '<details><summary>Lihat</summary><pre style="white-space:pre-wrap;max-width:340px;overflow-wrap:anywhere">' +
            esc(JSON.stringify({ old: log.old_data, new: log.new_data }, null, 2)) + "</pre></details></td></tr>").join("") +
          "</tbody></table>"
        : emptyState("Belum ada perubahan", "Perubahan penting akan tercatat setelah administrator mengelola arsip.");
    } catch (error) {
      $("#audit-results").innerHTML = showNotice(error.message, true);
    }
    return;
  }
  if (!config) {
    root.innerHTML = emptyState("Bagian admin tidak ditemukan", "Pilih bagian lain dari menu.");
    return;
  }
  root.innerHTML = '<h2>' + esc(config.title) + '</h2><p>' + esc(config.description) +
    '</p><div id="admin-notice" aria-live="polite"></div><div id="admin-editor"></div>' +
    '<button class="btn" id="new-record" type="button">+ Tambah ' + esc(config.title.toLowerCase()) +
    '</button><div id="admin-records" class="loading-state">Memuat catatan…</div>';
  $("#new-record").addEventListener("click", () => renderAdminForm(section, null));
  try {
    const records = await queryAllRows(config.table, "*", "created_at", false);
    const relationNames = {};
    for (const f of config.fields.filter((item) => item.type === "relation")) {
      const options = await relationOptions(f);
      relationNames[f.key] = Object.fromEntries(options.map((o) => [o.id, o[f.display] || o.id]));
    }
    const recordsRoot = $("#admin-records");
    recordsRoot.className = "";
    if (!records.length) {
      recordsRoot.innerHTML = emptyState("Belum ada catatan", "Tambahkan catatan setelah memeriksa sumber informasinya.");
      return;
    }
    recordsRoot.innerHTML = '<table class="admin-table"><thead><tr>' +
      config.columns.map((column) => "<th>" + esc(column.replaceAll("_", " ")) + "</th>").join("") +
      "<th>Aksi</th></tr></thead><tbody>" +
      records.map((record) => '<tr>' + config.columns.map((key) =>
        "<td>" + esc(adminCell(config, record, key, relationNames)) + "</td>").join("") +
        '<td><button type="button" class="table-action" data-edit="' + esc(record.id) + '">Edit</button>' +
        '<button type="button" class="table-action" data-delete="' + esc(record.id) + '">Hapus</button></td></tr>').join("") +
      "</tbody></table>";
    $$("[data-edit]", recordsRoot).forEach((button) => button.addEventListener("click", () => {
      const record = records.find((item) => item.id === button.dataset.edit);
      renderAdminForm(section, record);
      $("#admin-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    $$("[data-delete]", recordsRoot).forEach((button) => button.addEventListener("click", async () => {
      const record = records.find((item) => item.id === button.dataset.delete);
      const recordName = record?.tournament_name || record?.display_name || record?.character_name || record?.tier_name || record?.id;
      if (!confirm('Hapus catatan "' + recordName + '"? Hubungan data yang terkait dapat ikut terhapus. Tindakan ini tidak dapat dibatalkan.')) return;
      button.disabled = true;
      const { error } = await supabase.from(config.table).delete().eq("id", button.dataset.delete);
      if (error) {
        $("#admin-notice").innerHTML = showNotice(error.message, true);
        button.disabled = false;
      } else {
        toast("Catatan dihapus.");
        await loadAdminSection(section);
      }
    }));
  } catch (error) {
    $("#admin-records").className = "";
    $("#admin-records").innerHTML = showNotice(error.message || "Gagal memuat catatan.", true);
  }
}
async function renderRoute() {
  currentRoute = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  updatePublicNavigation();
  if (!currentRoute.length) {
    $("#app").innerHTML = homePage();
    return;
  }
  if (!supabase) {
    $("#app").innerHTML = '<section class="page-wrap">' + emptyState("Koneksi data belum tersedia", "Periksa koneksi internet dan muat ulang halaman.") + "</section>";
    return;
  }
  const [section, id] = currentRoute;
  if (section === "tournaments") return id ? tournamentDetail(id) : tournamentsPage();
  if (section === "champions") return id ? championDetail(id) : championsPage();
  if (section === "fun-fact") return funFactPage();
  if (section === "admin") return adminPage();
  $("#app").innerHTML = '<section class="page-wrap">' +
    emptyState("Halaman tidak ditemukan", "Tautan ini tidak tersedia di arsip DBX History.", '<a class="btn" href="#/">Kembali ke beranda ↗</a>') +
    "</section>";
}
$("#menu-toggle")?.addEventListener("click", () => {
  const nav = $("#main-nav");
  const open = nav.classList.toggle("open");
  $("#menu-toggle").setAttribute("aria-expanded", String(open));
});
window.addEventListener("hashchange", renderRoute);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    $("#main-nav").classList.remove("open");
    $("#menu-toggle")?.setAttribute("aria-expanded", "false");
  }
});
try {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.57.0");
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;
  supabase.auth.onAuthStateChange((_event, newSession) => {
    currentSession = newSession;
    currentAdmin = false;
    if (currentRoute[0] === "admin") renderRoute();
  });
} catch (error) {
  console.error("Supabase initialization failed", error);
}
await renderRoute();