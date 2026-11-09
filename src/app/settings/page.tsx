"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db";
import { speak as speakEn } from "@/lib/en/quiz";
import { resetEnProgress } from "@/lib/en/store";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  pushSettingsDebounced,
  refreshSettings,
  saveSettings,
  type AppSettings,
  type EnAccent,
} from "@/lib/settings";

const card =
  "rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-4";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [enStageCount, setEnStageCount] = useState(0);
  const [enStarCount, setEnStarCount] = useState(0);
  const [enCardCount, setEnCardCount] = useState(0);
  const [enLogCount, setEnLogCount] = useState(0);
  const [confirmEnReset, setConfirmEnReset] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [zhVoices, setZhVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [enVoices, setEnVoices] = useState<SpeechSynthesisVoice[]>([]);

  async function loadInfo() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setEmail(user?.email ?? null);
    try {
      const [w, c, enProgs, enCards, enLogs] = await Promise.all([
        db.words.count(),
        db.srs_cards.count(),
        db.en_progress.toArray(),
        db.en_cards.count(),
        db.en_logs.count(),
      ]);
      setWordCount(w);
      setCardCount(c);
      setEnStageCount(enProgs.filter((p) => p.stars > 0).length);
      setEnStarCount(enProgs.reduce((acc, p) => acc + p.stars, 0));
      setEnCardCount(enCards);
      setEnLogCount(enLogs);
    } catch {
      // IndexedDB có thể chưa khả dụng
    }
  }

  useEffect(() => {
    setSettings(loadSettings());
    void refreshSettings().then(setSettings);
    void loadInfo();
    if ("speechSynthesis" in window) {
      const load = () => {
        const all = window.speechSynthesis.getVoices();
        setZhVoices(all.filter((v) => v.lang.toLowerCase().startsWith("zh")));
        setEnVoices(
          all
            .filter((v) => v.lang.toLowerCase().startsWith("en"))
            .sort((a, b) => {
              const aNat = a.name.includes("Natural") || a.name.includes("Google") ? 1 : 0;
              const bNat = b.name.includes("Natural") || b.name.includes("Google") ? 1 : 0;
              return bNat - aNat;
            })
        );
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    pushSettingsDebounced(next);
  }

  const filteredEnVoices = enVoices.filter((v) => {
    if (!settings.enAccent || settings.enAccent === "ALL") return true;
    return v.lang.replace("_", "-").startsWith(settings.enAccent);
  });

  async function handleResetEnglishProgress() {
    try {
      await resetEnProgress();
      setConfirmEnReset(false);
      await loadInfo();
      setStatusMsg("Đã xóa toàn bộ tiến độ học Tiếng Anh (chặng, sao, thẻ SRS và XP) về ban đầu.");
    } catch {
      setStatusMsg("Không thể xóa tiến độ Tiếng Anh.");
    }
  }

  async function handleClearOfflineCache() {
    try {
      await db.words.clear();
      await db.word_meanings_en.clear();
      await db.en_cache.clear();
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
          Tùy chỉnh việc học, giọng đọc Tiếng Anh / Tiếng Trung và quản lý tiến độ học tập.
        </p>
      </section>

      {/* GIỌNG ĐỌC TIẾNG ANH */}
      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Giọng đọc Tiếng Anh (TOEIC / IELTS)
            </h2>
            <p className="text-xs text-slate-500">
              Áp dụng cho toàn bộ bài học lộ trình, từ vựng, ôn tập, nghe, nói và trò chơi.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              speakEn(
                "Practice makes perfect. Welcome to Melon Language English course!",
                settings.enTtsRate
              )
            }
            className="shrink-0 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
          >
            🔊 Nghe thử
          </button>
        </div>

        <div className="space-y-2">
          <span className="block text-sm text-slate-700">Vùng giọng (Accent)</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "ALL", label: "Tất cả" },
                { id: "en-US", label: "🇺🇸 Anh - Mỹ (US)" },
                { id: "en-GB", label: "🇬🇧 Anh - Anh (UK)" },
                { id: "en-AU", label: "🇦🇺 Anh - Úc (AU)" },
              ] as { id: EnAccent; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => update({ enAccent: tab.id, enVoiceURI: null })}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  settings.enAccent === tab.id
                    ? "bg-[#0b6b53] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="text-slate-700">Chọn giọng đọc Tiếng Anh</span>
          {filteredEnVoices.length === 0 ? (
            <p className="text-slate-500">
              Đang dùng giọng Tiếng Anh mặc định của thiết bị.
            </p>
          ) : (
            <select
              value={settings.enVoiceURI ?? ""}
              onChange={(e) => update({ enVoiceURI: e.target.value || null })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800"
            >
              <option value="">Tự động chọn giọng tự nhiên nhất</option>
              {filteredEnVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang}){" "}
                  {v.name.includes("Natural") || v.name.includes("Google")
                    ? "⭐ Tự nhiên"
                    : ""}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="block space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">Tốc độ đọc Tiếng Anh</span>
            <span className="font-semibold text-indigo-700">
              {(settings.enTtsRate ?? 0.95).toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.3}
            step={0.05}
            value={settings.enTtsRate ?? 0.95}
            onChange={(e) => update({ enTtsRate: Number(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </label>
      </section>

      {/* GIỌNG ĐỌC & VIỆC HỌC TIẾNG TRUNG */}
      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900">
          Giọng đọc & Việc học Tiếng Trung
        </h2>

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

        <label className="block space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">Tốc độ đọc Tiếng Trung</span>
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
          {zhVoices.length === 0 ? (
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
              {zhVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          )}
        </label>
      </section>

      {/* QUẢN LÝ & XÓA TIẾN ĐỘ HỌC TẬP */}
      <section className={card}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Quản lý tiến độ & Bộ nhớ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Xem thống kê dữ liệu đang lưu trên thiết bị và đặt lại tiến độ học khi cần.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-emerald-50/70 p-3.5 border border-emerald-200/80">
            <span className="block text-xs text-emerald-700">Chặng Tiếng Anh đã qua</span>
            <span className="text-base font-bold text-emerald-950">
              {enStageCount} chặng ({enStarCount} ⭐)
            </span>
          </div>
          <div className="rounded-xl bg-emerald-50/70 p-3.5 border border-emerald-200/80">
            <span className="block text-xs text-emerald-700">Thẻ ôn SRS Tiếng Anh</span>
            <span className="text-base font-bold text-emerald-950">
              {enCardCount} thẻ
            </span>
          </div>
          <div className="rounded-xl bg-emerald-50/70 p-3.5 border border-emerald-200/80">
            <span className="block text-xs text-emerald-700">Nhật ký luyện tập EN</span>
            <span className="text-base font-bold text-emerald-950">
              {enLogCount} lượt
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
            <span className="text-slate-500">Từ HSK đã lưu tạm:</span>{" "}
            <span className="font-semibold text-slate-900">{wordCount}</span>
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
            <span className="text-slate-500">Thẻ ôn tập HSK (SRS):</span>{" "}
            <span className="font-semibold text-slate-900">{cardCount}</span>
          </div>
        </div>

        {statusMsg && (
          <p className="text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            ✓ {statusMsg}
          </p>
        )}

        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-rose-900">
              🗑 Xóa tiến độ học Tiếng Anh
            </h3>
            <p className="text-xs text-rose-700 mt-0.5">
              Đặt lại toàn bộ các chặng trên bản đồ Tiếng Anh về 0/11, xóa số sao, thẻ ôn SRS Tiếng Anh và lịch sử điểm XP.
            </p>
          </div>

          {!confirmEnReset ? (
            <button
              type="button"
              onClick={() => setConfirmEnReset(true)}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition shadow-xs"
            >
              Xóa toàn bộ tiến độ Tiếng Anh
            </button>
          ) : (
            <div className="rounded-xl bg-white p-3.5 border border-rose-200 space-y-2.5">
              <p className="text-xs font-semibold text-slate-800">
                ⚠️ Bạn có chắc chắn muốn xóa toàn bộ tiến độ Tiếng Anh ({enStageCount} chặng, {enStarCount} sao, {enCardCount} thẻ ôn)? Hành động này không thể hoàn tác.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetEnglishProgress}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
                >
                  Xác nhận xóa sạch
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEnReset(false)}
                  className="rounded-lg bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleClearOfflineCache}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Xóa bộ nhớ đệm từ vựng ngoại tuyến
          </button>
        </div>
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
    </main>
  );
}
