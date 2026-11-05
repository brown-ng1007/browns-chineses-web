"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/config";
import Watermelon from "@/components/Watermelon";

// Supabase bắt buộc có email, nên tên đăng nhập được ghép thành một email nội bộ.
// Người dùng không bao giờ thấy email này và không có thư nào được gửi đi.
const FAKE_DOMAIN = "browns-chineses.app";
const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;

function toEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  // Tài khoản cũ đăng ký bằng email thật: cứ gõ nguyên email vào ô này
  if (v.includes("@")) return v;
  if (!USERNAME_RE.test(v)) return null;
  return `${v}@${FAKE_DOMAIN}`;
}

function viError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Sai tên đăng nhập hoặc mật khẩu.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Tên này đã có người dùng, hãy chọn tên khác.";
  if (m.includes("password") && m.includes("character"))
    return "Mật khẩu cần có ít nhất 6 ký tự.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Thử quá nhiều lần, hãy đợi một lát rồi thử lại.";
  if (m.includes("invalid") && m.includes("email"))
    return "Hệ thống từ chối tên này, hãy thử một tên khác.";
  return msg;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  function fail(msg: string) {
    setErrorMsg(msg);
    setShake((s) => s + 1);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    const email = toEmail(username);
    if (!email) {
      fail("Tên đăng nhập gồm 3 đến 20 ký tự: chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          fail(viError(error.message));
        } else {
          router.push("/");
          router.refresh();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          fail(viError(error.message));
        } else if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          fail(
            "Đã tạo tài khoản nhưng Supabase vẫn đang đòi xác nhận email. Hãy tắt \"Confirm email\" trong Authentication."
          );
        }
      }
    } catch {
      fail("Lỗi kết nối. Hãy thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-2xl border border-rose-200 bg-white/90 px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/15 transition";

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="rise w-full max-w-sm rounded-3xl bg-white/85 backdrop-blur-xl p-6 sm:p-8 border border-white/90 shadow-[0_3px_0_0_#d9f99d,0_6px_0_0_#22a45a,0_24px_50px_rgba(229,51,79,0.18)]">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-50 to-pink-100 ring-1 ring-rose-200 flex items-center justify-center shadow-md shadow-rose-500/20">
            <Watermelon className="hero-slice w-16 h-auto" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-rose-700 via-red-600 to-emerald-700 bg-clip-text text-transparent">
            {APP_NAME}
          </h1>
          <p className="text-sm text-emerald-700/70 mt-1">Góc học của Dưa Hấu</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-stone-700 mb-1">
              Tên đăng nhập
            </label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="duahau"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-stone-700 mb-1">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự"
              className={inputCls}
            />
          </div>

          {errorMsg && (
            <div
              key={shake}
              role="alert"
              className="anim-shake rounded-2xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-red-500 py-3.5 text-base font-bold text-white shadow-lg shadow-rose-500/30 disabled:opacity-60"
          >
            {loading ? "Đang xử lý..." : mode === "signin" ? "Vào học" : "Tạo tài khoản"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setErrorMsg(null);
          }}
          className="mt-4 w-full text-center text-sm font-medium text-stone-500 hover:text-rose-600"
        >
          {mode === "signin" ? "Chưa có tài khoản? Tạo mới" : "Đã có tài khoản? Đăng nhập"}
        </button>
      </div>
    </main>
  );
}
