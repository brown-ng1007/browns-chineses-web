"use client";

import { useEffect, useRef, useState } from "react";
import { refreshSettings, type AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { logSkill } from "@/lib/skill-log";
import {
  loadPracticeWords,
  shuffle,
  speak,
  type PracticeWord,
} from "@/lib/practice-words";

const card =
  "rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90";

interface RecResult {
  0: { transcript: string };
}
interface RecEvent {
  results: ArrayLike<RecResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecCtor = new () => Recognition;

function getRecognition(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecCtor;
    webkitSpeechRecognition?: RecCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Bỏ dấu câu và khoảng trắng để so sánh chữ Hán. */
function clean(s: string): string {
  return s.replace(/[\s\p{P}\p{S}]/gu, "");
}

type Verdict = "ok" | "close" | "miss";

function judge(heard: string, target: string): Verdict {
  const h = clean(heard);
  const t = clean(target);
  if (!h) return "miss";
  if (h === t) return "ok";
  if (h.includes(t) || t.includes(h)) return "close";
  let same = 0;
  for (const ch of t) if (h.includes(ch)) same++;
  return same / t.length >= 0.5 ? "close" : "miss";
}

export default function SpeakPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [words, setWords] = useState<PracticeWord[] | null>(null);
  const [order, setOrder] = useState<PracticeWord[]>([]);
  const [i, setI] = useState(0);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<Recognition | null>(null);
  const lastAtRef = useRef<number>(Date.now());

  useEffect(() => {
    setSupported(getRecognition() !== null);
    refreshSettings()
      .then((s) => {
        setSettings(s);
        return loadPracticeWords(s.listenLevel);
      })
      .then((w) => {
        setWords(w);
        setOrder(shuffle(w));
      })
      .catch(() => setWords([]));
  }, []);

  const word = order[i];

  function reset() {
    setHeard(null);
    setVerdict(null);
    setError(null);
  }

  function go(delta: number) {
    reset();
    setI((cur) => (order.length ? (cur + delta + order.length) % order.length : 0));
  }

  function startListening() {
    const Ctor = getRecognition();
    if (!Ctor || !word) return;
    reset();
    const rec = new Ctor();
    rec.lang = "zh-CN";
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      const v = judge(text, word.hanzi);
      setHeard(text);
      setVerdict(v);
      const minutes = Math.min(2, (Date.now() - lastAtRef.current) / 60000);
      lastAtRef.current = Date.now();
      void logSkill("speaking", minutes, v === "ok" ? 1 : v === "close" ? 0.5 : 0);
    };
    rec.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Chưa cấp quyền micro. Hãy cho phép micro cho trang này trong cài đặt trình duyệt."
          : e.error === "no-speech"
          ? "Mình không nghe thấy giọng nói. Thử nói to và gần micro hơn."
          : `Không nhận dạng được (${e.error}).`
      );
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  return (
    <main className="space-y-6 pb-8">
      <section className={card}>
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">
          Luyện nói • HSK {settings.listenLevel}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
          Đọc theo mẫu
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Nghe mẫu, bấm micro rồi đọc lại. App so sánh điều nó nghe được với chữ
          Hán. Cần mạng và quyền dùng micro.
        </p>
      </section>

      {!supported && (
        <section className={card}>
          <p className="text-sm text-slate-700">
            Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Trên iPad/iPhone hãy
            dùng Safari, và bật Đọc chính tả trong Cài đặt → Cài đặt chung → Bàn
            phím.
          </p>
        </section>
      )}

      {words === null && (
        <section className={card}>
          <p className="text-sm text-slate-600">Đang tải từ vựng...</p>
        </section>
      )}

      {words !== null && words.length === 0 && (
        <section className={card}>
          <p className="text-sm text-slate-700">
            Chưa có từ HSK {settings.listenLevel} trên thiết bị. Mở tab Từ vựng
            một lần (khi có mạng) để tải từ về, rồi quay lại đây.
          </p>
        </section>
      )}

      {word && (
        <section className={`${card} space-y-5 text-center`}>
          <div className="text-xs text-slate-500">
            Từ {i + 1}/{order.length}
          </div>
          <div className="font-hanzi text-6xl font-bold text-slate-900">
            {word.hanzi}
          </div>
          <div className="text-lg text-slate-700">{word.pinyin}</div>
          {word.meaning && (
            <div className="text-sm text-slate-500">{word.meaning}</div>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={() =>
                speak(word.hanzi, {
                  rate: settings.ttsRate,
                  voiceURI: settings.voiceURI,
                })
              }
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              🔊 Nghe mẫu
            </button>
            <button
              type="button"
              disabled={!supported}
              onClick={listening ? stopListening : startListening}
              className={`rounded-2xl px-6 py-3 text-sm font-semibold text-white transition disabled:opacity-40 ${
                listening ? "bg-red-600 animate-pulse" : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {listening ? "⏹ Đang nghe... bấm để dừng" : "🎤 Đọc theo"}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}

          {heard !== null && verdict && (
            <div
              className={`rounded-2xl border p-4 text-sm space-y-1 ${
                verdict === "ok"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : verdict === "close"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-red-50 border-red-200 text-red-900"
              }`}
            >
              <div className="font-semibold">
                {verdict === "ok"
                  ? "Chuẩn!"
                  : verdict === "close"
                  ? "Gần đúng, thử lại cho rõ từng âm."
                  : "Chưa khớp, nghe mẫu rồi đọc lại nhé."}
              </div>
              <div>
                Máy nghe được:{" "}
                <span className="font-hanzi text-lg">{heard}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => go(-1)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
            >
              ← Trước
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOrder(shuffle(order));
                setI(0);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
            >
              Xáo trộn
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Sau →
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
