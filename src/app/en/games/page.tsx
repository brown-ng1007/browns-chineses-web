"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import EnHeader from "@/components/en/EnHeader";
import { loadPractice } from "@/lib/en/store";

const GAMES = [
  { href: "/en/games/match", emoji: "🧩", title: "Ghép cặp", desc: "Nối từ với nghĩa, càng nhanh càng nhiều sao" },
  { href: "/en/games/speed", emoji: "⚡", title: "Đua tốc độ", desc: "60 giây chọn nghĩa đúng, ăn combo, có 3 mạng" },
  { href: "/en/games/scramble", emoji: "🔤", title: "Xếp chữ", desc: "Sắp lại các chữ cái thành từ, có gợi ý" },
  { href: "/en/games/guess", emoji: "🎯", title: "Đoán chữ", desc: "Đoán từng chữ cái trước khi hết 6 mạng" },
];

export default function EnGamesPage() {
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadPractice().then((d) => {
      if (alive) setN(d.words.length);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-md space-y-4 pb-20 pt-2">
      <EnHeader title="Trò chơi" sub="Chơi để nhớ từ, không cần nghĩ là đang học" />
      <p className="text-xs text-stone-500">
        {n === null ? "Đang tải từ..." : `Các trò chơi dùng ${n} từ bạn đã học. Chưa học đủ thì dùng những từ đầu tiên trên bản đồ.`}
      </p>
      <div className="space-y-3">
        {GAMES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="flex items-center gap-4 rounded-2xl border-2 border-b-4 border-stone-200 bg-white p-4"
          >
            <span className="text-4xl">{g.emoji}</span>
            <span>
              <span className="block text-lg font-extrabold text-stone-800">{g.title}</span>
              <span className="block text-sm text-stone-500">{g.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
