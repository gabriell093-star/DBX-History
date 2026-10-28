import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://dbx-history.vercel.app",
  "https://dbx-history-nffachys-projects.vercel.app",
  "https://dbx-history-git-main-nffachys-projects.vercel.app",
]);
const commonHeaders: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};
function headersFor(origin: string | null, extra: Record<string, string> = {}) {
  const headers = { ...commonHeaders, ...extra };
  if (origin && allowedOrigins.has(origin)) Object.assign(headers, {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  });
  return headers;
}
function jsonResponse(origin: string | null, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin, extraHeaders) });
}
function getKey(primary: string, legacy: string): string {
  const value = Deno.env.get(primary);
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        const candidate = parsed.default;
        if (typeof candidate === "string" && candidate) return candidate;
      }
    } catch { if (value.startsWith("sb_")) return value; }
  }
  const fallback = Deno.env.get(legacy);
  if (fallback) return fallback;
  throw new Error("Required Supabase key is not configured for this function.");
}
async function keyedHash(secret: string, scope: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(scope + ":" + value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function clientIp(request: Request): string {
  const candidate = request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return candidate.slice(0, 128);
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return new Response(null, { status: 403, headers: headersFor(origin) });
    return new Response(null, { status: 204, headers: headersFor(origin) });
  }
  if (request.method !== "POST") return jsonResponse(origin, { error: "Method not allowed." }, 405, { Allow: "POST, OPTIONS" });
  if (!origin || !allowedOrigins.has(origin)) return jsonResponse(origin, { error: "Origin not allowed." }, 403);

  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return jsonResponse(origin, { error: "Content-Type must be application/json." }, 415);
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 4096) return jsonResponse(origin, { error: "Invalid request." }, 413);

  let body: { username?: unknown; password?: unknown };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 4096) return jsonResponse(origin, { error: "Invalid request." }, 413);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return jsonResponse(origin, { error: "Invalid request." }, 400);
    body = parsed as { username?: unknown; password?: unknown };
  } catch { return jsonResponse(origin, { error: "Invalid request." }, 400); }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || password.length < 1 || password.length > 256) {
    return jsonResponse(origin, { error: "Username atau kata sandi salah." }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured.");
    const secretKey = getKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    const publishableKey = getKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const [ipHash, usernameHash] = await Promise.all([
      keyedHash(secretKey, "ip", clientIp(request)), keyedHash(secretKey, "username", username),
    ]);
    const { data: limitRows, error: limitError } = await adminClient.rpc(
      "consume_admin_login_attempt", { p_ip_hash: ipHash, p_username_hash: usernameHash },
    );
    if (limitError) {
      console.error("Login rate limiter unavailable.");
      return jsonResponse(origin, { error: "Layanan login sementara tidak tersedia. Coba lagi nanti." }, 503);
    }
    const limit = Array.isArray(limitRows) ? limitRows[0] : limitRows;
    if (!limit || typeof limit.allowed !== "boolean") {
      console.error("Login rate limiter returned an invalid response.");
      return jsonResponse(origin, { error: "Layanan login sementara tidak tersedia. Coba lagi nanti." }, 503);
    }
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Number(limit.retry_after_seconds) || 60);
      return jsonResponse(origin, { error: "Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi." }, 429, {
        "Retry-After": String(retryAfter),
      });
    }

    const { data: mapping, error: mappingError } = await adminClient.from("admin_usernames")
      .select("user_id").eq("username", username).maybeSingle();
    if (mappingError) {
      console.error("Username mapping lookup failed.");
      return jsonResponse(origin, { error: "Layanan login sementara tidak tersedia. Coba lagi nanti." }, 503);
    }
    if (!mapping?.user_id) return jsonResponse(origin, { error: "Username atau kata sandi salah." }, 401);

    const { data: authUser, error: authUserError } = await adminClient.auth.admin.getUserById(mapping.user_id);
    const email = authUser?.user?.email;
    if (authUserError || !email) {
      console.error("Mapped Auth user could not be loaded.");
      return jsonResponse(origin, { error: "Layanan login sementara tidak tersedia. Coba lagi nanti." }, 503);
    }

    const loginClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: signInData, error: signInError } = await loginClient.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.session) {
      const authStatus = (signInError as { status?: number } | null)?.status;
      if (authStatus === 429) return jsonResponse(origin,
        { error: "Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi." }, 429, { "Retry-After": "60" });
      return jsonResponse(origin, { error: "Username atau kata sandi salah." }, 401);
    }

    const { error: clearError } = await adminClient.rpc(
      "clear_admin_login_username_attempts", { p_username_hash: usernameHash },
    );
    if (clearError) console.error("Successful login counter could not be reset.");
    return jsonResponse(origin, {
      session: { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token },
    });
  } catch (error) {
    console.error("Username login failed.", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse(origin, { error: "Layanan login sementara tidak tersedia. Coba lagi nanti." }, 503);
  }
});
