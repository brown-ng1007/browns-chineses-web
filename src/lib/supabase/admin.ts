import { createClient } from "@supabase/supabase-js";

/**
 * Kết nối Supabase bằng khóa service role.
 * CHỈ dùng trong route handler / code chạy ở máy chủ.
 * TUYỆT ĐỐI không import file này vào component chạy ở trình duyệt.
 * Khóa SUPABASE_SERVICE_ROLE_KEY không được có tiền tố NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Thiếu cấu hình Supabase phía máy chủ");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
