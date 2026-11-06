"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import { loadEnWords } from "@/lib/en/vocab";
import { allCards, dueCards, logActivity, saveCard } from "@/lib/en/store";
import { previewLabel, schedule, type EnCard, type Rating } from "@/lib/en/srs";
import { speak } from "@/lib/en/quiz";
import type { EnWord } from "@/lib/en/words";
import WordPic from "@/components/en/WordPic";
import Highlight from "@/components/en/Highlight";

interface Item {
  card: EnCard;
  word: EnWord;
}

const RATES: { r: Rating; label: string; cls: string }[] = [
  { r: 0, label: "Quên", cls: "en-btn--red" },
  { r: 1, label: "Khó", cls: "en-btn--amber" },
  { r: 2, label: "Được", cls: "" },
  { r: 3, label: "Dễ", cls: "en-btn--blue" },
];

export default function EnReviewPage() {
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState({ ok: 0, total: 0 });
  const [info, setInfo] = useState({ cards: 0, next: "" });
  const seen = useRef<Set<string>>(new Set());
  const okRef = useRef(0);
  const totalRef = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const pool = await loadEnWords();
      const byId = new Map<string, EnWord>(pool.map((w): [string, EnWord] => [w.id, w]));
      let due: EnCard[] = [];
      let cards: EnCard[] = [];
      try {
        due = await dueCards(new Date(), 30);
        cards = await allCards();
      } catch {
        // chưa đọc được dữ liệu trong máy
      }
      const items: Item[] = [];
      for (const c of due) {
        const word = byId.get(c.word_id);
        if (word) items.push({ card: c, word });
      }
      const nextDue = cards.map((c) => c.due_at).sort()[0];
      if (alive) {
        setQueue(items);
        setInfo({ cards: cards.length, next: nextDue ? new Date(nextDue).toLocaleString("vi-VN") : "" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function rate(r: Rating) {
    if (!queue) return;
    const cur = queue[idx];
    const next = schedule(cur.card, r, new Date());
    try {
      await saveCard(next);
    } catch {
      // không lưu được trong máy: vẫn cho ôn tiếp
    }
    if (!seen.current.has(cur.word.id)) {
      seen.current.add(cur.word.id);
      totalRef.current += 1;
      if (r >= 1) okRef.current += 1;
    }
    const q2 = r === 0 ? [...queue, { card: next, word: cur.word }] : queue;
    if (idx + 1 >= q2.length) {
      setSummary({ ok: okRef.current, total: totalRef.current });
      setDone(true);
      try {
        await logActivity("review", okRef.current, totalRef.current);
      } catch {
        // không ghi được thống kê: bỏ qua
      }
      return;
    }
    setQueue(q2);
    setIdx(idx + 1);
    setShown(false);
  }

  const shell = "mx-auto w-full max-w-md space-y-4 pb-20 pt-2";
  const card = "rounded-2xl border-2 border-b-4 border-stone-200 bg-white p-5";

  if (!queue) {
    return <p className="py-20 text-center text-sm text-stone-500">Đang tải thẻ ôn...</p>;
  }

  if (queue.length === 0) {
    return (
      <main className={shell}>
        <EnHeader title="Ôn tập" sub="Thẻ ghi nhớ đúng lúc sắp quên" />
        <div className={`${card} text-center`}>
          <p className="text-4xl">{info.cards === 0 ? "📭" : "🎉"}</p>
          <p className="mt-3 text-base font-bold text-stone-800">
            {info.cards === 0 ? "Bạn chưa có thẻ nào" : "Hôm nay không còn thẻ nào đến hạn"}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            {info.cards === 0
              ? "Hoàn thành một chặng trên bản đồ, 5 từ của chặng đó sẽ vào thẻ ôn."
              : `Có ${info.cards} thẻ. Thẻ gần nhất đến hạn lúc ${info.next}.`}
          </p>
        </div>
        <Link href="/en" className="en-btn">
          Về bản đồ
        </Link>
      </main>
    );
  }

  if (done) {
    return (
      <main className={shell}>
        <EnHeader title="Ôn tập" />
        <div className={`${card} text-center`}>
          <p className="text-5xl">🎉</p>
          <h2 className="mt-3 text-xl font-extrabold text-stone-900">Xong lượt ôn</h2>
          <p className="mt-2 text-sm text-stone-600">
            Nhớ được {summary.ok}/{summary.total} thẻ ngay lần đầu.
          </p>
        </div>
        <Link href="/en" className="en-btn">
          Về bản đồ
        </Link>
      </main>
    );
  }

  const cur = queue[idx];
  const w = cur.word;
  const now = new Date();
  return (
    <main className={shell}>
      <EnHeader title="Ôn tập" sub={`Thẻ ${idx + 1}/${queue.length}`} />
      <div className="h-3 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(idx / queue.length) * 100}%` }} />
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-3xl font-extrabold text-stone-900">{w.word}</p>
            <p className="text-sm text-stone-500">{[w.ipa, w.pos].filter(Boolean).join(" · ")}</p>
          </div>
          <button
            type="button"
            onClick={() => speak(w.word)}
            aria-label="Nghe phát âm"
            className="rounded-full bg-sky-100 px-3 py-2 text-lg"
          >
            🔊
          </button>
        </div>
        {shown ? (
          <div className="mt-4 space-y-2">
            {(w.image || w.emoji) && <WordPic w={w} />}
            <p className="text-xl font-bold text-orange-700">{w.vi.join("; ")}</p>
            {w.example && (
              <button type="button" onClick={() => speak(w.example)} className="block text-left text-sm text-stone-600">
                🔊 <Highlight text={w.example} word={w.word} />
              </button>
            )}
            {w.exampleVi && <p className="text-sm text-stone-400">{w.exampleVi}</p>}
          </div>
        ) : (
          <p className="mt-4 text-sm text-stone-400">Nhớ nghĩa của từ này, rồi bấm Hiện đáp án.</p>
        )}
      </div>

      {shown ? (
        <div className="grid grid-cols-2 gap-3">
          {RATES.map((x) => (
            <button key={x.r} type="button" onClick={() => rate(x.r)} className={`en-btn ${x.cls}`}>
              {x.label}
              <span className="block text-[11px] font-semibold normal-case tracking-normal opacity-90">
                {previewLabel(cur.card, x.r, now)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" onClick={() => setShown(true)} className="en-btn">
          Hiện đáp án
        </button>
      )}
    </main>
  );
}
