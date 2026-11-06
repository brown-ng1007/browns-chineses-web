"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import { loadPractice, logActivity } from "@/lib/en/store";
import { norm, shuffle, speak } from "@/lib/en/quiz";
import type { EnWord } from "@/lib/en/words";

type Mode = "choose" | "type";
interface LQ {
  word: EnWord;
  options: EnWord[];
}

const ROUND = 10;
const NORMAL = 0.9;
const SLOW = 0.5;

function makeQs(words: EnWord[], pool: EnWord[]): LQ[] {
  const base = words.length >= 4 ? words : pool;
  return shuffle(words)
    .slice(0, ROUND)
    .map((w) => {
      const others = shuffle(base.filter((x) => x.id !== w.id && x.word.toLowerCase() !== w.word.toLowerCase()));
      const first = w.word[0]?.toLowerCase();
      const same = others.filter((x) => x.word[0]?.toLowerCase() === first);
      const sameSet = new Set(same);
      const picks = [...same, ...others.filter((o) => !sameSet.has(o))].slice(0, 3);
      return { word: w, options: shuffle([w, ...picks]) };
    });
}

export default function EnListenPage() {
  const [data, setData] = useState<{ pool: EnWord[]; words: EnWord[] } | null>(null);
  const [mode, setMode] = useState<Mode>("choose");
  const [slow, setSlow] = useState(false);
  const [qs, setQs] = useState<LQ[] | null>(null);
  const [qi, setQi] = useState(0);
  const [fb, setFb] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [score, setScore] = useState(0);
  const [end, setEnd] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPractice().then((d) => {
      if (alive) setData({ pool: d.pool, words: d.words });
    });
    return () => {
      alive = false;
    };
  }, []);

  const rate = slow ? SLOW : NORMAL;

  function start(m: Mode) {
    if (!data) return;
    const list = makeQs(data.words, data.pool);
    setMode(m);
    setQs(list);
    setQi(0);
    setScore(0);
    setFb(null);
    setPicked(null);
    setTyped("");
    setEnd(false);
    if (list[0]) speak(list[0].word.word, rate);
  }

  function answer(ok: boolean, choice: string | null) {
    if (fb !== null) return;
    setFb(ok);
    setPicked(choice);
    if (ok) setScore((s) => s + 1);
  }

  async function next() {
    if (!qs) return;
    if (qi + 1 >= qs.length) {
      setEnd(true);
      try {
        await logActivity("listen", score, qs.length);
      } catch {
        // không ghi được thống kê: bỏ qua
      }
      return;
    }
    const n = qi + 1;
    setQi(n);
    setFb(null);
    setPicked(null);
    setTyped("");
    speak(qs[n].word.word, rate);
  }

  const shell = "mx-auto w-full max-w-md space-y-4 pb-20 pt-2";
  const card = "rounded-2xl border-2 border-b-4 border-stone-200 bg-white p-5";

  if (!data) return <p className="py-20 text-center text-sm text-stone-500">Đang tải...</p>;

  if (!qs) {
    return (
      <main className={shell}>
        <EnHeader title="Nghe" sub="Nghe phát âm rồi chọn hoặc gõ đúng từ" />
        <div className={card}>
          <p className="text-sm text-stone-600">
            Mỗi lượt có {ROUND} từ lấy từ những từ bạn đã học. Chưa học đủ thì app dùng những từ đầu tiên trên bản đồ.
          </p>
        </div>
        <button type="button" className="en-btn" onClick={() => start("choose")}>
          Nghe và chọn từ
        </button>
        <button type="button" className="en-btn en-btn--blue" onClick={() => start("type")}>
          Nghe và gõ lại
        </button>
      </main>
    );
  }

  if (end) {
    return (
      <main className={shell}>
        <EnHeader title="Nghe" />
        <div className={`${card} text-center`}>
          <p className="text-5xl">🎧</p>
          <h2 className="mt-3 text-xl font-extrabold text-stone-900">
            Đúng {score}/{qs.length}
          </h2>
        </div>
        <button type="button" className="en-btn" onClick={() => start(mode)}>
          Chơi lại
        </button>
        <Link href="/en" className="en-btn en-btn--ghost">
          Về bản đồ
        </Link>
      </main>
    );
  }

  const q = qs[qi];
  return (
    <main className={shell}>
      <EnHeader title="Nghe" sub={`Câu ${qi + 1}/${qs.length}`} />
      <div className="h-3 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(qi / qs.length) * 100}%` }} />
      </div>

      <div className={`${card} flex items-center justify-center gap-4`}>
        <button
          type="button"
          onClick={() => speak(q.word.word, rate)}
          aria-label="Nghe lại"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-500 text-4xl shadow-[0_6px_0_#0369a1]"
        >
          🔊
        </button>
        <button
          type="button"
          onClick={() => setSlow(!slow)}
          className={`rounded-full border-2 px-3 py-2 text-sm font-extrabold ${
            slow ? "border-amber-500 bg-amber-50 text-amber-700" : "border-stone-200 text-stone-500"
          }`}
        >
          🐢 Chậm
        </button>
      </div>

      {mode === "choose" ? (
        <div className="space-y-3">
          {q.options.map((o) => {
            const isRight = o.id === q.word.id;
            const tone =
              fb === null
                ? "border-stone-200 bg-white text-stone-800"
                : isRight
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : picked === o.id
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-stone-200 bg-white text-stone-400";
            return (
              <button
                key={o.id}
                type="button"
                disabled={fb !== null}
                onClick={() => answer(isRight, o.id)}
                className={`block w-full rounded-2xl border-2 border-b-4 px-4 py-3 text-left text-lg font-bold ${tone}`}
              >
                {o.word}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={typed}
            disabled={fb !== null}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && typed.trim() && fb === null) answer(norm(typed) === norm(q.word.word), null);
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Gõ từ bạn nghe được"
            className="w-full rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-lg outline-none focus:border-emerald-400"
          />
          {fb === null && (
            <button
              type="button"
              className="en-btn"
              disabled={!typed.trim()}
              onClick={() => answer(norm(typed) === norm(q.word.word), null)}
            >
              Kiểm tra
            </button>
          )}
        </div>
      )}

      {fb !== null && (
        <div className={`${card} ${fb ? "border-emerald-300" : "border-red-300"}`}>
          <p className={`text-base font-extrabold ${fb ? "text-emerald-700" : "text-red-600"}`}>
            {fb ? "Chính xác" : "Chưa đúng"}
          </p>
          <p className="mt-1 text-lg font-bold text-stone-900">
            {q.word.word} <span className="text-sm font-normal text-stone-500">{q.word.ipa}</span>
          </p>
          <p className="text-sm text-orange-700">{q.word.vi.join("; ")}</p>
          <button type="button" className="en-btn mt-3" onClick={next}>
            {qi + 1 >= qs.length ? "Xem kết quả" : "Tiếp"}
          </button>
        </div>
      )}
    </main>
  );
}
