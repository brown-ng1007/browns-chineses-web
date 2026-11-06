"use client";

import { useEffect, useMemo, useState } from "react";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import { loadEnWords } from "@/lib/en/vocab";
import { allCards } from "@/lib/en/store";
import { norm, speak } from "@/lib/en/quiz";
import type { EnWord } from "@/lib/en/words";
import WordPic from "@/components/en/WordPic";
import Highlight from "@/components/en/Highlight";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const PAGE = 40;

export default function EnVocabPage() {
  const [pool, setPool] = useState<EnWord[] | null>(null);
  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");
  const [onlyLearned, setOnlyLearned] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    let alive = true;
    (async () => {
      const words = await loadEnWords();
      let ids = new Set<string>();
      try {
        ids = new Set((await allCards()).map((c) => c.word_id));
      } catch {
        // chưa đọc được dữ liệu trong máy
      }
      if (alive) {
        setPool(words);
        setLearned(ids);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const index = useMemo(() => (pool ? pool.map((w) => norm(`${w.word} ${w.vi.join(" ")}`)) : []), [pool]);

  const list = useMemo(() => {
    if (!pool) return [];
    const nq = norm(q);
    const out: EnWord[] = [];
    for (let i = 0; i < pool.length; i++) {
      const w = pool[i];
      if (level !== "all" && w.cefr !== level) continue;
      if (onlyLearned && !learned.has(w.id)) continue;
      if (nq && !index[i].includes(nq)) continue;
      out.push(w);
    }
    return out;
  }, [pool, index, q, level, onlyLearned, learned]);

  useEffect(() => {
    setLimit(PAGE);
  }, [q, level, onlyLearned]);

  const chip = (on: boolean) =>
    `rounded-full border-2 px-3 py-1 text-xs font-extrabold ${
      on ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-500"
    }`;

  return (
    <main className="mx-auto w-full max-w-md space-y-4 pb-20 pt-2">
      <EnHeader title="Từ vựng" sub="Tra từ, xem nghĩa, nghe phát âm" />

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm từ tiếng Anh hoặc nghĩa"
        className="w-full rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-400"
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(level === "all")} onClick={() => setLevel("all")}>
          Tất cả
        </button>
        {LEVELS.map((l) => (
          <button key={l} type="button" className={chip(level === l)} onClick={() => setLevel(l)}>
            {l}
          </button>
        ))}
        <button type="button" className={chip(onlyLearned)} onClick={() => setOnlyLearned(!onlyLearned)}>
          Đã học
        </button>
      </div>

      {!pool ? (
        <p className="py-10 text-center text-sm text-stone-500">Đang tải từ vựng...</p>
      ) : (
        <>
          <p className="text-xs text-stone-500">
            {list.length} từ{pool.length > 0 ? ` trên tổng ${pool.length}` : ""}
          </p>
          <ul className="space-y-3">
            {list.slice(0, limit).map((w) => (
              <li key={w.id} className="rounded-2xl border-2 border-b-4 border-stone-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  {(w.image || w.emoji) && <WordPic w={w} small />}
                  <div className="mr-auto">
                    <p className="text-xl font-extrabold text-stone-900">
                      {w.word}
                      {learned.has(w.id) && <span className="ml-2 text-sm text-emerald-600">✓</span>}
                    </p>
                    <p className="text-xs text-stone-500">
                      {[w.ipa, w.pos, w.cefr].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speak(w.word)}
                    aria-label="Nghe phát âm"
                    className="shrink-0 rounded-full bg-sky-100 px-3 py-2 text-lg"
                  >
                    🔊
                  </button>
                </div>
                <p className="mt-2 text-base font-semibold text-orange-700">{w.vi.join("; ")}</p>
                {w.example && (
                  <button
                    type="button"
                    onClick={() => speak(w.example)}
                    className="mt-2 block text-left text-sm text-stone-600"
                  >
                    🔊 <Highlight text={w.example} word={w.word} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {list.length > limit && (
            <button type="button" className="en-btn en-btn--ghost" onClick={() => setLimit(limit + PAGE)}>
              Xem thêm
            </button>
          )}
          {list.length === 0 && <p className="py-6 text-center text-sm text-stone-500">Không tìm thấy từ nào.</p>}
        </>
      )}
    </main>
  );
}
