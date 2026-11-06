"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import { loadPractice, logActivity } from "@/lib/en/store";
import { meaningOptions, shortMeaning } from "@/lib/en/games";
import { shuffle, speak } from "@/lib/en/quiz";
import type { EnWord } from "@/lib/en/words";

const SECONDS = 60;
const LIVES = 3;
const BEST_KEY = "en_speed_best";

interface Q {
  word: EnWord;
  options: string[];
}

export default function EnSpeedPage() {
  const [data, setData] = useState<{ pool: EnWord[]; words: EnWord[] } | null>(null);
  const [phase, setPhase] = useState<"ready" | "play" | "end">("ready");
  const [q, setQ] = useState<Q | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const [lives, setLives] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [right, setRight] = useState(0);
  const [asked, setAsked] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [best, setBest] = useState(0);
  const order = useRef<EnWord[]>([]);
  const cursor = useRef(0);
  const lock = useRef(false);
  const ended = useRef(false);

  useEffect(() => {
    let alive = true;
    loadPractice().then((d) => {
      if (alive) setData({ pool: d.pool, words: d.words });
    });
    try {
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
    } catch {
      // chưa đọc được điểm cao nhất
    }
    return () => {
      alive = false;
    };
  }, []);

  function nextQ() {
    if (!data) return;
    if (cursor.current >= order.current.length) {
      order.current = shuffle(data.words);
      cursor.current = 0;
    }
    const w = order.current[cursor.current++];
    setQ({ word: w, options: meaningOptions(w, data.words.length >= 8 ? data.words : data.pool) });
    setPicked(null);
    lock.current = false;
  }

  function start() {
    if (!data) return;
    order.current = shuffle(data.words);
    cursor.current = 0;
    ended.current = false;
    setLeft(SECONDS);
    setLives(LIVES);
    setScore(0);
    setCombo(0);
    setRight(0);
    setAsked(0);
    setPhase("play");
    nextQ();
  }

  async function finish(finalScore: number, ok: number, total: number) {
    if (ended.current) return;
    ended.current = true;
    setPhase("end");
    if (finalScore > best) {
      setBest(finalScore);
      try {
        localStorage.setItem(BEST_KEY, String(finalScore));
      } catch {
        // không lưu được điểm cao nhất
      }
    }
    try {
      await logActivity("game", ok, total);
    } catch {
      // không ghi được thống kê: bỏ qua
    }
  }

  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "play" && left <= 0) finish(score, right, asked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  function choose(opt: string) {
    if (!q || lock.current || phase !== "play") return;
    lock.current = true;
    setPicked(opt);
    const ok = opt === shortMeaning(q.word);
    const total = asked + 1;
    setAsked(total);
    if (ok) {
      const c = combo + 1;
      const s = score + 10 + Math.min(c - 1, 5) * 2;
      setCombo(c);
      setScore(s);
      setRight(right + 1);
      setTimeout(nextQ, 350);
    } else {
      speak(q.word.word);
      const l = lives - 1;
      setCombo(0);
      setLives(l);
      if (l <= 0) setTimeout(() => finish(score, right, total), 700);
      else setTimeout(nextQ, 900);
    }
  }

  const shell = "mx-auto w-full max-w-md space-y-4 pb-20 pt-2";
  const card = "rounded-2xl border-2 border-b-4 border-stone-200 bg-white p-5";
  if (!data) return <p className="py-20 text-center text-sm text-stone-500">Đang chuẩn bị...</p>;

  if (phase === "ready") {
    return (
      <main className={shell}>
        <EnHeader title="Đua tốc độ" sub={`${SECONDS} giây, ${LIVES} mạng`} />
        <div className={card}>
          <p className="text-sm text-stone-600">
            Chọn nghĩa đúng của từ hiện ra. Đúng liên tiếp thì được thêm điểm combo. Sai một lần mất một mạng.
          </p>
          <p className="mt-3 text-sm font-bold text-amber-700">Điểm cao nhất của bạn: {best}</p>
        </div>
        <button type="button" className="en-btn" onClick={start}>
          Bắt đầu
        </button>
      </main>
    );
  }

  if (phase === "end") {
    return (
      <main className={shell}>
        <EnHeader title="Đua tốc độ" />
        <div className={`${card} text-center`}>
          <p className="text-5xl">⚡</p>
          <h2 className="mt-3 text-2xl font-extrabold text-stone-900">{score} điểm</h2>
          <p className="mt-1 text-sm text-stone-500">
            Đúng {right}/{asked} câu · cao nhất {Math.max(best, score)}
          </p>
        </div>
        <button type="button" className="en-btn" onClick={start}>
          Chơi lại
        </button>
        <Link href="/en/games" className="en-btn en-btn--ghost">
          Về trò chơi
        </Link>
      </main>
    );
  }

  return (
    <main className={shell}>
      <div className="flex items-center justify-between text-sm font-extrabold">
        <span className="text-stone-700">⏱ {Math.max(0, left)}s</span>
        <span className="text-amber-600">{score} điểm{combo >= 2 ? ` · combo x${combo}` : ""}</span>
        <span>{"❤️".repeat(Math.max(0, lives))}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${(Math.max(0, left) / SECONDS) * 100}%` }} />
      </div>
      {q && (
        <>
          <div className={`${card} flex items-center justify-between gap-3`}>
            <div>
              <p className="text-3xl font-extrabold text-stone-900">{q.word.word}</p>
              <p className="text-sm text-stone-500">{[q.word.ipa, q.word.pos].filter(Boolean).join(" · ")}</p>
            </div>
            <button type="button" onClick={() => speak(q.word.word)} aria-label="Nghe phát âm" className="rounded-full bg-sky-100 px-3 py-2 text-lg">
              🔊
            </button>
          </div>
          <div className="space-y-3">
            {q.options.map((o) => {
              const isRight = o === shortMeaning(q.word);
              const tone =
                picked === null
                  ? "border-stone-200 bg-white text-stone-800"
                  : isRight
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : picked === o
                      ? "border-red-400 bg-red-50 text-red-700"
                      : "border-stone-200 bg-white text-stone-400";
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => choose(o)}
                  className={`block w-full rounded-2xl border-2 border-b-4 px-4 py-3 text-left text-base font-bold ${tone}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
