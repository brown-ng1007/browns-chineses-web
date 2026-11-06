"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import { loadPractice, logActivity } from "@/lib/en/store";
import { norm, shuffle, speak } from "@/lib/en/quiz";
import type { EnWord } from "@/lib/en/words";

// Nhận giọng nói của trình duyệt (Chrome, Safari). Chỉ là luyện, không chấm band.
interface SRAlt {
  transcript: string;
}
interface SRResult {
  length: number;
  [i: number]: SRAlt;
}
interface SREvent {
  results: { length: number; [i: number]: SRResult };
}
interface SR {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SRCtor = new () => SR;

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Mode = "word" | "sentence";
const ROUND = 8;

function tokens(s: string): string[] {
  return norm(s).split(" ").filter(Boolean);
}

// Từ: nghe thấy đúng từ đó. Câu: nghe thấy từ 80% số từ của câu.
function judge(mode: Mode, target: string, heard: string[]): { ok: boolean; missing: string[] } {
  const want = tokens(target);
  if (mode === "word") {
    const nw = want.join(" ");
    const ok = heard.some((h) => ` ${tokens(h).join(" ")} `.includes(` ${nw} `));
    return { ok, missing: ok ? [] : want };
  }
  let best: string[] = want;
  let bestHit = -1;
  for (const h of heard) {
    const set = new Set(tokens(h));
    const miss = want.filter((t) => !set.has(t));
    const hit = want.length - miss.length;
    if (hit > bestHit) {
      bestHit = hit;
      best = miss;
    }
  }
  return { ok: want.length > 0 && bestHit / want.length >= 0.8, missing: best };
}

export default function EnSpeakPage() {
  const [data, setData] = useState<EnWord[] | null>(null);
  const [mode, setMode] = useState<Mode>("word");
  const [items, setItems] = useState<EnWord[] | null>(null);
  const [i, setI] = useState(0);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string[]>([]);
  const [res, setRes] = useState<{ ok: boolean; missing: string[] } | null>(null);
  const [err, setErr] = useState("");
  const [end, setEnd] = useState(false);
  const [supported, setSupported] = useState(true);
  const okCount = useRef(0);
  const passedThis = useRef(false);
  const rec = useRef<SR | null>(null);

  useEffect(() => {
    let alive = true;
    setSupported(getSR() !== null);
    loadPractice().then((d) => {
      if (alive) setData(d.words);
    });
    return () => {
      alive = false;
      try {
        rec.current?.stop();
      } catch {
        // không có gì để dừng
      }
    };
  }, []);

  function start(m: Mode) {
    if (!data) return;
    const pickFrom = m === "sentence" ? data.filter((w) => tokens(w.example).length >= 3) : data;
    const list = shuffle(pickFrom.length > 0 ? pickFrom : data).slice(0, ROUND);
    setMode(m);
    setItems(list);
    setI(0);
    setHeard([]);
    setRes(null);
    setErr("");
    setEnd(false);
    okCount.current = 0;
    passedThis.current = false;
  }

  function targetOf(w: EnWord): string {
    return mode === "word" ? w.word : w.example || w.word;
  }

  function listen(w: EnWord) {
    const Ctor = getSR();
    if (!Ctor) return;
    setErr("");
    setHeard([]);
    setRes(null);
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 5;
    r.onresult = (e) => {
      const alts: string[] = [];
      for (let a = 0; a < e.results.length; a++) {
        for (let b = 0; b < e.results[a].length; b++) alts.push(e.results[a][b].transcript);
      }
      const verdict = judge(mode, targetOf(w), alts);
      setHeard(alts);
      setRes(verdict);
      if (verdict.ok) passedThis.current = true;
    };
    r.onerror = (e) => {
      setErr(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Chưa cho phép dùng micro. Hãy bật quyền micro cho trang này."
          : e.error === "no-speech"
            ? "Không nghe thấy giọng nói, thử lại nhé."
            : `Không nhận được giọng nói (${e.error}).`
      );
    };
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
      setErr("Không bật được micro.");
    }
  }

  async function next(manualOk?: boolean) {
    if (!items) return;
    if (manualOk) passedThis.current = true;
    if (passedThis.current) okCount.current += 1;
    passedThis.current = false;
    if (i + 1 >= items.length) {
      setEnd(true);
      try {
        await logActivity("speak", okCount.current, items.length);
      } catch {
        // không ghi được thống kê: bỏ qua
      }
      return;
    }
    setI(i + 1);
    setHeard([]);
    setRes(null);
    setErr("");
  }

  const shell = "mx-auto w-full max-w-md space-y-4 pb-20 pt-2";
  const card = "rounded-2xl border-2 border-b-4 border-stone-200 bg-white p-5";

  if (!data) return <p className="py-20 text-center text-sm text-stone-500">Đang tải...</p>;

  if (!items) {
    return (
      <main className={shell}>
        <EnHeader title="Nói" sub="Nghe mẫu, đọc lại bằng micro" />
        <div className={card}>
          <p className="text-sm text-stone-600">
            Mỗi lượt có {ROUND} mục. App nghe bạn đọc và xem có nhận ra đúng từ không. Đây chỉ là luyện phát âm, app
            không chấm điểm band IELTS.
          </p>
          {!supported && (
            <p className="mt-3 text-sm font-semibold text-amber-700">
              Trình duyệt này chưa hỗ trợ nhận giọng nói. Hãy dùng Chrome hoặc Safari, hoặc tự chấm bằng hai nút ở
              cuối mỗi mục.
            </p>
          )}
        </div>
        <button type="button" className="en-btn" onClick={() => start("word")}>
          Luyện đọc từ
        </button>
        <button type="button" className="en-btn en-btn--blue" onClick={() => start("sentence")}>
          Luyện đọc câu
        </button>
      </main>
    );
  }

  if (end) {
    return (
      <main className={shell}>
        <EnHeader title="Nói" />
        <div className={`${card} text-center`}>
          <p className="text-5xl">🎤</p>
          <h2 className="mt-3 text-xl font-extrabold text-stone-900">
            Đọc đúng {okCount.current}/{items.length}
          </h2>
        </div>
        <button type="button" className="en-btn" onClick={() => start(mode)}>
          Luyện tiếp
        </button>
        <Link href="/en" className="en-btn en-btn--ghost">
          Về bản đồ
        </Link>
      </main>
    );
  }

  const w = items[i];
  const target = targetOf(w);
  return (
    <main className={shell}>
      <EnHeader title="Nói" sub={`Mục ${i + 1}/${items.length}`} />
      <div className="h-3 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(i / items.length) * 100}%` }} />
      </div>

      <div className={card}>
        <p className="text-2xl font-extrabold leading-snug text-stone-900">{target}</p>
        {mode === "word" && <p className="mt-1 text-sm text-stone-500">{[w.ipa, w.pos].filter(Boolean).join(" · ")}</p>}
        <p className="mt-2 text-sm text-orange-700">{w.vi.join("; ")}</p>
        <button type="button" onClick={() => speak(target, 0.8)} className="mt-3 rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-800">
          🔊 Nghe mẫu
        </button>
      </div>

      {supported ? (
        <button type="button" className="en-btn en-btn--red" disabled={listening} onClick={() => listen(w)}>
          {listening ? "Đang nghe..." : "🎤 Bấm và đọc"}
        </button>
      ) : null}

      {err && <p className="text-sm font-semibold text-red-600">{err}</p>}

      {res && (
        <div className={`${card} ${res.ok ? "border-emerald-300" : "border-red-300"}`}>
          <p className={`text-base font-extrabold ${res.ok ? "text-emerald-700" : "text-red-600"}`}>
            {res.ok ? "Nhận ra đúng" : "Chưa nhận ra đúng"}
          </p>
          <p className="mt-1 text-sm text-stone-600">App nghe được: {heard[0] ?? ""}</p>
          {!res.ok && res.missing.length > 0 && (
            <p className="mt-1 text-sm text-stone-500">Còn thiếu: {res.missing.join(", ")}</p>
          )}
        </div>
      )}

      {supported ? (
        <button type="button" className="en-btn en-btn--ghost" onClick={() => next()}>
          {i + 1 >= items.length ? "Xem kết quả" : res?.ok ? "Tiếp" : "Bỏ qua"}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="en-btn en-btn--ghost" onClick={() => next(false)}>
            Cần luyện thêm
          </button>
          <button type="button" className="en-btn" onClick={() => next(true)}>
            Mình đọc ổn
          </button>
        </div>
      )}
    </main>
  );
}
