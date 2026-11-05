"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState<number>(0);
  const [cardCount, setCardCount] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function loadInfo() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setEmail(user?.email ?? null);

    try {
      const [wCount, cCount] = await Promise.all([
        db.words.count(),
        db.srs_cards.count(),
      ]);
      setWordCount(wCount);
      setCardCount(cCount);
    } catch {
      // IndexedDB có thể chưa khả dụng ở môi trường đặc biệt
    }
  }

  useEffect(() => {
    loadInfo();
  }, []);

  async function handleClearOfflineCache() {
    try {
      await db.words.clear();
      await db.word_meanings_en.clear();
      await loadInfo();
      setStatusMsg("Đã xóa bộ nhớ đệm từ vựng ngoại tuyến (Dexie).");
    } catch {
      setStatusMsg("Không thể xóa bộ nhớ đệm.");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Cài đặt</h1>
        <p className="text-slate-600 mt-1">
          Quản lý tài khoản và dữ liệu ngoại tuyến trên thiết bị.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Tài khoản</h2>
        <p className="text-sm text-slate-600">
          Email đang đăng nhập:{" "}
          <span className="font-medium text-slate-900">
            {email ?? "Đang tải..."}
          </span>
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition"
        >
          Đăng xuất
        </button>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Bộ nhớ ngoại tuyến (Dexie / IndexedDB)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
            <span className="text-slate-500">Số từ đã lưu tạm:</span>{" "}
            <span className="font-semibold text-slate-900">{wordCount}</span>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
            <span className="text-slate-500">Số thẻ ôn tập (SRS):</span>{" "}
            <span className="font-semibold text-slate-900">{cardCount}</span>
          </div>
        </div>

        {statusMsg && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            {statusMsg}
          </p>
        )}

        <button
          type="button"
          onClick={handleClearOfflineCache}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          Xóa bộ nhớ đệm từ vựng
        </button>
      </section>
    </main>
  );
}