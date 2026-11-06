"use client";

import { useEffect, useState } from "react";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import { db, type EnLog } from "@/lib/db";
import { allCards, readLogs } from "@/lib/en/store";
import type { EnCard } from "@/lib/en/srs";
import { dayKey } from "@/lib/tower";

const KINDS: { kind: EnLog["kind"]; label: string; emoji: string }[] = [
  { kind: "lesson", label: "Bài học", emoji: "📚" },
  { kind: "review", label: "Ôn thẻ", emoji: "🔁" },
  { kind: "listen", label: "Nghe", emoji: "🎧" },
  { kind: "speak", label: "Nói", emoji: "🎤" },
  { kind: "game", label: "Trò chơi", emoji: "🎮" },
];
const DAY_MS = 24 * 60 * 60 * 1000;

interface Stats {
  logs: EnLog[];
  cards: EnCard[];
  stages: number;
  stars: number;
}

export default function EnSkillsPage() {
  const [st, setSt] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let logs: EnLog[] = [];
      let cards: EnCard[] = [];
      let stages = 0;
      let stars = 0;
      try {
        logs = await readLogs();
        cards = await allCards();
        const prog = await db.en_progress.toArray();
        stages = prog.filter((p) => p.stars > 0).length;
        stars = prog.reduce((a, p) => a + p.stars, 0);
      } catch {
        // chưa đọc được dữ liệu trong máy
      }
      if (alive) setSt({ logs, cards, stages, stars });
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!st) return <p className="py-20 text-center text-sm text-stone-500">Đang tải thống kê...</p>;

  const card = "rounded-2xl border-2 border-b-4 border-stone-200 bg-white p-4";
  const now = Date.now();
  const days = new Set(st.logs.map((l) => l.day));
  let streak = 0;
  for (let d = days.has(dayKey(new Date(now))) ? 0 : 1; d < 4000; d++) {
    if (days.has(dayKey(new Date(now - d * DAY_MS)))) streak++;
    else break;
  }
  const last7 = Array.from({ length: 7 }, (_, k) => {
    const day = dayKey(new Date(now - (6 - k) * DAY_MS));
    const total = st.logs.filter((l) => l.day === day).reduce((a, l) => a + l.total, 0);
    return { day, total, label: day.slice(8, 10) + "/" + day.slice(5, 7) };
  });
  const maxBar = Math.max(1, ...last7.map((x) => x.total));
  const due = st.cards.filter((c) => c.due_at <= new Date(now).toISOString()).length;
  const mature = st.cards.filter((c) => c.interval >= 21).length;

  return (
    <main className="mx-auto w-full max-w-md space-y-4 pb-20 pt-2">
      <EnHeader title="Kỹ năng" sub="Thống kê luyện tập tiếng Anh trong máy này" />

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className={card}>
          <p className="text-2xl font-extrabold text-amber-600">{streak}</p>
          <p className="text-xs text-stone-500">ngày liên tiếp</p>
        </div>
        <div className={card}>
          <p className="text-2xl font-extrabold text-emerald-600">{st.stages}</p>
          <p className="text-xs text-stone-500">chặng đã qua</p>
        </div>
        <div className={card}>
          <p className="text-2xl font-extrabold text-amber-500">{st.stars}</p>
          <p className="text-xs text-stone-500">sao</p>
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-3 text-base font-extrabold text-stone-800">7 ngày gần nhất</h2>
        <div className="flex h-28 items-end justify-between gap-2">
          {last7.map((x) => (
            <div key={x.day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-lg bg-emerald-400"
                style={{ height: `${Math.max(x.total > 0 ? 8 : 2, (x.total / maxBar) * 96)}px` }}
                title={`${x.total} câu`}
              />
              <span className="text-[10px] text-stone-400">{x.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">Số câu đã làm mỗi ngày (học, ôn, nghe, nói).</p>
      </div>

      <div className={card}>
        <h2 className="mb-3 text-base font-extrabold text-stone-800">Theo loại bài</h2>
        <ul className="space-y-2">
          {KINDS.map((k) => {
            const rows = st.logs.filter((l) => l.kind === k.kind);
            const ok = rows.reduce((a, l) => a + l.ok, 0);
            const total = rows.reduce((a, l) => a + l.total, 0);
            return (
              <li key={k.kind} className="flex items-center justify-between rounded-xl border-2 border-stone-100 px-3 py-2 text-sm">
                <span className="font-bold text-stone-700">
                  {k.emoji} {k.label}
                </span>
                <span className="text-stone-500">
                  {rows.length} lượt · {total > 0 ? `${Math.round((ok / total) * 100)}% đúng` : "chưa có"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={card}>
        <h2 className="mb-3 text-base font-extrabold text-stone-800">Thẻ ôn</h2>
        <p className="text-sm text-stone-600">
          {st.cards.length} thẻ, {due} thẻ đến hạn, {mature} thẻ đã nhớ lâu (từ 21 ngày trở lên).
        </p>
        <p className="mt-3 text-xs text-stone-400">
          Số liệu lưu trong máy này. Đổi máy hoặc xóa dữ liệu trình duyệt sẽ mất. Bài Đọc và Viết sẽ có sau.
        </p>
      </div>
    </main>
  );
}
