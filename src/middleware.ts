import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Đọc phiên từ cookie, không gọi mạng tới Supabase mỗi lần chuyển trang
  // (trước đây getUser() làm mọi trang và mọi lượt tải trước đều chờ thêm một vòng mạng).
  // Bước này chỉ dùng để chuyển hướng; dữ liệu vẫn được bảo vệ bởi RLS
  // và /api/* tự kiểm tra phiên. Phiên hết hạn vẫn được làm mới tự động ở đây.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const hasSession = session !== null;

  const pathname = request.nextUrl.pathname;

  // Các đường dẫn công khai hoặc tự xử lý xác thực riêng (như /api/* trả mã 401 JSON)
  const isPublicOrApi =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js";

  // Chưa đăng nhập mà vào các trang học -> chuyển về /login
  if (!hasSession && !isPublicOrApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Đã đăng nhập mà vào /login -> chuyển về trang chủ /
  if (hasSession && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};