import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://dbx-history.vercel.app",
  "https://dbx-history-nffachys-projects.vercel.app",
  "https://dbx-history-git-main-nffachys-projects.vercel.app",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function headersFor(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : "https://dbx-history.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function response(origin: string | null, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
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
    } catch {
      if (value.startsWith("sb_")) return value;
    }
  }
  const fallback = Deno.env.get(legacy);
  if (fallback) return fallback;
  throw new Error("Required Supabase key is not configured for this function.");
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headersFor(origin) });
  }
  if (request.method !== "POST") {
    return response(origin, { error: "Method not allowed." }, 405);
  }
  if (origin && !allowedOrigins.has(origin)) {
    return response(origin, { error: "Origin not allowed." }, 403);
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return response(origin, { error: "Invalid request." }, 400);
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || password.length < 1 || password.length > 256) {
    return response(origin, { error: "Username atau kata sandi salah." }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured.");
    const secretKey = getKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    const publishableKey = getKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: mapping, error: mappingError } = await adminClient
      .from("admin_usernames")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();

    if (mappingError) {
      console.error("Username mapping lookup failed.");
      return response(origin, { error: "Login sementara tidak tersedia. Coba lagi nanti." }, 503);
    }
    if (!mapping?.user_id) {
      return response(origin, { error: "Username atau kata sandi salah." }, 401);
    }

    const { data: authUser, error: authUserError } = await adminClient.auth.admin.getUserById(mapping.user_id);
    const email = authUser?.user?.email;
    if (authUserError || !email) {
      console.error("Mapped Auth user could not be loaded.");
      return response(origin, { error: "Login sementara tidak tersedia. Coba lagi nanti." }, 503);
    }

    const loginClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: signInData, error: signInError } = await loginClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      const authStatus = (signInError as { status?: number } | null)?.status;
      if (authStatus === 429) {
        return response(origin, { error: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi." }, 429);
      }
      return response(origin, { error: "Username atau kata sandi salah. Periksa juga apakah akun Auth sudah dikonfirmasi." }, 401);
    }

    return response(origin, {
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    });
  } catch (error) {
    console.error("Username login failed.", error instanceof Error ? error.message : "Unknown error");
    return response(origin, { error: "Layanan login sementara tidak tersedia. Coba lagi nanti." }, 503);
  }
});
