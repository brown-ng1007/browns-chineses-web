"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import { loadPractice, logActivity } from "@/lib/en/store";
import { pickDistinct, shortMeaning, starsByMistakes } from "@/lib/en/games";
import { shuffle, speak } from "@/lib/en/quiz";
import type { EnWord } from "@/lib/en/words";

const PAIRS = 6;

interface Round {
  words: EnWord[];
  right: EnWord[]; // thứ tự xáo của cột nghĩa
}

export default function EnMatchPage() {
  const [source, setSource] = useState<EnWord[] | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [secs, setSecs] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    loadPractice().then((d) => {
      if (alive) setSource(d.words);
    });
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function newRound(words: EnWord[]) {
    const picked = pickDistinct(words, PAIRS);
    setRound({ words: picked, right: shuffle(picked) });
    setLeft(null);
    setRight(null);
    setMatched(new Set());
    setWrong(false);
    setMistakes(0);
    setSecs(0);
    setDone(false);
  }

  useEffect(() => {
    if (source && !round) newRound(source);
  }, [source, round]);

  useEffect(() => {
    if (!round || done) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [round, done]);

  async function check(l: string | null, r: string | null) {
    if (!l || !r || !round) return;
    if (l === r) {
      const m = new Set(matched);
      m.add(l);
      setMatched(m);
      setLeft(null);
      setRight(null);
      if (m.size >= round.words.length) {
        setDone(true);
        try {
          await logActivity("game", Math.max(0, round.words.length - mistakes), round.words.length);
        } catch {
          // không ghi được thống kê: bỏ qua
        }
      }
    } else {
      setMistakes((x) => x + 1);
      setWrong(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setWrong(false);
        setLeft(null);
        setRight(null);
      }, 600);
    }
  }

  function pickLeft(w: EnWord) {
    if (wrong || matched.has(w.id)) return;
    speak(w.word);
    setLeft(w.id);
    check(w.id, right);
  }
  function pickRight(w: EnWord) {
    if (wrong || matched.has(w.id)) return;
    setRight(w.id);
    check(left, w.id);
  }

  const shell = "mx-auto w-full max-w-md space-y-4 pb-20 pt-2";
  if (!source || !round) return <p className="py-20 text-center text-sm text-stone-500">Đang chuẩn bị...</p>;

  const tile = (state: "idle" | "sel" | "ok" | "bad") =>
    `block w-full rounded-2xl border-2 border-b-4 px-3 py-3 text-left text-sm font-bold ${
      state === "ok"
        ? "border-emerald-300 bg-emerald-50 text-emerald-300"
        : state === "sel"
          ? "border-sky-400 bg-sky-50 text-sky-800"
          : state === "bad"
            ? "border-red-400 bg-red-50 text-red-700"
            : "border-stone-200 bg-white text-stone-800"
    }`;

  if (done) {
    const stars = starsByMistakes(mistakes, [1, 3]);
    return (
      <main className={shell}>
        <EnHeader title="Ghép cặp" />
        <div className="rounded-2xl border-2 border-b-4 border-stone-200 bg-white p-6 text-center">
          <p className="text-5xl">{"⭐".repeat(stars)}</p>
          <h2 className="mt-3 text-xl font-extrabold text-stone-900">Xong trong {secs} giây</h2>
          <p className="mt-1 text-sm text-stone-500">{mistakes === 0 ? "Không sai lần nào" : `Sai ${mistakes} lần`}</p>
        </div>
        <button type="button" className="en-btn" onClick={() => newRound(source)}>
          Chơi ván mới
        </button>
        <Link href="/en/games" className="en-btn en-btn--ghost">
          Về trò chơi
        </Link>
      </main>
    );
  }

  return (
    <main className={shell}>
      <EnHeader title="Ghép cặp" sub={`${matched.size}/${round.words.length} cặp · ${secs} giây · sai ${mistakes}`} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-3">
          {round.words.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => pickLeft(w)}
              className={tile(matched.has(w.id) ? "ok" : left === w.id ? (wrong ? "bad" : "sel") : "idle")}
            >
              {w.word}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {round.right.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => pickRight(w)}
              className={tile(matched.has(w.id) ? "ok" : right === w.id ? (wrong ? "bad" : "sel") : "idle")}
            >
              {shortMeaning(w)}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
