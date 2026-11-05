"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AppSettings,
} from "@/lib/settings";

const card =
  "rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-4";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  async function loadInfo() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setEmail(user?.email ?? null);
    try {
      const [w, c] = await Promise.all([
        db.words.count(),
        db.srs_cards.count(),
      ]);
      setWordCount(w);
      setCardCount(c);
    } catch {
      // IndexedDB có thể chưa khả dụng
    }
  }

  useEffect(() => {
    setSettings(loadSettings());
    loadInfo();
    if ("speechSynthesis" in window) {
      const load = () =>
        setVoices(
          window.speechSynthesis
            .getVoices()
            .filter((v) => v.lang.toLowerCase().startsWith("zh"))
        );
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  async function handleClearOfflineCache() {
    try {
      await db.words.clear();
      await db.word_meanings_en.clear();
      await loadInfo();
      setStatusMsg("Đã xóa bộ nhớ đệm từ vựng ngoại tuyến.");
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
    <main className="space-y-6 pb-8">
      <section className={card}>
        <h1 className="text-2xl font-bold text-slate-900">Cài đặt</h1>
        <p className="text-sm text-slate-600">
          Tùy chỉnh việc học, giọng đọc và quản lý dữ liệu trên thiết bị này.
        </p>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900">Việc học</h2>

        <label className="block space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">Số thẻ mới mỗi ngày</span>
            <span className="font-semibold text-indigo-700">
              {settings.newPerDay}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={settings.newPerDay}
            onChange={(e) => update({ newPerDay: Number(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </label>

        <label className="block space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">Cấp HSK cho Nghe và Nói</span>
            <span className="font-semibold text-indigo-700">
              HSK {settings.listenLevel}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={9}
            step={1}
            value={settings.listenLevel}
            onChange={(e) => update({ listenLevel: Number(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </label>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900">Giọng đọc</h2>

        <label className="block space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">Tốc độ đọc</span>
            <span className="font-semibold text-indigo-700">
              {settings.ttsRate.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.2}
            step={0.1}
            value={settings.ttsRate}
            onChange={(e) => update({ ttsRate: Number(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="text-slate-700">Giọng tiếng Trung</span>
          {voices.length === 0 ? (
            <p className="text-slate-500">
              Thiết bị chưa có giọng tiếng Trung. Trên iPad: Cài đặt → Trợ năng
              → Nội dung được đọc → Giọng nói → Thêm Tiếng Trung.
            </p>
          ) : (
            <select
              value={settings.voiceURI ?? ""}
              onChange={(e) => update({ voiceURI: e.target.value || null })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
            >
              <option value="">Tự chọn</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          )}
        </label>
      </section>

      <section className={card}>
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

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900">
          Bộ nhớ ngoại tuyến
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
