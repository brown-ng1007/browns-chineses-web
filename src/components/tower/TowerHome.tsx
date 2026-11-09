"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./tower.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { refreshSettings } from "@/lib/settings";
import {
  FLOORS,
  FRUITS_PER_BRANCH,
  REVIEW_TARGET,
  LISTEN_TARGET,
  SPEAK_TARGET,
  SPLIT_COLUMN,
  SPLIT_LEVEL,
  SPLIT_PARTS,
  buildFloors,
  calcStreak,
  currentFloorLevel,
  dayKey,
  dayStarsFromDone,
  floorOfWord,
  fruitPlan,
  splitSizes,
  stageChips,
  weekStrip,
  type FloorStat,
  type SplitBoundary,
  type StageChip,
} from "@/lib/tower";

type SupabaseBrowser = ReturnType<typeof createClient>;

interface Mission {
  key: string;
  hanzi: string;
  title: string;
  hint: string;
  href: string;
  value: number;
  target: number;
  unit: string;
}

interface TowerData {
  floors: FloorStat[];
  newToday: number;
  newTarget: number;
  reviewToday: number;
  listenToday: number;
  speakToday: number;
  active: Set<string>;
}

interface WordMeta {
  lv: number;
  rank: number | null;
}

interface SplitInfo {
  sizes: number[]; // số từ của tầng 7, 8, 9
  bounds: SplitBoundary[]; // từ cuối của tầng 7 và 8
  useRank: boolean; // false: không có cột rank, chia theo id
}

const PAGE = 1000;
const HISTORY_DAYS = 60;

async function fetchCards(supabase: SupabaseBrowser) {
  const rows: { word_id: string; state: string }[] = [];
  for (let p = 0; p < 30; p++) {
    const res = await supabase
      .from("srs_cards")
      .select("word_id, state")
      .is("deleted_at", null)
      .order("word_id", { ascending: true })
      .range(p * PAGE, p * PAGE + PAGE - 1);
    if (res.error) throw res.error;
    const part = (res.data ?? []) as { word_id: string; state: string }[];
    rows.push(...part);
    if (part.length < PAGE) break;
  }
  return rows;
}

// Tra cấp HSK 3.0 (và thứ hạng tần suất) của các từ đã có thẻ
async function fetchLevels(supabase: SupabaseBrowser, ids: string[], useRank: boolean) {
  const map = new Map<string, WordMeta>();
  const CHUNK = 100;
  const BATCH = 6;
  const cols = useRank ? `id, hsk_new_level, ${SPLIT_COLUMN}` : "id, hsk_new_level";
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  for (let i = 0; i < chunks.length; i += BATCH) {
    const results = await Promise.all(
      chunks.slice(i, i + BATCH).map((c) => supabase.from("words").select(cols).in("id", c))
    );
    for (const r of results) {
      if (r.error) throw r.error;
      for (const w of (r.data ?? []) as unknown as Record<string, unknown>[]) {
        const lv = w.hsk_new_level;
        if (typeof lv !== "number" || lv <= 0) continue;
        const rk = useRank ? w[SPLIT_COLUMN] : null;
        map.set(String(w.id), { lv, rank: typeof rk === "number" ? rk : null });
      }
    }
  }
  return map;
}

function toBoundary(row: Record<string, unknown> | undefined, useRank: boolean): SplitBoundary | null {
  if (!row) return null;
  const rk = useRank ? row[SPLIT_COLUMN] : null;
  return { id: String(row.id), rank: typeof rk === "number" ? rk : null };
}

// Tìm hai "từ ranh giới" chia HSK 7 làm 3 phần đều nhau (chỉ 2 truy vấn nhỏ)
async function fetchSplit(supabase: SupabaseBrowser, count7: number): Promise<SplitInfo> {
  const sizes = splitSizes(count7, SPLIT_PARTS);
  if (count7 < SPLIT_PARTS) return { sizes, bounds: [], useRank: false };
  const idxs = [sizes[0] - 1, sizes[0] + sizes[1] - 1];

  const ranked = await Promise.all(
    idxs.map((i) =>
      supabase
        .from("words")
        .select(`id, ${SPLIT_COLUMN}`)
        .eq("hsk_new_level", SPLIT_LEVEL)
        .order(SPLIT_COLUMN, { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(i, i)
    )
  );
  if (!ranked.some((r) => r.error)) {
    const b = ranked.map((r) =>
      toBoundary(((r.data ?? []) as unknown as Record<string, unknown>[])[0], true)
    );
    if (b.every((x) => x !== null)) return { sizes, bounds: b as SplitBoundary[], useRank: true };
  }

  // Không có cột rank: chia theo id để tầng 8 và 9 vẫn chạy được
  const byId = await Promise.all(
    idxs.map((i) =>
      supabase
        .from("words")
        .select("id")
        .eq("hsk_new_level", SPLIT_LEVEL)
        .order("id", { ascending: true })
        .range(i, i)
    )
  );
  const err = byId.find((r) => r.error);
  if (err?.error) throw err.error;
  const b = byId.map((r) =>
    toBoundary(((r.data ?? []) as unknown as Record<string, unknown>[])[0], false)
  );
  return { sizes, bounds: b.filter((x): x is SplitBoundary => x !== null), useRank: false };
}

async function loadTower(supabase: SupabaseBrowser): Promise<TowerData> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since = new Date(startOfDay);
  since.setDate(since.getDate() - HISTORY_DAYS);

  const settingsPromise = refreshSettings().catch(() => null);

  // Cấp 1-7 của HSK 3.0; cấp 7 sẽ được chia thành tầng 7, 8, 9
  const totalsPromise = Promise.all(
    Array.from({ length: SPLIT_LEVEL }, (_, i) =>
      supabase
        .from("words")
        .select("id", { count: "exact", head: true })
        .eq("hsk_new_level", i + 1)
    )
  );
  const splitPromise = totalsPromise.then((r) =>
    fetchSplit(supabase, r[SPLIT_LEVEL - 1].count ?? 0)
  );

  const [newRes, revCountRes, revRes, skillRes, cards, totalsRes, split, settings] =
    await Promise.all([
      supabase
        .from("srs_cards")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", startOfDay.toISOString()),
      supabase
        .from("review_logs")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("reviewed_at", startOfDay.toISOString()),
      supabase
        .from("review_logs")
        .select("reviewed_at")
        .is("deleted_at", null)
        .gte("reviewed_at", since.toISOString())
        .order("reviewed_at", { ascending: false })
        .limit(5000),
      supabase
        .from("skill_logs")
        .select("skill, created_at")
        .is("deleted_at", null)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(3000),
      fetchCards(supabase),
      totalsPromise,
      splitPromise,
      settingsPromise,
    ]);

  if (newRes.error || revCountRes.error || revRes.error) {
    throw newRes.error ?? revCountRes.error ?? revRes.error;
  }

  const levels = await fetchLevels(
    supabase,
    cards.map((c) => c.word_id),
    split.useRank
  );
  const cardCount = FLOORS.map(() => 0);
  const learned = FLOORS.map(() => 0);
  for (const c of cards) {
    const m = levels.get(c.word_id);
    if (!m) continue;
    const fl = floorOfWord(m.lv, m.rank, c.word_id, split.bounds);
    if (fl < 1 || fl > FLOORS.length) continue;
    cardCount[fl - 1]++;
    if (c.state === "review") learned[fl - 1]++;
  }
  const counts = totalsRes.map((r) => r.count ?? 0);
  const totals = [...counts.slice(0, SPLIT_LEVEL - 1), ...split.sizes];

  const active = new Set<string>();
  for (const r of (revRes.data ?? []) as { reviewed_at: string }[]) {
    active.add(dayKey(new Date(r.reviewed_at)));
  }
  let listenToday = 0;
  let speakToday = 0;
  if (!skillRes.error) {
    for (const r of (skillRes.data ?? []) as { skill: string; created_at: string }[]) {
      const d = new Date(r.created_at);
      active.add(dayKey(d));
      if (d >= startOfDay) {
        if (r.skill === "listening") listenToday++;
        if (r.skill === "speaking") speakToday++;
      }
    }
  }

  const newTarget =
    settings && typeof settings.newPerDay === "number" && settings.newPerDay > 0
      ? settings.newPerDay
      : 10;

  return {
    floors: buildFloors(totals, cardCount, learned),
    newToday: newRes.count ?? 0,
    newTarget,
    reviewToday: revCountRes.count ?? 0,
    listenToday,
    speakToday,
    active,
  };
}

function Stars({ n, size = "text-base" }: { n: number; size?: string }) {
  return (
    <span className={`${size} leading-none tracking-tight`} aria-label={`${n} trên 3 sao`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? "text-amber-400 drop-shadow-sm" : "text-stone-300"}>
          ★
        </span>
      ))}
    </span>
  );
}

// Dãy chặng ngày: ✓ đã xong, ô viền hồng là chặng hôm nay, ô xám là chặng sắp tới
function StageChips({ chips, max = 30 }: { chips: StageChip[]; max?: number }) {
  const nowIdx = chips.findIndex((c) => c.state === "now");
  const focus = nowIdx >= 0 ? nowIdx : chips.length - 1;
  let start = 0;
  if (chips.length > max) start = Math.max(0, Math.min(chips.length - max, focus - 5));
  const shown = chips.slice(start, start + max);
  const after = chips.length - start - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1" role="list" aria-label="Các chặng ngày">
      {start > 0 && <span className="text-[10px] font-bold text-emerald-700">✓ {start}</span>}
      {shown.map((c) => {
        const pct = Math.round(c.fill * 100);
        return (
          <span
            key={c.idx}
            role="listitem"
            className={`wm-chip wm-chip-${c.state}`}
            style={
              c.state === "now"
                ? { background: `linear-gradient(to top, #fecdd3 ${pct}%, #fff1f2 ${pct}%)` }
                : undefined
            }
          >
            {c.state === "done" ? "✓" : c.idx}
          </span>
        );
      })}
      {after > 0 && <span className="text-[10px] font-bold text-stone-400">+{after}</span>}
    </div>
  );
}

// ===== Hình học cây dây đậu thần kỳ tán rộng (đơn vị viewBox; cây co giãn toàn chiều ngang khung) =====
const VB_W = 760;
const CX = 380; // trục giữa của cây
const ROW_H = 170; // mỗi tầng (cành) cao 170
const TOP_H = 250; // mây + đàn hạc vàng + tán ngọn cây
const GROUND_H = 175; // đảo nổi + biển mây
const VB_H = TOP_H + FLOORS.length * ROW_H + GROUND_H;
const TRUNK_TOP = 168;
const GROUND_Y = VB_H - GROUND_H + 14;
const FRUIT_CENTER_Y = 31; // tâm quả tính từ điểm treo
const FRUIT_DX = [132, 214, 296]; // khoảng cách 3 quả tới trục thân trên tán rộng

type Pt = [number, number];

const r1 = (n: number) => Math.round(n * 10) / 10; // làm tròn để máy chủ và trình duyệt vẽ giống nhau
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const rowTop = (level: number) => TOP_H + (FLOORS.length - level) * ROW_H;
const attachY = (level: number) => rowTop(level) + 52; // chỗ cành bám vào thân
const sideOf = (level: number): 1 | -1 => (level % 2 === 1 ? 1 : -1);
const pctX = (x: number) => `${(x / VB_W) * 100}%`;
const pctY = (y: number) => `${(y / VB_H) * 100}%`;
const fmt = (p: Pt) => `${r1(p[0])} ${r1(p[1])}`;

// Đường cong mượt đi qua các điểm
function smooth(pts: Pt[]): string {
  let d = `M${fmt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${fmt(pts[i])} ${r1(mx)} ${r1(my)}`;
  }
  return `${d} L${fmt(pts[pts.length - 1])}`;
}
const joinPath = (a: Pt[], b: Pt[]) =>
  `${smooth(a)}${smooth(b.slice().reverse()).replace(/^M/, " L")} Z`;
const polyPath = (l: Pt[], r: Pt[]) =>
  `M${l.map(fmt).join(" L")} L${r
    .slice()
    .reverse()
    .map(fmt)
    .join(" L")}Z`;

// ----- Thân đậu xoắn: dây leo bện xoắn ốc tự nhiên, to khỏe ở gốc, vươn lên mây -----
const stalkCx = (y: number) => CX + 28 * Math.sin(y / 160 + 0.55);
const stalkHw = (y: number) => {
  const t = clamp01((y - TRUNK_TOP) / (GROUND_Y - TRUNK_TOP));
  const flare = t > 0.92 ? 78 * Math.pow((t - 0.92) / 0.08, 2) : 0;
  const ropeBulge = 5.2 * Math.sin(((y - TRUNK_TOP) / 92) * Math.PI * 2);
  return 40 + 38 * Math.pow(t, 0.85) + ropeBulge + flare;
};
const STALK_YS: number[] = (() => {
  const a: number[] = [];
  for (let y = TRUNK_TOP; y < GROUND_Y - 110; y += 18) a.push(y);
  for (let y = GROUND_Y - 110; y < GROUND_Y; y += 12) a.push(y);
  a.push(GROUND_Y);
  return a;
})();
const edgeLine = (f: number): Pt[] =>
  STALK_YS.map((y) => {
    const ripple = f * 3.8 * Math.cos(((y - TRUNK_TOP) / 75) * Math.PI * 2 + (f > 0 ? 1.1 : 0));
    return [stalkCx(y) + f * stalkHw(y) + ripple, y] as Pt;
  });
const STALK_PATH = joinPath(edgeLine(-1), edgeLine(1));
const STALK_LIGHT = joinPath(edgeLine(-1), edgeLine(-0.48));
const STALK_SHADE = joinPath(edgeLine(0.42), edgeLine(1));

// Ba dải xoắn quấn quanh thân: chỉ vẽ phần quay về phía người xem
const PITCH = 300;
const HALF_BAND = 0.62;
const STRAND_FILL = ["#6fb534", "#58a02b", "#86c940"];
const normAng = (a: number) => {
  const t = (a + Math.PI) % (Math.PI * 2);
  return (t < 0 ? t + Math.PI * 2 : t) - Math.PI;
};
const clampAng = (a: number) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, a));

const STRANDS = [0, 1, 2].map((s) => {
  const bands: string[] = [];
  const glints: string[] = [];
  let l: Pt[] = [];
  let r: Pt[] = [];
  let c: Pt[] = [];
  const flush = () => {
    if (l.length > 3) {
      bands.push(polyPath(l, r));
      glints.push(`M${c.map(fmt).join(" L")}`);
    }
    l = [];
    r = [];
    c = [];
  };
  for (let y = TRUNK_TOP; y <= GROUND_Y; y += 6) {
    const ph = normAng(((y - TRUNK_TOP) / PITCH) * Math.PI * 2 + (s * Math.PI * 2) / 3);
    if (Math.cos(ph) > -0.55) {
      const cx = stalkCx(y);
      const hw = stalkHw(y);
      l.push([cx + hw * Math.sin(clampAng(ph - HALF_BAND)), y]);
      r.push([cx + hw * Math.sin(clampAng(ph + HALF_BAND)), y]);
      c.push([cx + hw * Math.sin(clampAng(ph - 0.28)), y]);
    } else flush();
  }
  flush();
  return { fill: STRAND_FILL[s], bands, glints };
});

// ----- Cành dây leo tán rộng: vươn xa sang hai bên, nhiều lá to xanh mướt -----
const BR_W0 = 15.5;
const BR_W1 = 4.6;
const LEAF_SPECS: [number, number, number][] = [
  [0.14, -68, 1.18],
  [0.28, -42, 1.32],
  [0.44, -64, 1.25],
  [0.60, -38, 1.30],
  [0.74, -58, 1.18],
  [0.86, -32, 1.12],
  [0.96, -16, 0.98],
];

interface LeafPos {
  x: number;
  y: number;
  ang: number;
  sc: number;
  s: 1 | -1;
}

const curl = (x: number, y: number, s: number) =>
  `M${r1(x)} ${r1(y)} c${s * 6} -10 ${s * 4} -22 ${-s * 8} -24 c${-s * 10} -2 ${-s * 14} 9 ${-s * 5} 13`;

function branchGeometry(level: number) {
  const s = sideOf(level);
  const ay = attachY(level);
  const x0 = stalkCx(ay) + s * (stalkHw(ay) - 8);
  const p0: Pt = [x0, ay + 12];
  const p1: Pt = [x0 + s * 135, ay - 44];
  const p2: Pt = [CX + s * 328, ay - 18];
  const at = (t: number): Pt => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  const tan = (t: number): Pt => [
    2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]),
    2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]),
  ];
  const half = (t: number) => BR_W0 + (BR_W1 - BR_W0) * Math.pow(t, 0.7);

  const top: Pt[] = [];
  const bot: Pt[] = [];
  const mid: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const [x, y] = at(t);
    const [dx, dy] = tan(t);
    const n = Math.hypot(dx, dy) || 1;
    const nx = -dy / n;
    const ny = dx / n;
    const h = half(t);
    top.push([x + nx * h, y + ny * h]);
    bot.push([x - nx * h, y - ny * h]);
    if (t >= 0.06 && t <= 0.92) mid.push([x + nx * h * 0.35, y + ny * h * 0.35]);
  }

  // Vị trí treo của 3 quả: trải rộng dọc theo tán cành lớn
  const hang: Pt[] = FRUIT_DX.map((dx) => {
    const target = CX + s * dx;
    let best = 1;
    let bestD = Infinity;
    for (let i = 15; i <= 100; i++) {
      const t = i / 100;
      const d = Math.abs(at(t)[0] - target);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    const [x, y] = at(best);
    return [r1(x), r1(y + half(best) * 0.42)] as Pt;
  });

  // Lá phía trên cành + lá đệm ở gốc cành tạo tán dày
  const leaves: LeafPos[] = LEAF_SPECS.map(([t, ang, sc]) => {
    const [x, y] = at(t);
    return { x: r1(x), y: r1(y - half(t) * 0.6), ang, sc, s };
  });
  const [ux1, uy1] = at(0.10);
  const [ux2, uy2] = at(0.36);
  leaves.push({ x: r1(ux1), y: r1(uy1 + half(0.10) * 0.65), ang: 66, sc: 1.05, s });
  leaves.push({ x: r1(ux2), y: r1(uy2 + half(0.36) * 0.65), ang: 58, sc: 0.95, s });

  const [tx, ty] = at(1);

  // Cành tán phụ bên đối diện thân cây: vươn dài tạo tán cây đối xứng sum suê
  const oy = ay + 64;
  const ox = stalkCx(oy) - s * (stalkHw(oy) - 8);
  const twigEndX = ox - s * 185;
  const twigCtrlX = ox - s * 88;
  const twigCtrlY = oy - 36;
  const twigEndY = oy - 16;
  const twigAt = (t: number): Pt => [
    (1 - t) * (1 - t) * ox + 2 * (1 - t) * t * twigCtrlX + t * t * twigEndX,
    (1 - t) * (1 - t) * oy + 2 * (1 - t) * t * twigCtrlY + t * t * twigEndY,
  ];
  const twigLeaves: LeafPos[] = [
    [0.22, -60, 1.12],
    [0.45, -36, 1.24],
    [0.68, -56, 1.15],
    [0.88, -24, 1.05],
    [0.32, 62, 0.95],
  ].map(([t, ang, sc]) => {
    const [lx, ly] = twigAt(t);
    return { x: r1(lx), y: r1(ly - 3), ang, sc, s: (-s) as 1 | -1 };
  });
  const [bgx, bgy] = at(0.22);

  return {
    s,
    ay,
    shape: `${smooth(top)}${smooth(bot.slice().reverse()).replace(/^M/, " L")} Z`,
    highlight: smooth(mid),
    hang,
    bug: [r1(bgx), r1(bgy - 26)] as Pt,
    leaves,
    tendril: curl(tx, ty, -s),
    twig: `M${r1(ox)} ${r1(oy)} Q${r1(twigCtrlX)} ${r1(twigCtrlY)} ${r1(twigEndX)} ${r1(twigEndY)}`,
    twigTendril: curl(twigEndX, twigEndY, s),
    twigLeaves,
  };
}
const GEOM = FLOORS.map((f) => branchGeometry(f.level));

// Lá hình trái tim nhọn, kích thước lớn hơn và có gân lá rõ nét
const LEAF = "M0 0 C7 -15 28 -20 44 0 C28 20 7 15 0 0Z";
const LEAF_HI = "M0 0 C7 -15 28 -20 44 0 C26 -5 9 -3 0 0Z";
const LEAF_VEIN = "M3 0 L36 0";

// Cỏ ở gốc, ngôi sao lấp lánh: tạo cố định trên toàn bề ngang rộng
const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};
const GRASS = (() => {
  const rnd = lcg(11);
  const out: string[] = [];
  for (let i = 0; i < 72; i++) {
    const x = 68 + i * (624 / 71) + (rnd() - 0.5) * 7;
    const h = 18 + rnd() * 24;
    const lean = (rnd() - 0.5) * 18;
    const y = GROUND_Y + 6 + (rnd() - 0.5) * 8;
    out.push(
      `M${r1(x - 4.5)} ${r1(y)} Q${r1(x + lean * 0.3)} ${r1(y - h * 0.6)} ${r1(x + lean)} ${r1(y - h)} Q${r1(x + 4.5 + lean * 0.2)} ${r1(y - h * 0.45)} ${r1(x + 4.5)} ${r1(y)}Z`
    );
  }
  return out;
})();
const sparkPath = (r: number) =>
  `M0 ${-r} Q0 0 ${r} 0 Q0 0 0 ${r} Q0 0 ${-r} 0 Q0 0 0 ${-r}Z`;
const SPARKLES = (() => {
  const rnd = lcg(7);
  const out: { x: number; y: number; r: number; d: number }[] = [];
  for (let i = 0; i < 48; i++) {
    out.push({
      x: r1(75 + rnd() * 610),
      y: r1(TOP_H + rnd() * (GROUND_Y - TOP_H - 90)),
      r: r1(3.2 + rnd() * 5),
      d: r1(rnd() * 4),
    });
  }
  return out;
})();

const BACK_CLOUDS = [
  { x: 110, y: 420, d: "0s", sc: 1.45 },
  { x: 640, y: 650, d: "-9s", sc: 1.3 },
  { x: 120, y: 980, d: "-4s", sc: 1.5 },
  { x: 635, y: 1280, d: "-14s", sc: 1.35 },
  { x: 115, y: 1520, d: "-7s", sc: 1.3 },
];
// Mây bay ngang thân ở khoảng trống giữa các cành
const FRONT_CLOUDS = FLOORS.filter((f) => f.level >= 2 && f.level <= 8 && f.level % 2 === 0).map(
  (f) => ({
    x: f.level % 4 === 0 ? 610 : 150,
    y: rowTop(f.level) + 140,
    d: `${-f.level * 3}s`,
    sc: 1.05 + (f.level % 3) * 0.15,
  })
);

type FruitState = "locked" | "unripe" | "ripe" | "picked";

function fruitState(
  f: FloorStat,
  k: number,
  picked: Set<string>,
  locked: boolean
): FruitState {
  if (locked) return "locked";
  if (picked.has(`${f.level}-${k}`)) return "picked";
  return f.learned >= f.targets[k] ? "ripe" : "unripe";
}

function Leaf({ p, delay }: { p: LeafPos; delay: number }) {
  return (
    <g transform={`translate(${p.x} ${p.y}) scale(${p.s} 1) rotate(${p.ang}) scale(${p.sc})`}>
      <g className="wm-leafpop" style={{ "--fd": `${delay}s` } as React.CSSProperties}>
        <g className="wm-leafsway">
          <path d="M0 0 Q5 -2 11 -1" className="wm-lf-stem" />
          <g transform="translate(10 -1)">
            <path d={LEAF} className="wm-lf" />
            <path d={LEAF_HI} className="wm-lf-hi" />
            <path d={LEAF_VEIN} className="wm-lf-vein" />
          </g>
        </g>
      </g>
    </g>
  );
}

function Cloud({
  x,
  y,
  sc,
  d,
  opacity = 0.85,
}: {
  x: number;
  y: number;
  sc: number;
  d: string;
  opacity?: number;
}) {
  return (
    <g className="wm-cloud" style={{ "--cd": d } as React.CSSProperties}>
      <g
        transform={`translate(${x} ${y}) scale(${sc})`}
        fill="#fff"
        stroke="#cfe2ee"
        strokeWidth="1.2"
        opacity={opacity}
      >
        <ellipse cx="0" cy="0" rx="28" ry="10" />
        <ellipse cx="-16" cy="-5" rx="14" ry="9" />
        <ellipse cx="12" cy="-8" rx="16" ry="11" />
      </g>
    </g>
  );
}

function FruitArt({ state }: { state: FruitState }) {
  return (
    <svg viewBox="0 0 34 48" className="block h-auto w-full" aria-hidden="true">
      <path d="M17 0 V16" stroke="#4d8b2f" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {state === "locked" && (
        <>
          <circle cx="17" cy="23" r="7" fill="#c9cfc6" />
          <path d="M14 20 Q17 17 20 20" stroke="#e3e7e1" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      )}
      {state === "unripe" && (
        <>
          <circle cx="17" cy="31" r="12.5" fill="#8ed36b" />
          <path d="M11 21 Q8 31 12 41" stroke="#3f9a3a" strokeWidth="2" opacity="0.55" fill="none" strokeLinecap="round" />
          <path d="M17 18.5 Q14 31 17 43.5" stroke="#3f9a3a" strokeWidth="2" opacity="0.55" fill="none" strokeLinecap="round" />
          <path d="M23 21 Q26 31 22 41" stroke="#3f9a3a" strokeWidth="2" opacity="0.55" fill="none" strokeLinecap="round" />
          <ellipse cx="12" cy="25" rx="3" ry="2" fill="#fff" opacity="0.35" transform="rotate(-30 12 25)" />
        </>
      )}
      {state === "ripe" && (
        <>
          <circle cx="17" cy="31" r="16" fill="#2f9e44" />
          <circle cx="17" cy="31" r="13.4" fill="#eaf8d3" />
          <circle cx="17" cy="31" r="11.8" fill="#ff4d6a" />
          <ellipse cx="12.5" cy="28.5" rx="1.1" ry="1.8" fill="#2b1b1b" transform="rotate(-20 12.5 28.5)" />
          <ellipse cx="21.5" cy="28.5" rx="1.1" ry="1.8" fill="#2b1b1b" transform="rotate(20 21.5 28.5)" />
          <ellipse cx="17" cy="34" rx="1.1" ry="1.8" fill="#2b1b1b" />
          <ellipse cx="12" cy="35" rx="1" ry="1.6" fill="#2b1b1b" transform="rotate(-35 12 35)" />
          <ellipse cx="22" cy="35" rx="1" ry="1.6" fill="#2b1b1b" transform="rotate(35 22 35)" />
          <path d="M9 26 Q11 21 16 20" stroke="#fff" strokeWidth="1.6" opacity="0.6" fill="none" strokeLinecap="round" />
        </>
      )}
      {state === "picked" && (
        <>
          <circle cx="17" cy="31" r="11" fill="none" stroke="#a8c79a" strokeWidth="1.6" strokeDasharray="3 3" />
          <path d="M11.5 31 L15.5 35 L23 27" stroke="#5aa84a" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export default function TowerHome() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<TowerData | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [selected, setSelected] = useState<{ level: number; fruit: number | null } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [pickKey, setPickKey] = useState<string | null>(null); // quả đang được hái
  const [uid, setUid] = useState<string>("anon");
  const [bump, setBump] = useState<number>(0);

  const load = useCallback(async () => {
    setError(false);
    try {
      setData(await loadTower(supabase));
    } catch {
      setError(true);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  // Giỏ dưa đã hái chỉ là hiệu ứng, lưu trên máy (mất thì quả chín hiện lại để hái)
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data: s }) => {
        if (!alive) return;
        const id = s.session?.user.id ?? "anon";
        setUid(id);
        try {
          const raw = localStorage.getItem(`tower.picked.${id}`);
          if (raw) setPicked(new Set(JSON.parse(raw) as string[]));
        } catch {
          /* bỏ qua nếu trình duyệt chặn localStorage */
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [supabase]);

  const today = new Date();
  const floors = data?.floors ?? buildFloors([], [], []);
  const current = data ? currentFloorLevel(floors) : 0;
  const pace = Math.max(1, data?.newTarget ?? 10); // số từ mỗi chặng = số từ mới mỗi ngày

  // Quả tiếp theo trên cành đang leo, và kế hoạch chặng ngày của nó
  const curFloor = data ? floors[current - 1] : null;
  const nextPlan =
    curFloor && curFloor.total > 0 && curFloor.stars < 3
      ? fruitPlan(curFloor, curFloor.stars, pace)
      : null;
  const nextChips = curFloor && nextPlan ? stageChips(curFloor, nextPlan.k, pace) : [];

  const missions: Mission[] = data
    ? [
        {
          key: "new",
          hanzi: "词",
          title: "Học từ mới",
          hint: nextPlan
            ? `Thêm thẻ cho tầng ${current}, hướng tới quả ${nextPlan.k + 1}`
            : "Thêm thẻ mới mỗi ngày",
          href: "/review",
          value: data.newToday,
          target: data.newTarget,
          unit: "từ",
        },
        {
          key: "review",
          hanzi: "忆",
          title: "Chấm thẻ ôn",
          hint: "Ôn đều để thẻ thành “đã thuộc”, quả mới chín",
          href: "/review",
          value: data.reviewToday,
          target: REVIEW_TARGET,
          unit: "lượt",
        },
        {
          key: "listen",
          hanzi: "听",
          title: "Nghe",
          hint: "Luyện tai, góp sao cho ngày",
          href: "/listen",
          value: data.listenToday,
          target: LISTEN_TARGET,
          unit: "lượt",
        },
        {
          key: "speak",
          hanzi: "说",
          title: "Nói",
          hint: "Luyện miệng, góp sao cho ngày",
          href: "/speak",
          value: data.speakToday,
          target: SPEAK_TARGET,
          unit: "lần đọc",
        },
      ]
    : [];
  const doneCount = missions.filter((m) => m.value >= m.target).length;
  const dayStars = dayStarsFromDone(doneCount);
  const streak = data ? calcStreak(data.active, today) : 0;
  const week = data ? weekStrip(data.active, today) : [];

  const loading = data === null;
  const crownReady = data !== null && floors[FLOORS.length - 1].stars === 3;
  const sel = selected ? floors[selected.level - 1] : null;
  const selDef = selected ? FLOORS[selected.level - 1] : null;

  let ripeWaiting = 0;
  let firstRipe: { level: number; k: number } | null = null;
  for (const f of floors) {
    if (f.total === 0) continue;
    for (let k = 0; k < FRUITS_PER_BRANCH; k++) {
      if (f.learned >= f.targets[k] && !picked.has(`${f.level}-${k}`)) {
        ripeWaiting++;
        if (!firstRipe) firstRipe = { level: f.level, k };
      }
    }
  }

  const harvest = (level: number, k: number) => {
    const key = `${level}-${k}`;
    if (pickKey !== null || picked.has(key)) return;
    setPickKey(key);
    window.setTimeout(() => {
      setPicked((prev) => {
        const next = new Set(prev);
        next.add(key);
        try {
          localStorage.setItem(`tower.picked.${uid}`, JSON.stringify(Array.from(next)));
        } catch {
          /* bỏ qua */
        }
        return next;
      });
      setBump((n) => n + 1);
      setPickKey(null);
    }, 650);
  };

  const onFruit = (level: number, k: number, state: FruitState) => {
    if (state === "ripe") {
      harvest(level, k);
      return;
    }
    setSelected({ level, fruit: k });
  };

  const scrollToFloor = (level: number) => {
    document
      .getElementById(`wm-floor-${level}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const goCurrent = () => scrollToFloor(current);

  const viewNext = () => {
    if (!nextPlan) return;
    setSelected({ level: current, fruit: nextPlan.k });
    scrollToFloor(current);
  };

  const goRipe = () => {
    if (!firstRipe) return;
    setSelected({ level: firstRipe.level, fruit: firstRipe.k });
    scrollToFloor(firstRipe.level);
  };

  return (
    <div className="space-y-6">
      {/* ===== Nhiệm vụ hôm nay ===== */}
      <section className="rise rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-6 border border-white/90 shadow-[0_8px_30px_rgb(229,51,79,0.08)] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Nhiệm vụ hôm nay</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {data ? `Xong ${doneCount}/4 nhiệm vụ` : "Đang tính tiến độ..."}
            </p>
          </div>
          <div className="text-right space-y-1">
            <div className={dayStars === 3 ? "anim-pop" : ""}>
              <Stars n={dayStars} size="text-2xl" />
            </div>
            <div className="text-xs font-semibold text-rose-600">
              🔥 Chuỗi {streak} ngày
            </div>
          </div>
        </div>

        {/* Quả tiếp theo: nối nhiệm vụ ngày với tiến trình trên cây */}
        {data && (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-lime-50 p-4">
            {ripeWaiting > 0 && (
              <button
                type="button"
                onClick={goRipe}
                className="flex w-full items-center justify-between gap-2 rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-rose-500/25"
              >
                <span>🍉 {ripeWaiting} quả chín đang chờ hái</span>
                <span className="text-xs">Hái ngay →</span>
              </button>
            )}
            {nextPlan && curFloor ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700/80">
                      Quả tiếp theo
                    </p>
                    <p className="text-base font-bold text-stone-900">
                      🍉 Quả {nextPlan.k + 1} · Tầng {current} {FLOORS[current - 1].name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={viewNext}
                    className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/25"
                  >
                    Xem trên cây
                  </button>
                </div>

                <div>
                  <div className="flex items-baseline justify-between text-xs font-semibold text-emerald-800">
                    <span>
                      Đã thuộc {curFloor.learned}/{nextPlan.target} từ
                    </span>
                    <span>còn {nextPlan.need} từ</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-500 transition-[width] duration-700"
                      style={{
                        width: `${Math.round(clamp01(curFloor.learned / nextPlan.target) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <p className="text-sm text-stone-700">
                  <span className="font-bold text-rose-600">
                    Chặng {nextPlan.stageNow}/{nextPlan.stageTotal}:
                  </span>{" "}
                  thuộc thêm <span className="font-bold">{nextPlan.stageLeft} từ</span> là xong chặng
                  hôm nay. Giữ nhịp {pace} từ/ngày, khoảng{" "}
                  <span className="font-bold">{nextPlan.days} ngày</span> nữa hái được.
                </p>
                <StageChips chips={nextChips} />
              </>
            ) : (
              <p className="text-sm font-semibold text-emerald-800">
                Cây đã đủ 3 quả ở mọi tầng. Giữ chuỗi ngày để dưa luôn tươi!
              </p>
            )}
          </div>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2">
          {(data ? missions : ([null, null, null, null] as (Mission | null)[])).map((m, i) => {
            if (!m) {
              return (
                <div
                  key={i}
                  className="h-[68px] rounded-2xl bg-rose-50/70 animate-pulse"
                />
              );
            }
            const done = m.value >= m.target;
            const pct = m.target > 0 ? Math.min(100, (m.value / m.target) * 100) : 100;
            return (
              <Link
                key={m.key}
                href={m.href}
                className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                  done
                    ? "bg-emerald-50/80 border-emerald-200"
                    : "bg-white/70 border-rose-100 hover:bg-rose-50/60"
                }`}
              >
                <span
                  className={`font-hanzi shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-sm ${
                    done
                      ? "bg-gradient-to-br from-emerald-500 to-green-600"
                      : "bg-gradient-to-br from-rose-500 to-pink-500"
                  }`}
                >
                  {done ? "✓" : m.hanzi}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-stone-900">{m.title}</span>
                    <span className="text-xs font-semibold text-stone-500">
                      {Math.min(m.value, 999)}/{m.target} {m.unit}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-tight text-stone-500">
                    {m.hint}
                  </span>
                  <span className="mt-1.5 block h-2 rounded-full bg-stone-200/70 overflow-hidden">
                    <span
                      className={`block h-full rounded-full transition-[width] duration-700 ${
                        done
                          ? "bg-gradient-to-r from-emerald-500 to-green-500"
                          : "bg-gradient-to-r from-rose-400 to-red-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        {data && (
          <div className="flex items-center justify-between gap-1 pt-1">
            {week.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-1">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    d.active
                      ? "bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-sm shadow-rose-500/30"
                      : "bg-stone-100 text-stone-300"
                  } ${d.isToday ? "ring-2 ring-rose-300 ring-offset-1" : ""}`}
                >
                  {d.active ? "✓" : "·"}
                </span>
                <span className={`text-[10px] font-medium ${d.isToday ? "text-rose-600" : "text-stone-400"}`}>
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== Cây Dưa Hấu thần kỳ ===== */}
      <section className="space-y-3">
        <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Cây Dưa Hấu thần kỳ · HSK 3.0
            </h2>
            <p className="mt-0.5 text-xs text-emerald-700/70">
              {data ? `Đang leo tầng ${current}` : "Đang tải cây..."}
              {ripeWaiting > 0 ? ` · ${ripeWaiting} quả chín đang chờ hái` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              key={bump}
              className={`whitespace-nowrap rounded-full border border-rose-100 bg-white/85 px-3 py-1.5 text-xs font-bold text-rose-600 ${
                bump > 0 ? "wm-bump" : ""
              }`}
            >
              🧺 {picked.size}/{FLOORS.length * FRUITS_PER_BRANCH}
            </span>
            {data && (
              <button
                type="button"
                onClick={goCurrent}
                className="whitespace-nowrap rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-rose-500/25"
              >
                ↓ Tới tầng {current}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50/90 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <span>Chưa tải được tiến độ. Cần có mạng.</span>
            <button
              type="button"
              onClick={() => void load()}
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Thử lại
            </button>
          </div>
        )}

                <div className="relative mx-auto w-full">
          <div
            className="wm-tree relative overflow-hidden rounded-3xl border border-white/80 shadow-[0_20px_60px_rgb(60,110,60,0.25)]"
            style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
          >
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label="Cây đậu thần kỳ tán rộng có thân xoắn, đỉnh Đàn Hạc Hoàng Kim trên mây và mỗi tầng một cành lớn"
            >
              {/* Mây phía sau */}
              {BACK_CLOUDS.map((c, i) => (
                <Cloud key={i} x={c.x} y={c.y} sc={c.sc} d={c.d} />
              ))}

              {/* Đảo nổi rộng ở gốc cây */}
              <path
                d={`M60 ${GROUND_Y} C88 ${GROUND_Y + 66} 245 ${GROUND_Y + 108} ${CX} ${GROUND_Y + 126} C515 ${GROUND_Y + 108} 672 ${GROUND_Y + 66} 700 ${GROUND_Y} Z`}
                fill="#8a5a34"
                stroke="#3d2412"
                strokeWidth="2.5"
              />
              <path d={`M115 ${GROUND_Y + 28} Q${CX} ${GROUND_Y + 60} 645 ${GROUND_Y + 28}`} fill="none" stroke="#6b4226" strokeWidth="3.2" opacity="0.6" strokeLinecap="round" />
              <path d={`M180 ${GROUND_Y + 58} Q${CX} ${GROUND_Y + 86} 580 ${GROUND_Y + 58}`} fill="none" stroke="#6b4226" strokeWidth="3.2" opacity="0.6" strokeLinecap="round" />
              {[
                [275, 88],
                [CX, 110],
                [485, 90],
              ].map(([x, y], i) => (
                <path
                  key={i}
                  d={`M${x} ${GROUND_Y + y} q${i === 1 ? 4 : -6} 18 ${i === 1 ? -2 : 3} 32`}
                  fill="none"
                  stroke="#5a3a1e"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              ))}
              <path
                d={`M48 ${GROUND_Y + 2} C150 ${GROUND_Y - 34} 610 ${GROUND_Y - 34} 712 ${GROUND_Y + 2} C708 ${GROUND_Y + 20} 560 ${GROUND_Y + 28} ${CX} ${GROUND_Y + 28} C200 ${GROUND_Y + 28} 52 ${GROUND_Y + 20} 48 ${GROUND_Y + 2} Z`}
                fill="#7cc24a"
                stroke="#3f8a2c"
                strokeWidth="2.5"
              />
              <path d={`M95 ${GROUND_Y - 4} C210 ${GROUND_Y - 26} 550 ${GROUND_Y - 26} 665 ${GROUND_Y - 4}`} fill="none" stroke="#b6ec84" strokeWidth="4.5" opacity="0.7" strokeLinecap="round" />

              {/* Từng cành = từng tầng (tán chính + tán phụ đối xứng) */}
              {FLOORS.map((def) => {
                const f = floors[def.level - 1];
                const g = GEOM[def.level - 1];
                const locked = loading || f.total === 0 || !f.unlocked;
                const d = (def.level - 1) * 0.14;
                const ext = g.s > 0 ? "wm-ext wm-ext-r" : "wm-ext wm-ext-l";
                return (
                  <g
                    key={def.level}
                    className={locked ? "wm-locked" : undefined}
                    style={{ "--d": `${d}s` } as React.CSSProperties}
                  >
                    <path d={g.twig} fill="none" strokeWidth="8.5" strokeLinecap="round" className="wm-twig" />
                    <path d={g.twigTendril} fill="none" strokeWidth="2.6" strokeLinecap="round" className="wm-tendril" />
                    {g.twigLeaves.map((p, i) => (
                      <Leaf key={`t${i}`} p={p} delay={d + 0.75 + i * 0.1} />
                    ))}
                    <path d={g.shape} strokeWidth="2" strokeLinejoin="round" className={`wm-stem ${ext}`} />
                    <path d={g.highlight} fill="none" strokeWidth="3" strokeLinecap="round" className={`wm-stem-hl ${ext}`} />
                    <path d={g.tendril} fill="none" strokeWidth="2.8" strokeLinecap="round" className="wm-tendril" />
                    {g.leaves.map((p, i) => (
                      <Leaf key={i} p={p} delay={d + 0.55 + i * 0.08} />
                    ))}
                  </g>
                );
              })}

              {/* Thân đậu xoắn */}
              <path d={STALK_PATH} fill="#3f7a1f" />
              {STRANDS.map((st, si) => (
                <g key={si}>
                  {st.bands.map((b, i) => (
                    <path key={i} d={b} fill={st.fill} stroke="#2c5a16" strokeWidth="1.4" strokeLinejoin="round" />
                  ))}
                  {st.glints.map((gl, i) => (
                    <path key={`g${i}`} d={gl} fill="none" stroke="#d2f59a" strokeWidth="1.8" strokeLinecap="round" opacity="0.52" />
                  ))}
                </g>
              ))}
              <path d={STALK_LIGHT} fill="#d9f7a5" opacity="0.22" />
              <path d={STALK_SHADE} fill="#1d3f0c" opacity="0.22" />
              <path d={STALK_PATH} fill="none" stroke="#2c5a16" strokeWidth="2.8" strokeLinejoin="round" />

              {/* Cỏ ở gốc */}
              {GRASS.map((gp, i) => (
                <path key={i} d={gp} fill={i % 3 === 0 ? "#86cf52" : "#6bb83f"} stroke="#3f8a2c" strokeWidth="1.2" strokeLinejoin="round" />
              ))}

              {/* Gradients cho Đàn Hạc Hoàng Kim & Mây Bồng Bềnh */}
              <defs>
                <linearGradient id="harpGoldMain" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff3a6" />
                  <stop offset="35%" stopColor="#fcc419" />
                  <stop offset="75%" stopColor="#e67700" />
                  <stop offset="100%" stopColor="#9c4200" />
                </linearGradient>
                <linearGradient id="harpGoldLight" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fff9db" />
                  <stop offset="50%" stopColor="#ffd43b" />
                  <stop offset="100%" stopColor="#f08c00" />
                </linearGradient>
                <linearGradient id="cloudShade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="72%" stopColor="#f8f6eb" />
                  <stop offset="100%" stopColor="#dfd9c0" />
                </linearGradient>
                <linearGradient id="topVineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#94d82d" />
                  <stop offset="60%" stopColor="#5c940d" />
                  <stop offset="100%" stopColor="#2b5211" />
                </linearGradient>
              </defs>

              {/* Lá mầm lớn mọc trực tiếp dọc thân cây đậu */}
              {FLOORS.map((def) => {
                const yMid = rowTop(def.level) + 115;
                const s = sideOf(def.level);
                const lx = stalkCx(yMid) - s * (stalkHw(yMid) - 4);
                return (
                  <g key={`trunk-lf-${def.level}`}>
                    <Leaf
                      p={{ x: r1(lx), y: r1(yMid), ang: -26, sc: 1.38, s: (-s) as 1 | -1 }}
                      delay={def.level * 0.1}
                    />
                    <path
                      d={curl(lx - s * 12, yMid - 20, s)}
                      fill="none"
                      stroke="#7cc63b"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}

              {/* Tán lá rộng & đọt dây leo uốn lượn vươn cao ở đỉnh cây (quanh đám mây) */}
              <g>
                {/* Cành tán vòm bên trái dưới đám mây */}
                <path
                  d={`M${CX - 20} 198 Q${CX - 115} 162 ${CX - 210} 182`}
                  fill="none"
                  stroke="#4d8828"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
                <path d={curl(CX - 210, 182, 1)} fill="none" stroke="#7cc63b" strokeWidth="3" strokeLinecap="round" />
                <Leaf p={{ x: CX - 85, y: 174, ang: -48, sc: 1.35, s: -1 }} delay={0.3} />
                <Leaf p={{ x: CX - 145, y: 172, ang: -28, sc: 1.28, s: -1 }} delay={0.38} />
                <Leaf p={{ x: CX - 195, y: 178, ang: -14, sc: 1.12, s: -1 }} delay={0.45} />

                {/* Cành tán vòm bên phải dưới đám mây */}
                <path
                  d={`M${CX + 24} 198 Q${CX + 125} 164 ${CX + 220} 184`}
                  fill="none"
                  stroke="#4d8828"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
                <path d={curl(CX + 220, 184, -1)} fill="none" stroke="#7cc63b" strokeWidth="3" strokeLinecap="round" />
                <Leaf p={{ x: CX + 90, y: 174, ang: -46, sc: 1.35, s: 1 }} delay={0.32} />
                <Leaf p={{ x: CX + 152, y: 173, ang: -26, sc: 1.28, s: 1 }} delay={0.4} />
                <Leaf p={{ x: CX + 202, y: 180, ang: -12, sc: 1.12, s: 1 }} delay={0.48} />

                {/* Nhánh đọt dây leo chính vươn cao lên trời bên trái Đàn Hạc (giống hệt tranh mẫu) */}
                <path
                  d={`M${CX - 10} 195 C${CX - 34} 158, ${CX - 48} 125, ${CX - 44} 84 C${CX - 40} 52, ${CX - 62} 28, ${CX - 68} 8 C${CX - 74} 34, ${CX - 56} 62, ${CX - 62} 92 C${CX - 68} 128, ${CX - 54} 162, ${CX - 32} 200 Z`}
                  fill="url(#topVineGrad)"
                  stroke="#244712"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                {/* Đọt xoắn ốc bên phải ngọn dây leo */}
                <path
                  d={`M${CX - 46} 76 C${CX - 34} 50, ${CX - 8} 46, ${CX - 10} 28 C${CX - 12} 14, ${CX - 36} 20, ${CX - 28} 34`}
                  fill="none"
                  stroke="#6eb030"
                  strokeWidth="4.8"
                  strokeLinecap="round"
                />
                {/* Đọt xoắn ốc vươn sang trái */}
                <path
                  d={`M${CX - 58} 68 C${CX - 84} 54, ${CX - 104} 62, ${CX - 106} 44 C${CX - 108} 28, ${CX - 86} 26, ${CX - 88} 40`}
                  fill="none"
                  stroke="#7cc63b"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                />
                {/* Lá lớn ở cổ mây */}
                <Leaf p={{ x: CX - 58, y: 122, ang: -24, sc: 1.42, s: -1 }} delay={0.4} />
                <Leaf p={{ x: CX + 18, y: 186, ang: -16, sc: 1.45, s: 1 }} delay={0.5} />
              </g>

              {/* Lấp lánh 4 cánh vàng quanh thân cây & tán lá */}
              {SPARKLES.map((sp, i) => (
                <path
                  key={i}
                  d={sparkPath(sp.r * 1.25)}
                  transform={`translate(${sp.x} ${sp.y})`}
                  fill="#fff3a8"
                  stroke="#ffd43b"
                  strokeWidth="0.6"
                  className="wm-star"
                  style={{ "--sd": `${sp.d}s` } as React.CSSProperties}
                />
              ))}
              {/* Các ngôi sao lớn lấp lánh quanh Đàn Hạc & Ngọn Đậu */}
              {[
                { x: CX - 135, y: 142, r: 8.5, d: 0.2 },
                { x: CX + 135, y: 138, r: 7.5, d: 1.1 },
                { x: CX + 155, y: 185, r: 10.0, d: 0.6 },
                { x: CX - 115, y: 195, r: 6.0, d: 1.8 },
              ].map((sp, idx) => (
                <path
                  key={`top-sp-${idx}`}
                  d={sparkPath(sp.r)}
                  transform={`translate(${sp.x} ${sp.y})`}
                  fill="#fff9db"
                  stroke="#fcc419"
                  strokeWidth="0.8"
                  className="wm-star"
                  style={{ "--sd": `${sp.d}s` } as React.CSSProperties}
                />
              ))}

              {/* ĐÀN HẠC HOÀNG KIM (GOLDEN HARP) ĐẶT TRÊN ĐÁM MÂY BỒNG BỀNH */}
              <g transform={`translate(${CX + 22} 122)`}>
                {crownReady && (
                  <g className="wm-rays" transform="translate(0 -42)">
                    {Array.from({ length: 12 }, (_, i) => (
                      <rect key={i} x="-2.5" y="-92" width="5" height="20" rx="2.5" fill="#ffd43b" transform={`rotate(${i * 30})`} />
                    ))}
                  </g>
                )}

                {/* Lớp mây hậu cảnh phía sau lưng Đàn Hạc */}
                <path
                  d="M-88 32 C-118 32, -122 2, -90 -6 C-82 -28, -36 -34, -8 -18 C18 -36, 68 -28, 78 -4 C110 -2, 112 30, 80 36 Z"
                  fill="url(#cloudShade)"
                  stroke="#d5cfb8"
                  strokeWidth="2.2"
                />

                {/* Cây Đàn Hạc Hoàng Kim: tách riêng thẻ <g transform> ngoài để CSS .wm-crown không đè tọa độ */}
                <g transform="translate(-54 -102) scale(1.12)">
                  <g className="wm-crown">
                    {/* Dây đàn hạc vàng óng */}
                    {[26, 35, 44, 53, 62, 71, 80].map((sx, idx) => (
                      <line
                        key={idx}
                        x1={sx}
                        y1={24 + idx * 2.4}
                        x2={sx - 5}
                        y2={104}
                        stroke="#fff3bf"
                        strokeWidth="2"
                        opacity="0.95"
                      />
                    ))}

                    {/* Hộp cộng hưởng bên phải (Soundbox) */}
                    <path
                      d="M66 104 L82 104 L96 34 C96 28, 86 28, 84 35 L62 102 Z"
                      fill="url(#harpGoldMain)"
                      stroke="#5c2b04"
                      strokeWidth="2.6"
                      strokeLinejoin="round"
                    />

                    {/* Trụ đàn uốn cong bên trái + Đầu xoắn ốc cổ điển (Pillar & Scroll) */}
                    <path
                      d="M22 104 C10 74, 10 42, 16 20 C8 20, 4 10, 12 4 C22 -2, 34 6, 38 14 C52 28, 72 32, 92 24 C98 21, 103 28, 96 34 C74 44, 50 40, 32 24 C24 46, 24 74, 36 104 Z"
                      fill="url(#harpGoldMain)"
                      stroke="#5c2b04"
                      strokeWidth="2.6"
                      strokeLinejoin="round"
                    />

                    {/* Đường viền sáng bóng 3D trên thân đàn */}
                    <path
                      d="M15 10 C22 4, 30 10, 35 17 C50 31, 70 35, 90 27"
                      fill="none"
                      stroke="url(#harpGoldLight)"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M20 24 C15 48, 16 74, 27 100"
                      fill="none"
                      stroke="#fff3bf"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      opacity="0.85"
                    />
                    {/* Xoắn ốc chạm khắc ở đỉnh trái */}
                    <path
                      d="M14 14 C10 10, 15 5, 20 9 C23 12, 19 17, 16 15"
                      fill="none"
                      stroke="#5c2b04"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />

                    {/* Đế đàn hạc (Pedestal Base) nằm gọn trên mặt đám mây */}
                    <rect
                      x="18"
                      y="100"
                      width="68"
                      height="11"
                      rx="4"
                      fill="url(#harpGoldLight)"
                      stroke="#5c2b04"
                      strokeWidth="2.5"
                    />
                  </g>
                </g>

                {/* Lớp mây trắng bồng bềnh phía trước ôm nhẹ dưới chân Đàn Hạc */}
                <path
                  d="M-92 34 C-122 34, -124 4, -92 0 C-76 -16, -40 -14, -24 0 C-6 -14, 30 -14, 46 2 C68 -12, 104 -2, 102 22 C110 42, 74 56, 44 46 C18 58, -22 58, -46 44 C-68 52, -96 46, -92 34 Z"
                  fill="url(#cloudShade)"
                  stroke="#d0cab2"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                {/* Ánh sáng trắng mịn trên đỉnh các múi mây */}
                <path
                  d="M-86 8 C-70 -8, -40 -8, -24 6 C-6 -8, 28 -8, 44 8 C64 -4, 94 2, 94 20"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </g>

              {/* Mây bay ngang thân và biển mây dưới đảo */}
              {FRONT_CLOUDS.map((c, i) => (
                <Cloud key={i} x={c.x} y={c.y} sc={c.sc} d={c.d} opacity={0.92} />
              ))}
              <g className="wm-cloud" style={{ "--cd": "-5s" } as React.CSSProperties}>
                {Array.from({ length: 19 }, (_, i) => (
                  <circle key={i} cx={-20 + i * 44} cy={VB_H - 62 + (i % 2) * 10} r="46" fill="#dff1ff" />
                ))}
              </g>
              <g className="wm-cloud" style={{ "--cd": "-12s" } as React.CSSProperties}>
                {Array.from({ length: 19 }, (_, i) => (
                  <circle key={i} cx={-10 + i * 42} cy={VB_H - 36 + (i % 2) * 8} r="42" fill="#fff" />
                ))}
              </g>
              <rect x="-60" y={VB_H - 30} width="880" height="40" fill="#fff" />
            </svg>

            {/* Lớp chạm: biển tên tầng gắn trên thân, quả dưa, bọ rùa */}
            {FLOORS.map((def) => {
              const f = floors[def.level - 1];
              const g = GEOM[def.level - 1];
              const empty = !loading && f.total === 0;
              const locked = loading || empty || !f.unlocked;
              const isCurrent = !loading && def.level === current;
              const d = (def.level - 1) * 0.14;
              const top = rowTop(def.level);
              const cx = stalkCx(top + 100);
              // Thanh tiến độ của biển = tiến độ tới quả tiếp theo của tầng
              const nk = Math.min(2, f.stars);
              const full = f.stars >= 3;
              const nPrev = nk > 0 ? f.targets[nk - 1] : 0;
              const nTarget = f.targets[nk];
              const barPct = loading || empty
                ? 0
                : full
                  ? 100
                  : Math.round(clamp01((f.learned - nPrev) / Math.max(1, nTarget - nPrev)) * 100);
              return (
                <div key={def.level} className="contents">
                  <button
                    type="button"
                    id={`wm-floor-${def.level}`}
                    onClick={() => setSelected({ level: def.level, fruit: null })}
                    className={`wm-label rounded-xl border-2 bg-[#fffbee] p-1.5 shadow-[0_5px_14px_rgb(30,70,20,0.3)] ${
                      isCurrent ? "border-rose-500 ring-4 ring-rose-400/35" : "border-[#5d9a2a]"
                    } ${locked ? "opacity-90" : ""}`}
                    style={
                      {
                        left: pctX(cx),
                        top: pctY(top + 66),
                        "--d": `${d}s`,
                      } as React.CSSProperties
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${def.grad} text-xs font-extrabold text-white ${
                          locked ? "grayscale" : ""
                        }`}
                      >
                        {locked ? "🔒" : def.level}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[9px] font-bold uppercase leading-none tracking-wider text-[#4a8a26]">
                          Tầng {def.level}
                        </span>
                        <span className="block truncate text-[12.5px] font-bold leading-tight text-[#1f4a12]">
                          {def.name}
                        </span>
                      </span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#dfe9c9]">
                      <span
                        className={`block h-full rounded-full bg-gradient-to-r ${def.grad} transition-[width] duration-700`}
                        style={{ width: `${barPct}%` }}
                      />
                    </span>
                    <span className="mt-0.5 flex items-center justify-between text-[10.5px] font-semibold text-[#4f6b3a]">
                      <span>
                        {loading
                          ? "..."
                          : empty
                            ? "Đang ươm"
                            : full
                              ? "Đủ 3 quả"
                              : `${f.learned}/${nTarget} từ`}
                      </span>
                      <span>🍉{f.stars}/3</span>
                    </span>
                    {isCurrent && (
                      <span className="absolute -right-1.5 -top-3 whitespace-nowrap rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                        Đang leo
                      </span>
                    )}
                  </button>

                  {[0, 1, 2].map((k) => {
                    const key = `${def.level}-${k}`;
                    const state = fruitState(f, k, picked, locked);
                    const [fx, by] = g.hang[k];
                    const popping = pickKey === key;
                    const need = f.targets[k];
                    const label =
                      state === "ripe"
                        ? `Hái quả ${k + 1} tầng ${def.level}`
                        : state === "picked"
                          ? `Quả ${k + 1} tầng ${def.level} đã hái`
                          : `Quả ${k + 1} tầng ${def.level}, cần thuộc ${need} từ`;
                    return (
                      <div key={k} className="contents">
                        <button
                          type="button"
                          data-no-burst={state === "ripe" ? "" : undefined}
                          aria-label={label}
                          onClick={() => onFruit(def.level, k, state)}
                          className={`wm-fruit wm-fruit-${state} ${popping ? "wm-popping" : ""}`}
                          style={
                            {
                              left: pctX(fx),
                              top: pctY(by),
                              "--k": k,
                              "--sd": `${-(def.level + k) * 0.7}s`,
                              "--fd": `${d + 0.9 + k * 0.15}s`,
                            } as React.CSSProperties
                          }
                        >
                          <FruitArt state={state} />
                        </button>
                        {popping &&
                          Array.from({ length: 10 }, (_, i) => (
                            <span
                              key={i}
                              className="wm-spark"
                              aria-hidden="true"
                              style={
                                {
                                  left: pctX(fx),
                                  top: pctY(by + FRUIT_CENTER_Y),
                                  "--a": `${i * 36}deg`,
                                  background: ["#ffd24d", "#ff5a78", "#7ddc7a"][i % 3],
                                } as React.CSSProperties
                              }
                            />
                          ))}
                      </div>
                    );
                  })}

                  {isCurrent && (
                    <span
                      className="wm-bug"
                      aria-hidden="true"
                      style={{ left: pctX(g.bug[0]), top: pctY(g.bug[1]) }}
                    >
                      🐞
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bảng chi tiết, dính ở đáy màn hình khi đang xem cây */}
          {selected && sel && selDef && (
            <div className="wm-sheet sticky bottom-3 z-30 mt-3 max-h-[75vh] overflow-y-auto rounded-3xl border border-emerald-100 bg-white/95 p-4 shadow-[0_-10px_40px_rgb(60,130,60,0.25)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                    Tầng {selDef.level}
                  </p>
                  <h3 className="text-lg font-bold text-stone-900">{selDef.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Đóng"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500"
                >
                  ✕
                </button>
              </div>

              {sel.total === 0 ? (
                <p className="mt-3 text-sm text-stone-600">
                  Cành này đang ươm: chưa có từ nào ở tầng này trong dữ liệu HSK 3.0 hiện tại.
                </p>
              ) : !sel.unlocked ? (
                <p className="mt-3 text-sm text-stone-600">
                  Hái ít nhất 1 quả chín ở tầng {selDef.level - 1} để mở cành này.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-stone-500">
                    Mỗi chặng = 1 ngày = {pace} từ (đổi số từ mới mỗi ngày trong Cài đặt). Xong chặng
                    nào thì ô đó hiện ✓.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {sel.targets.map((t, k) => {
                      const plan = fruitPlan(sel, k, pace);
                      const isPicked = picked.has(`${sel.level}-${k}`);
                      const focus = selected.fruit === k;
                      return (
                        <li
                          key={k}
                          className={`space-y-2 rounded-xl px-3 py-2.5 text-sm ${
                            focus ? "bg-emerald-50 ring-2 ring-emerald-200" : "bg-stone-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">🍉 Quả {k + 1}</span>
                            <span className={plan.ripe ? "font-semibold text-emerald-700" : "text-stone-600"}>
                              {isPicked
                                ? "Đã hái ✓"
                                : plan.ripe
                                  ? "Chín rồi, chạm để hái!"
                                  : `Cần thuộc ${t} từ · còn ${plan.need}`}
                            </span>
                          </div>
                          {!plan.ripe && (
                            <>
                              <p className="text-[11px] text-stone-500">
                                {plan.stageTotal} chặng · chặng {plan.stageNow} cần thuộc đến{" "}
                                {plan.stageGoal} từ (còn {plan.stageLeft})
                              </p>
                              <StageChips chips={stageChips(sel, k, pace)} />
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-stone-500">
                    Đã có thẻ {sel.cards} từ · đã thuộc {sel.learned}/{sel.total} từ.
                    {selDef.level >= SPLIT_LEVEL
                      ? ` HSK ${SPLIT_LEVEL} rất lớn nên được chia thành ${SPLIT_PARTS} tầng (${SPLIT_LEVEL} đến ${
                          SPLIT_LEVEL + SPLIT_PARTS - 1
                        }), từ thường gặp xếp trước.`
                      : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/review"
                      className="rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-rose-500/25"
                    >
                      Ôn thẻ
                    </Link>
                    <Link
                      href="/vocab"
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                    >
                      Xem từ vựng
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
