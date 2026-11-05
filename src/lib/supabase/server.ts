import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (dùng trong Server Components, Route Handlers, Server Actions).
 * Chỉ dùng khóa công khai NEXT_PUBLIC_* và cookie của người dùng để đảm bảo RLS hoạt động đúng.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Bỏ qua lỗi khi setAll được gọi từ Server Component
            // vì middleware sẽ đảm nhiệm việc làm mới phiên đăng nhập.
          }
        },
      },
    }
  );
}