"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import { loadPractice } from "@/lib/en/store";

const GAMES = [
  { href: "/en/games/match", emoji: "🧩", title: "Ghép cặp", desc: "Nối từ với nghĩa, càng nhanh càng nhiều sao", tag: "Từ vựng" },
  { href: "/en/games/speed", emoji: "⚡", title: "Đua tốc độ", desc: "60 giây chọn nghĩa đúng, ăn combo, có 3 mạng", tag: "Phản xạ" },
  { href: "/en/games/scramble", emoji: "🔤", title: "Xếp chữ", desc: "Sắp lại các chữ cái thành từ, có gợi ý", tag: "Chính tả" },
  { href: "/en/games/guess", emoji: "🎯", title: "Đoán chữ", desc: "Đoán từng chữ cái trước khi hết 6 mạng", tag: "Ghi nhớ" },
];

export default function EnGamesPage() {
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadPractice().then((d) => {
      if (alive) setN(d.words.length);
    });
    return () => { alive = false; };
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 pb-24 pt-2">
      <EnHeader title="Trò chơi tiếng Anh" sub="Chơi để nhớ từ, luyện phản xạ và biến việc học thành niềm vui" />

      <Link href="/en/games/ioe" className="ioe-hero block group">
        <div className="relative z-10 max-w-xl">
          <span className="ioe-kicker">MELON LANGUAGE · ARCADE MODE</span>
          <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">Melon IOE Arcade</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-emerald-50/90">10 mini-game theo phong cách IOE: ghép cặp, sút phạt, xếp câu, tìm chữ thừa và nhiều thử thách khác.</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-xs font-black text-emerald-950 shadow-lg transition group-hover:-translate-y-0.5">Khám phá 10 thử thách <span>→</span></span>
        </div>
        <div className="ioe-hero-art" aria-hidden="true"><span>🍉</span><i>✦</i><b>+XP</b></div>
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><p className="ioe-section-label">QUICK PLAY</p><h2 className="text-xl font-black text-slate-900">Trò chơi nhanh</h2></div>
        <p className="text-xs text-stone-500">{n === null ? "Đang tải từ..." : `${n} từ sẵn sàng để luyện tập`}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {GAMES.map((game) => (
          <Link key={game.href} href={game.href} className="ioe-game-card text-left">
            <span className="ioe-game-icon">{game.emoji}</span>
            <span className="min-w-0 flex-1"><span className="block text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">{game.tag}</span><span className="mt-1 block text-base font-extrabold text-slate-900">{game.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{game.desc}</span></span>
            <span className="ioe-card-arrow">↗</span>
          </Link>
        ))}
      </div>
      <div className="ioe-footnote"><span>💡</span><p>Các trò chơi lấy dữ liệu từ kho từ vựng tiếng Anh hiện tại. Tiến độ học từ và trò chơi vẫn được lưu riêng trên thiết bị.</p></div>
    </main>
  );
}
