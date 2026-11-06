"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import WordPic from "@/components/en/WordPic";
import { loadPractice, logActivity } from "@/lib/en/store";
import { isPlayableWord, shortMeaning } from "@/lib/en/games";
import { blankExample, shuffle, speak } from "@/lib/en/quiz";
import type { EnWord } from "@/lib/en/words";

const ROUND = 6;
const LIVES = 6;
const KEYS = "abcdefghijklmnopqrstuvwxyz".split("");

export default function EnGuessPage() {
  const [source, setSource] = useState<EnWord[] | null>(null);
  const [list, setList] = useState<EnWord[]>([]);
  const [i, setI] = useState(0);
  const [tried, setTried] = useState<Set<string>>(new Set());
  const [lives, setLives] = useState(LIVES);
  const [showEx, setShowEx] = useState(false);
  const [won, setWon] = useState(0);
  const [end, setEnd] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPractice().then((d) => {
      if (alive) setSource(d.words.filter(isPlayableWord));
    });
    return () => {
      alive = false;
    };
  }, []);

  function startGame(words: EnWord[]) {
    setList(shuffle(words).slice(0, ROUND));
    setI(0);
    setTried(new Set());
    setLives(LIVES);
    setShowEx(false);
    setWon(0);
    setEnd(false);
  }

  useEffect(() => {
    if (source && list.length === 0 && source.length > 0) startGame(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const shell = "mx-auto w-full max-w-md space-y-4 pb-20 pt-2";
  const card = "rounded-2xl border-2 border-b-4 border-stone-200 bg-white p-5";

  if (!source) return <p className="py-20 text-center text-sm text-stone-500">Đang chuẩn bị...</p>;
  if (source.length > 0 && list.length === 0) return <p className="py-20 text-center text-sm text-stone-500">Đang chuẩn bị...</p>;
  if (source.length === 0) {
    return (
      <main className={shell}>
        <EnHeader title="Đoán chữ" />
        <p className="text-sm text-stone-500">Chưa có từ phù hợp để chơi. Hãy học thêm vài chặng trên bản đồ.</p>
      </main>
    );
  }

  const w = list[i];
  const letters = w.word.toLowerCase().split("");
  const solved = letters.every((c) => tried.has(c));
  const lost = lives <= 0;
  const over = solved || lost;

  function guess(c: string) {
    if (over || tried.has(c)) return;
    const t = new Set(tried);
    t.add(c);
    setTried(t);
    if (!letters.includes(c)) setLives((l) => l - 1);
    else if (letters.every((x) => t.has(x))) {
      setWon((n) => n + 1);
      speak(w.word);
    }
  }

  async function next() {
    if (i + 1 >= list.length) {
      setEnd(true);
      try {
        await logActivity("game", won, list.length);
      } catch {
        // không ghi được thống kê: bỏ qua
      }
      return;
    }
    setI(i + 1);
    setTried(new Set());
    setLives(LIVES);
    setShowEx(false);
  }

  if (end) {
    return (
      <main className={shell}>
        <EnHeader title="Đoán chữ" />
        <div className={`${card} text-center`}>
          <p className="text-5xl">🎯</p>
          <h2 className="mt-3 text-2xl font-extrabold text-stone-900">
            Đoán đúng {won}/{list.length} từ
          </h2>
        </div>
        <button type="button" className="en-btn" onClick={() => startGame(source)}>
          Chơi lại
        </button>
        <Link href="/en/games" className="en-btn en-btn--ghost">
          Về trò chơi
        </Link>
      </main>
    );
  }

  const blanked = blankExample(w);
  return (
    <main className={shell}>
      <EnHeader title="Đoán chữ" sub={`Từ ${i + 1}/${list.length}`} />
      <div className="text-center text-xl">{"❤️".repeat(Math.max(0, lives)) + "🖤".repeat(LIVES - Math.max(0, lives))}</div>

      <div className={card}>
        <WordPic w={w} />
        <p className="mt-3 text-lg font-bold text-orange-700">{shortMeaning(w)}</p>
        <p className="text-sm text-stone-500">{[w.pos, w.ipa].filter(Boolean).join(" · ")}</p>
        {blanked && (
          <>
            {showEx ? (
              <p className="mt-3 text-sm text-stone-700">{blanked}</p>
            ) : (
              <button type="button" onClick={() => setShowEx(true)} className="mt-3 text-sm font-bold text-sky-700">
                Xem câu gợi ý
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {letters.map((c, k) => (
          <span
            key={k}
            className={`flex h-12 w-10 items-center justify-center border-b-4 text-2xl font-extrabold uppercase ${
              tried.has(c) || lost ? (tried.has(c) ? "border-emerald-500 text-stone-900" : "border-red-400 text-red-500") : "border-stone-300 text-transparent"
            }`}
          >
            {c}
          </span>
        ))}
      </div>

      {over ? (
        <div className={`${card} ${solved ? "border-emerald-300" : "border-red-300"}`}>
          <p className={`text-base font-extrabold ${solved ? "text-emerald-700" : "text-red-600"}`}>
            {solved ? "Đoán đúng" : "Hết mạng, đáp án là:"}
          </p>
          <p className="mt-1 text-xl font-bold text-stone-900">{w.word}</p>
          <button type="button" className="en-btn mt-3" onClick={next}>
            {i + 1 >= list.length ? "Xem kết quả" : "Từ tiếp theo"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {KEYS.map((c) => {
            const hit = tried.has(c);
            const good = hit && letters.includes(c);
            return (
              <button
                key={c}
                type="button"
                disabled={hit}
                onClick={() => guess(c)}
                className={`h-11 w-11 rounded-xl border-2 border-b-4 text-lg font-extrabold uppercase ${
                  good ? "border-emerald-300 bg-emerald-50 text-emerald-600" : hit ? "border-stone-200 bg-stone-100 text-stone-300" : "border-stone-300 bg-white text-stone-800"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
