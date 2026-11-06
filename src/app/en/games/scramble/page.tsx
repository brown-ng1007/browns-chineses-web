"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import WordPic from "@/components/en/WordPic";
import { loadPractice, logActivity } from "@/lib/en/store";
import { isPlayableWord, shortMeaning } from "@/lib/en/games";
import { shuffle, speak } from "@/lib/en/quiz";
import type { EnWord } from "@/lib/en/words";

const ROUND = 8;

function scrambled(word: string): string[] {
  const letters = word.toLowerCase().split("");
  if (new Set(letters).size < 2) return letters;
  for (let k = 0; k < 20; k++) {
    const s = shuffle(letters);
    if (s.join("") !== letters.join("")) return s;
  }
  return letters.slice().reverse();
}

export default function EnScramblePage() {
  const [source, setSource] = useState<EnWord[] | null>(null);
  const [list, setList] = useState<EnWord[]>([]);
  const [i, setI] = useState(0);
  const [tiles, setTiles] = useState<string[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [state, setState] = useState<"play" | "ok" | "bad" | "shown">("play");
  const [hinted, setHinted] = useState(false);
  const [score, setScore] = useState(0);
  const [clean, setClean] = useState(0);
  const [end, setEnd] = useState(false);
  const usedHint = useRef(false);

  useEffect(() => {
    let alive = true;
    loadPractice().then((d) => {
      if (alive) setSource(d.words.filter(isPlayableWord));
    });
    return () => {
      alive = false;
    };
  }, []);

  function load(words: EnWord[], n: number) {
    setI(n);
    setTiles(scrambled(words[n].word));
    setPicked([]);
    setState("play");
    setHinted(false);
    usedHint.current = false;
  }

  function startGame(words: EnWord[]) {
    const chosen = shuffle(words).slice(0, ROUND);
    setList(chosen);
    setScore(0);
    setClean(0);
    setEnd(false);
    if (chosen.length > 0) load(chosen, 0);
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
        <EnHeader title="Xếp chữ" />
        <p className="text-sm text-stone-500">Chưa có từ phù hợp để chơi. Hãy học thêm vài chặng trên bản đồ.</p>
      </main>
    );
  }

  const w = list[i];
  const answer = picked.map((k) => tiles[k]).join("");

  async function pick(k: number) {
    if (state !== "play" || picked.includes(k)) return;
    const next = [...picked, k];
    setPicked(next);
    if (next.length === tiles.length) {
      const guess = next.map((x) => tiles[x]).join("");
      if (guess === w.word.toLowerCase()) {
        setState("ok");
        speak(w.word);
        setScore((s) => s + (usedHint.current ? 7 : 10));
        if (!usedHint.current) setClean((c) => c + 1);
      } else {
        setState("bad");
        setTimeout(() => {
          setPicked([]);
          setState("play");
        }, 700);
      }
    }
  }

  function hint() {
    usedHint.current = true;
    setHinted(true);
  }

  function reveal() {
    usedHint.current = true;
    setPicked([]);
    setState("shown");
  }

  async function next() {
    if (i + 1 >= list.length) {
      setEnd(true);
      try {
        await logActivity("game", clean, list.length);
      } catch {
        // không ghi được thống kê: bỏ qua
      }
      return;
    }
    load(list, i + 1);
  }

  if (end) {
    return (
      <main className={shell}>
        <EnHeader title="Xếp chữ" />
        <div className={`${card} text-center`}>
          <p className="text-5xl">🔤</p>
          <h2 className="mt-3 text-2xl font-extrabold text-stone-900">{score} điểm</h2>
          <p className="mt-1 text-sm text-stone-500">
            {clean}/{list.length} từ không cần gợi ý
          </p>
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

  const finished = state === "ok" || state === "shown";
  return (
    <main className={shell}>
      <EnHeader title="Xếp chữ" sub={`Từ ${i + 1}/${list.length} · ${score} điểm`} />
      <div className={card}>
        <WordPic w={w} />
        <p className="mt-3 text-lg font-bold text-orange-700">{shortMeaning(w)}</p>
        <p className="text-sm text-stone-500">{[w.pos, hinted ? `${w.word[0].toLowerCase()}...` : "", `${w.word.length} chữ`].filter(Boolean).join(" · ")}</p>
        <button type="button" onClick={() => speak(w.word)} className="mt-3 rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-800">
          🔊 Nghe từ
        </button>
      </div>

      <div
        className={`flex min-h-[60px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-3 ${
          state === "ok" ? "border-emerald-400 bg-emerald-50" : state === "bad" ? "en-shake border-red-400 bg-red-50" : "border-stone-300 bg-white"
        }`}
      >
        {state === "shown" ? (
          <span className="text-2xl font-extrabold tracking-widest text-stone-800">{w.word.toLowerCase()}</span>
        ) : answer ? (
          <span className="text-2xl font-extrabold tracking-widest text-stone-800">{answer}</span>
        ) : (
          <span className="text-sm text-stone-400">Chạm vào các chữ cái bên dưới</span>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {tiles.map((ch, k) => (
          <button
            key={k}
            type="button"
            disabled={picked.includes(k) || finished}
            onClick={() => pick(k)}
            className="h-12 w-12 rounded-xl border-2 border-b-4 border-stone-300 bg-white text-xl font-extrabold uppercase text-stone-800 disabled:opacity-25"
          >
            {ch}
          </button>
        ))}
      </div>

      {finished ? (
        <button type="button" className="en-btn" onClick={next}>
          {i + 1 >= list.length ? "Xem kết quả" : "Từ tiếp theo"}
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <button type="button" className="en-btn en-btn--ghost" onClick={() => setPicked([])}>
            Xóa
          </button>
          <button type="button" className="en-btn en-btn--amber" disabled={hinted} onClick={hint}>
            Gợi ý
          </button>
          <button type="button" className="en-btn en-btn--ghost" onClick={reveal}>
            Bỏ qua
          </button>
        </div>
      )}
    </main>
  );
}
