"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import { db } from "@/lib/db";
import { EN_WORLDS, loadEnWords } from "@/lib/en/words";
import { buildStages, stageStates, type StageState } from "@/lib/en/map";

const ROW = 118; // khoảng cách dọc giữa hai nút
const PAD_BOTTOM = 90;
const PAD_TOP = 110;

interface NodePos {
  s: StageState;
  x: number; // phần trăm chiều ngang
  y: number; // px từ đáy
}
interface BannerPos {
  world: number;
  y: number;
  done: number;
  total: number;
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex justify-center gap-0.5 text-[13px] leading-none" aria-label={`${n} sao`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? "" : "grayscale opacity-30"}>
          ⭐
        </span>
      ))}
    </div>
  );
}

export default function EnMapPage() {
  const [states, setStates] = useState<StageState[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const words = await loadEnWords();
      const stages = buildStages(words);
      const progress: Record<string, number> = {};
      try {
        const rows = await db.en_progress.toArray();
        for (const r of rows) progress[r.stage_id] = r.stars;
      } catch {
        // chưa đọc được dữ liệu trong máy: coi như chưa có tiến độ
      }
      if (alive) setStates(stageStates(stages, progress));
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (states) document.getElementById("en-current")?.scrollIntoView({ block: "center" });
  }, [states]);

  const layout = useMemo(() => {
    if (!states) return null;
    const nodes: NodePos[] = [];
    const banners: BannerPos[] = [];
    let cursor = PAD_BOTTOM;
    states.forEach((s, k) => {
      nodes.push({ s, x: 50 + 26 * Math.sin(k * 1.15), y: cursor });
      cursor += ROW;
      const next = states[k + 1];
      if (!next || next.stage.world !== s.stage.world) {
        const inWorld = states.filter((t) => t.stage.world === s.stage.world);
        banners.push({
          world: s.stage.world,
          y: cursor - 8,
          done: inWorld.filter((t) => t.stars > 0).length,
          total: inWorld.length,
        });
        cursor += ROW * 0.75;
      }
    });
    const height = cursor + PAD_TOP;
    return { nodes, banners, height };
  }, [states]);

  if (!layout) {
    return <p className="py-20 text-center text-sm text-stone-500">Đang dựng bản đồ...</p>;
  }

  const { nodes, banners, height } = layout;
  const top = (y: number) => height - y;
  let d = "";
  nodes.forEach((n, i) => {
    const px = n.x;
    const py = top(n.y);
    if (i === 0) d = `M ${px} ${py}`;
    else {
      const p = nodes[i - 1];
      const mid = (top(p.y) + py) / 2;
      d += ` C ${p.x} ${mid}, ${px} ${mid}, ${px} ${py}`;
    }
  });

  const totalStars = nodes.reduce((a, n) => a + n.s.stars, 0);

  return (
    <main className="pb-10">
      <header className="rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 px-5 py-4 text-white shadow-lg shadow-orange-500/20">
        <h1 className="text-xl font-bold">Bản đồ tiếng Anh</h1>
        <p className="mt-1 text-sm text-amber-50">
          Mỗi nút là một chặng nhỏ của một ngày. Đạt từ 60% để qua, 95% để được 3 sao. Đã có {totalStars} sao.
        </p>
      </header>

      <div className="relative mx-auto mt-4 w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-amber-50 via-orange-50 to-rose-100 ring-1 ring-orange-200/60" style={{ height }}>
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
        >
          <path d={d} fill="none" stroke="#fda4af" strokeWidth="16" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={d} fill="none" stroke="#fff7ed" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 14" vectorEffect="non-scaling-stroke" />
        </svg>

        {banners.map((b) => {
          const w = EN_WORLDS.find((x) => x.id === b.world);
          return (
            <div
              key={`b${b.world}`}
              className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-4 py-1.5 text-sm font-bold text-orange-700 shadow-md ring-1 ring-orange-200"
              style={{ top: top(b.y) - 16 }}
            >
              {w?.emoji} {w?.tag} · {w?.name} · {b.done}/{b.total}
            </div>
          );
        })}

        {nodes.map(({ s, x, y }) => {
          const size = s.stage.boss ? 80 : 64;
          const label = s.stage.boss ? "🏆" : String(s.stage.n);
          const base = s.stage.boss
            ? "from-amber-400 to-orange-500"
            : "from-rose-400 to-red-500";
          const inner = (
            <div
              className={`flex h-full w-full items-center justify-center rounded-full text-xl font-bold shadow-lg ring-4 ring-white ${
                s.unlocked
                  ? `bg-gradient-to-br ${base} text-white`
                  : "bg-stone-200 text-stone-400"
              } ${s.current ? "en-pulse" : ""}`}
            >
              {s.unlocked ? label : "🔒"}
            </div>
          );
          return (
            <div
              key={s.stage.id}
              id={s.current ? "en-current" : undefined}
              className="absolute"
              style={{
                left: `${x}%`,
                top: top(y),
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
              }}
            >
              {s.unlocked ? (
                <Link href={`/en/stage/${s.stage.id}`} aria-label={`Chặng ${s.stage.n}`} className="block h-full w-full">
                  {inner}
                </Link>
              ) : (
                inner
              )}
              <div className="absolute left-0 right-0" style={{ top: size + 2 }}>
                <Stars n={s.stars} />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
