"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./tower.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { refreshSettings } from "@/lib/settings";
import {
  FLOORS,
  FRUITS_PER_BRANCH,
  MILESTONE_SIZE,
  REVIEW_TARGET,
  LISTEN_TARGET,
  SPEAK_TARGET,
  buildFloors,
  calcStreak,
  currentFloorLevel,
  dayKey,
  dayStarsFromDone,
  weekStrip,
  type FloorStat,
} from "@/lib/tower";

type SupabaseBrowser = ReturnType<typeof createClient>;

interface Mission {
  key: string;
  hanzi: string;
  title: string;
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

// Tra cấp HSK 3.0 của các từ đã có thẻ (chia nhỏ để địa chỉ truy vấn không quá dài)
async function fetchLevels(supabase: SupabaseBrowser, ids: string[]) {
  const map = new Map<string, number>();
  const CHUNK = 100;
  const BATCH = 6;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  for (let i = 0; i < chunks.length; i += BATCH) {
    const results = await Promise.all(
      chunks
        .slice(i, i + BATCH)
        .map((c) => supabase.from("words").select("id, hsk_new_level").in("id", c))
    );
    for (const r of results) {
      if (r.error) throw r.error;
      for (const w of (r.data ?? []) as { id: string; hsk_new_level: number | null }[]) {
        if (w.hsk_new_level) map.set(w.id, w.hsk_new_level);
      }
    }
  }
  return map;
}

async function loadTower(supabase: SupabaseBrowser): Promise<TowerData> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since = new Date(startOfDay);
  since.setDate(since.getDate() - HISTORY_DAYS);

  const settingsPromise = refreshSettings().catch(() => null);

  const totalsPromise = Promise.all(
    FLOORS.map((f) =>
      supabase
        .from("words")
        .select("id", { count: "exact", head: true })
        .eq("hsk_new_level", f.level)
    )
  );

  const [newRes, revCountRes, revRes, skillRes, cards, totalsRes, settings] =
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
      settingsPromise,
    ]);

  if (newRes.error || revCountRes.error || revRes.error) {
    throw newRes.error ?? revCountRes.error ?? revRes.error;
  }

  const levels = await fetchLevels(supabase, cards.map((c) => c.word_id));
  const cardCount = FLOORS.map(() => 0);
  const learned = FLOORS.map(() => 0);
  for (const c of cards) {
    const lv = levels.get(c.word_id);
    if (!lv) continue;
    cardCount[lv - 1]++;
    if (c.state === "review") learned[lv - 1]++;
  }
  const totals = totalsRes.map((r) => r.count ?? 0);

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
    settings && typeof settings.newPerDay === "number" ? settings.newPerDay : 10;

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

// ===== Hình học cây cổ thụ (đơn vị viewBox; cây co giãn theo bề ngang màn hình) =====
const VB_W = 400;
const ROW_H = 170; // mỗi tầng (cành) cao 170
const TOP_H = 230; // tán cây + quả dưa khổng lồ
const GROUND_H = 175; // đảo nổi + biển mây
const VB_H = TOP_H + FLOORS.length * ROW_H + GROUND_H;
const TRUNK_TOP = TOP_H - 100;
const GROUND_Y = VB_H - GROUND_H + 14;
const FRUIT_CENTER_Y = 31; // tâm quả tính từ điểm treo
const FRUIT_DX = [92, 132, 170]; // khoảng cách 3 quả tới trục thân

type Pt = [number, number];

const r1 = (n: number) => Math.round(n * 10) / 10; // làm tròn để máy chủ và trình duyệt vẽ giống nhau
const rowTop = (level: number) => TOP_H + (FLOORS.length - level) * ROW_H;
const attachY = (level: number) => rowTop(level) + 52; // chỗ cành bám vào thân
const sideOf = (level: number): 1 | -1 => (level % 2 === 1 ? 1 : -1);
const pctX = (x: number) => `${(x / VB_W) * 100}%`;
const pctY = (y: number) => `${(y / VB_H) * 100}%`;

// Đường cong mượt đi qua các điểm
function smooth(pts: Pt[]): string {
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${r1(pts[i][0])} ${r1(pts[i][1])} ${r1(mx)} ${r1(my)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${r1(last[0])} ${r1(last[1])}`;
}
const joinPath = (a: Pt[], b: Pt[]) =>
  `${smooth(a)}${smooth(b.slice().reverse()).replace(/^M/, " L")} Z`;

// ----- Thân cây: to, hơi cong, thon dần lên ngọn, xòe rễ ở gốc -----
const trunkCx = (y: number) => 200 + 5 * Math.sin(y / 170);
const trunkHw = (y: number) => {
  const t = Math.min(1, Math.max(0, (y - TRUNK_TOP) / (GROUND_Y - TRUNK_TOP)));
  const flare = t > 0.9 ? 50 * Math.pow((t - 0.9) / 0.1, 2) : 0;
  return 54 + 18 * t + flare;
};
const TRUNK_YS: number[] = (() => {
  const a: number[] = [];
  for (let y = TRUNK_TOP; y < GROUND_Y; y += 40) a.push(y);
  a.push(GROUND_Y);
  return a;
})();
const edgeLine = (f: number): Pt[] =>
  TRUNK_YS.map((y) => [trunkCx(y) + f * trunkHw(y), y] as Pt);

const TRUNK_PATH = joinPath(edgeLine(-1), edgeLine(1));
const SHADE_PATH = joinPath(edgeLine(0.25), edgeLine(1)); // bên phải tối hơn
const LIGHT_PATH = joinPath(edgeLine(-1), edgeLine(-0.6)); // bên trái sáng hơn
const BARK_LINES = [-0.72, -0.4, -0.05, 0.3, 0.62, 0.86].map((f, i) => {
  const pts: Pt[] = [];
  for (let y = TRUNK_TOP + 14; y < GROUND_Y - 10; y += 34) {
    pts.push([trunkCx(y) + f * trunkHw(y) + 3 * Math.sin(y / 23 + i * 2.1), y]);
  }
  return smooth(pts);
});
const KNOTS = FLOORS.filter((f) => f.level >= 2).map((f) => {
  const y = rowTop(f.level) + 168;
  const side = f.level % 2 === 1 ? 1 : -1;
  return { x: r1(trunkCx(y) + side * 0.5 * trunkHw(y)), y };
});

// Dây dưa hấu quấn quanh thân
const VINE_PTS: Pt[] = (() => {
  const a: Pt[] = [];
  for (let y = TRUNK_TOP + 50; y < GROUND_Y - 40; y += 14) {
    a.push([trunkCx(y) + 0.8 * trunkHw(y) * Math.sin(y / 52), y]);
  }
  return a;
})();
const VINE_PATH = smooth(VINE_PTS);
const VINE_LEAVES = VINE_PTS.filter((_, i) => i % 6 === 3).map(([x, y], i) => ({
  x: r1(x),
  y,
  rot: i % 2 === 0 ? -35 : 215,
}));

// ----- Cành: dày ở gốc, thon dần ra ngọn -----
const BR_W0 = 22;
const BR_W1 = 6;

function branchGeometry(level: number) {
  const s = sideOf(level);
  const ay = attachY(level);
  const x0 = trunkCx(ay) + s * (trunkHw(ay) - 10);
  const p0: Pt = [x0, ay + 12];
  const p1: Pt = [x0 + s * 52, ay - 30];
  const p2: Pt = [200 + s * 188, ay - 14];
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
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
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

  // Vị trí treo của 3 quả: điểm trên cành gần x mong muốn nhất
  const hang: Pt[] = FRUIT_DX.map((dx) => {
    const target = 200 + s * dx;
    let best = 1;
    let bestD = Infinity;
    for (let i = 20; i <= 100; i++) {
      const t = i / 100;
      const d = Math.abs(at(t)[0] - target);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    const [x, y] = at(best);
    return [r1(x), r1(y + half(best) * 0.4)] as Pt;
  });

  // Cụm lá dọc cành, và một nhánh nhỏ bên kia thân cho cây đầy đặn
  const fol = (
    [
      [0.3, 1.2],
      [0.62, 1.35],
      [0.92, 1.1],
    ] as [number, number][]
  ).map(([t, sc]) => {
    const [x, y] = at(t);
    return { x: r1(x), y: r1(y - 17), sc };
  });
  const [bgx, bgy] = at(0.2);
  const oy = ay + 60;
  const ox = trunkCx(oy) - s * (trunkHw(oy) - 6);
  return {
    s,
    ay,
    shape: `${smooth(top)}${smooth(bot.slice().reverse()).replace(/^M/, " L")} Z`,
    highlight: smooth(mid),
    hang,
    bug: [r1(bgx), r1(bgy - 20)] as Pt,
    fol,
    twig: `M${r1(ox)} ${r1(oy)} Q${r1(ox - s * 18)} ${r1(oy - 14)} ${r1(ox - s * 36)} ${r1(oy - 8)}`,
    twigFol: { x: r1(ox - s * 40), y: r1(oy - 16), sc: 1.0 },
  };
}
const GEOM = FLOORS.map((f) => branchGeometry(f.level));

const LEAF = "M0 0 C6 -11 20 -13 30 0 C20 13 6 11 0 0Z";

// Cụm lá hoạt hình: ba lớp tròn đậm, vừa, sáng
const FOL_BLOBS: [number, number, number][] = [
  [0, 0, 15],
  [-16, 6, 12],
  [15, 6, 13],
  [-7, -12, 12],
  [10, -10, 11],
];

// Tán cây khổng lồ trên đỉnh
const CANOPY: [number, number, number][] = [
  [110, 112, 46],
  [150, 72, 48],
  [200, 52, 50],
  [250, 72, 48],
  [290, 112, 46],
  [130, 152, 36],
  [270, 152, 36],
  [172, 124, 42],
  [228, 124, 42],
  [200, 156, 38],
  [96, 142, 30],
  [304, 142, 30],
];

// Sao trên trời: tạo cố định để máy chủ và trình duyệt vẽ giống nhau
const STARS = (() => {
  const out: { x: number; y: number; r: number; d: number }[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 38; i++) {
    out.push({ x: r1(8 + rnd() * 384), y: r1(8 + rnd() * 330), r: r1(0.8 + rnd() * 1.6), d: r1(rnd() * 4) });
  }
  return out;
})();

const BACK_CLOUDS = [
  { x: 55, y: 440, d: "0s", sc: 1.3 },
  { x: 335, y: 660, d: "-9s", sc: 1.1 },
  { x: 60, y: 1000, d: "-4s", sc: 1.3 },
  { x: 340, y: 1290, d: "-14s", sc: 1.2 },
  { x: 60, y: 1520, d: "-7s", sc: 1.1 },
];
// Mây bay ngang thân, nằm ở khoảng trống giữa các cành
const FRONT_CLOUDS = FLOORS.filter((f) => f.level >= 2 && f.level <= 8).map((f) => ({
  x: f.level % 2 === 1 ? 52 : 348,
  y: rowTop(f.level) + 140,
  d: `${-f.level * 3}s`,
  sc: 0.9 + (f.level % 3) * 0.15,
}));

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

function Foliage({ x, y, sc, delay }: { x: number; y: number; sc: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${sc})`}>
      <g className="wm-pop" style={{ "--fd": `${delay}s` } as React.CSSProperties}>
        <g className="wm-foliage">
          {FOL_BLOBS.map(([cx, cy, r], i) => (
            <circle key={`d${i}`} cx={cx} cy={cy + 2} r={r} className="wm-fl-d" />
          ))}
          {FOL_BLOBS.map(([cx, cy, r], i) => (
            <circle key={`m${i}`} cx={cx - 1} cy={cy - 1} r={r * 0.82} className="wm-fl-m" />
          ))}
          {FOL_BLOBS.slice(0, 3).map(([cx, cy, r], i) => (
            <circle key={`l${i}`} cx={cx - 4} cy={cy - 6} r={r * 0.38} className="wm-fl-l" />
          ))}
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
  opacity = 0.8,
}: {
  x: number;
  y: number;
  sc: number;
  d: string;
  opacity?: number;
}) {
  return (
    <g className="wm-cloud" style={{ "--cd": d } as React.CSSProperties}>
      <g transform={`translate(${x} ${y}) scale(${sc})`} fill="#fff" opacity={opacity}>
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

  const missions: Mission[] = data
    ? [
        { key: "new", hanzi: "词", title: "Học từ mới", href: "/review", value: data.newToday, target: data.newTarget, unit: "từ" },
        { key: "review", hanzi: "忆", title: "Chấm thẻ ôn", href: "/review", value: data.reviewToday, target: REVIEW_TARGET, unit: "lượt" },
        { key: "listen", hanzi: "听", title: "Nghe", href: "/listen", value: data.listenToday, target: LISTEN_TARGET, unit: "lượt" },
        { key: "speak", hanzi: "说", title: "Nói", href: "/speak", value: data.speakToday, target: SPEAK_TARGET, unit: "lần đọc" },
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
  for (const f of floors) {
    if (f.total === 0) continue;
    for (let k = 0; k < FRUITS_PER_BRANCH; k++) {
      if (f.learned >= f.targets[k] && !picked.has(`${f.level}-${k}`)) ripeWaiting++;
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

  const goCurrent = () => {
    document
      .getElementById(`wm-floor-${current}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
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

      {/* ===== Cây Dưa Hấu cổ thụ ===== */}
      <section className="space-y-3">
        <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Cây Dưa Hấu cổ thụ · HSK 3.0
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

        <div className="relative mx-auto max-w-[620px]">
          <div
            className="wm-tree relative overflow-hidden rounded-3xl border border-white/80 shadow-[0_20px_60px_rgb(120,40,90,0.25)]"
            style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
          >
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label="Cây dưa hấu cổ thụ, mỗi tầng là một cành có ba quả dưa"
            >
              {/* Trời: sao, trăng, mây phía sau */}
              {STARS.map((st, i) => (
                <circle
                  key={i}
                  cx={st.x}
                  cy={st.y}
                  r={st.r}
                  fill="#fff"
                  className="wm-star"
                  style={{ "--sd": `${st.d}s` } as React.CSSProperties}
                />
              ))}
              <circle cx="46" cy="70" r="32" fill="#fff4c9" opacity="0.14" />
              <circle cx="46" cy="70" r="20" fill="#fff4c9" />
              <circle cx="40" cy="64" r="4" fill="#f0e3a8" />
              <circle cx="53" cy="76" r="3" fill="#f0e3a8" />
              {BACK_CLOUDS.map((c, i) => (
                <Cloud key={i} x={c.x} y={c.y} sc={c.sc} d={c.d} />
              ))}

              {/* Đảo nổi */}
              <path
                d={`M20 ${GROUND_Y} C34 ${GROUND_Y + 62} 130 ${GROUND_Y + 104} 200 ${GROUND_Y + 122} C270 ${GROUND_Y + 104} 366 ${GROUND_Y + 62} 380 ${GROUND_Y} Z`}
                fill="#8a5a34"
                stroke="#3d2412"
                strokeWidth="2.5"
              />
              <path d={`M56 ${GROUND_Y + 26} Q200 ${GROUND_Y + 56} 344 ${GROUND_Y + 26}`} fill="none" stroke="#6b4226" strokeWidth="3" opacity="0.6" strokeLinecap="round" />
              <path d={`M92 ${GROUND_Y + 56} Q200 ${GROUND_Y + 82} 308 ${GROUND_Y + 56}`} fill="none" stroke="#6b4226" strokeWidth="3" opacity="0.6" strokeLinecap="round" />
              {[
                [150, 86],
                [200, 108],
                [252, 88],
              ].map(([x, y], i) => (
                <path
                  key={i}
                  d={`M${x} ${GROUND_Y + y} q${i === 1 ? 4 : -6} 18 ${i === 1 ? -2 : 3} 32`}
                  fill="none"
                  stroke="#5a3a1e"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              ))}
              <path
                d={`M14 ${GROUND_Y + 2} C70 ${GROUND_Y - 30} 330 ${GROUND_Y - 30} 386 ${GROUND_Y + 2} C384 ${GROUND_Y + 18} 300 ${GROUND_Y + 26} 200 ${GROUND_Y + 26} C100 ${GROUND_Y + 26} 16 ${GROUND_Y + 18} 14 ${GROUND_Y + 2} Z`}
                fill="#58b947"
                stroke="#2c7a34"
                strokeWidth="2.5"
              />
              <path d={`M40 ${GROUND_Y - 4} C100 ${GROUND_Y - 24} 300 ${GROUND_Y - 24} 360 ${GROUND_Y - 4}`} fill="none" stroke="#9be476" strokeWidth="4" opacity="0.7" strokeLinecap="round" />

              {/* Từng cành = từng tầng */}
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
                    <path d={g.twig} fill="none" strokeWidth="7" strokeLinecap="round" className="wm-twig" />
                    <Foliage x={g.twigFol.x} y={g.twigFol.y} sc={g.twigFol.sc} delay={d + 0.8} />
                    <path d={g.shape} strokeWidth="2.5" strokeLinejoin="round" className={`wm-bark ${ext}`} />
                    <path d={g.highlight} fill="none" strokeWidth="3" strokeLinecap="round" className={`wm-bark-hl ${ext}`} />
                    {g.fol.map((fo, i) => (
                      <Foliage key={i} x={fo.x} y={fo.y} sc={fo.sc} delay={d + 0.6 + i * 0.12} />
                    ))}
                  </g>
                );
              })}

              {/* Thân cổ thụ */}
              <path d={TRUNK_PATH} fill="#8a5a34" />
              <path d={LIGHT_PATH} fill="#c08a58" opacity="0.5" />
              <path d={SHADE_PATH} fill="#5e3b20" opacity="0.5" />
              {BARK_LINES.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="#3d2412"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  opacity={0.28 + (i % 3) * 0.08}
                  strokeDasharray={i % 2 === 1 ? "46 16" : undefined}
                />
              ))}
              <path d={TRUNK_PATH} fill="none" stroke="#3d2412" strokeWidth="3" strokeLinejoin="round" />
              {KNOTS.map((k, i) => (
                <g key={i}>
                  <ellipse cx={k.x} cy={k.y} rx="12" ry="15" fill="none" stroke="#6b4226" strokeWidth="2" />
                  <ellipse cx={k.x} cy={k.y} rx="9" ry="12" fill="#4a2c15" />
                  <ellipse cx={k.x} cy={k.y} rx="5" ry="7" fill="#2e1a0a" />
                </g>
              ))}
              {/* Dây dưa hấu quấn thân */}
              <path d={VINE_PATH} fill="none" stroke="#1f6e35" strokeWidth="6" strokeLinecap="round" />
              <path d={VINE_PATH} fill="none" stroke="#5cc46a" strokeWidth="2.6" strokeLinecap="round" />
              {VINE_LEAVES.map((l, i) => (
                <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(0.6)`}>
                  <path d={LEAF} fill="#43b35b" stroke="#1f6e35" strokeWidth="1.5" />
                </g>
              ))}
              {/* Bụi cỏ ở gốc */}
              {[96, 140, 172, 228, 260, 304].map((x, i) => (
                <circle key={i} cx={x} cy={GROUND_Y + 4} r={i % 2 === 0 ? 10 : 8} fill="#58b947" stroke="#2c7a34" strokeWidth="2" />
              ))}

              {/* Tán cây khổng lồ */}
              {CANOPY.map(([cx, cy, r], i) => (
                <circle key={`cd${i}`} cx={cx} cy={cy} r={r} className="wm-fl-d" />
              ))}
              {CANOPY.map(([cx, cy, r], i) => (
                <circle key={`cm${i}`} cx={cx - 3} cy={cy - 4} r={r * 0.84} className="wm-fl-m" />
              ))}
              {CANOPY.slice(0, 6).map(([cx, cy, r], i) => (
                <circle key={`cl${i}`} cx={cx - 12} cy={cy - 16} r={r * 0.3} className="wm-fl-l" />
              ))}

              {/* Quả dưa khổng lồ nằm giữa tán */}
              <g transform="translate(200 106) scale(0.92)">
                {crownReady && (
                  <g className="wm-rays">
                    {Array.from({ length: 12 }, (_, i) => (
                      <rect key={i} x="-2" y="-78" width="4" height="16" rx="2" fill="#ffd24d" transform={`rotate(${i * 30})`} />
                    ))}
                  </g>
                )}
                <g className="wm-crown">
                  <circle r="50" fill={crownReady ? "#2f9e44" : "#7fa97f"} stroke="#1f6e35" strokeWidth="2.5" />
                  {crownReady ? (
                    <>
                      <circle r="43" fill="#eaf8d3" />
                      <circle r="38" fill="#ff4d6a" />
                      {[
                        [-14, -8, -20],
                        [14, -8, 20],
                        [0, 8, 0],
                        [-22, 10, -35],
                        [22, 10, 35],
                        [-9, 24, -10],
                        [9, 24, 10],
                      ].map(([x, y, r], i) => (
                        <ellipse key={i} cx={x} cy={y} rx="3.2" ry="5" fill="#2b1b1b" transform={`rotate(${r} ${x} ${y})`} />
                      ))}
                      <path d="M-30 -22 Q-20 -34 -6 -34" stroke="#fff" strokeWidth="4" opacity="0.55" fill="none" strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      <path d="M-34 -30 Q-16 0 -34 30" stroke="#4f7d52" strokeWidth="5" opacity="0.7" fill="none" strokeLinecap="round" />
                      <path d="M-14 -46 Q2 0 -14 46" stroke="#4f7d52" strokeWidth="5" opacity="0.7" fill="none" strokeLinecap="round" />
                      <path d="M14 -46 Q-2 0 14 46" stroke="#4f7d52" strokeWidth="5" opacity="0.7" fill="none" strokeLinecap="round" />
                      <path d="M34 -30 Q16 0 34 30" stroke="#4f7d52" strokeWidth="5" opacity="0.7" fill="none" strokeLinecap="round" />
                    </>
                  )}
                </g>
              </g>

              {/* Mây bay ngang thân và biển mây dưới đảo */}
              {FRONT_CLOUDS.map((c, i) => (
                <Cloud key={i} x={c.x} y={c.y} sc={c.sc} d={c.d} opacity={0.92} />
              ))}
              <g className="wm-cloud" style={{ "--cd": "-5s" } as React.CSSProperties}>
                {Array.from({ length: 11 }, (_, i) => (
                  <circle key={i} cx={-20 + i * 44} cy={VB_H - 62 + (i % 2) * 10} r="44" fill="#dff1ff" />
                ))}
              </g>
              <g className="wm-cloud" style={{ "--cd": "-12s" } as React.CSSProperties}>
                {Array.from({ length: 11 }, (_, i) => (
                  <circle key={i} cx={-10 + i * 42} cy={VB_H - 36 + (i % 2) * 8} r="40" fill="#fff" />
                ))}
              </g>
              <rect x="-40" y={VB_H - 30} width="480" height="40" fill="#fff" />
            </svg>

            {/* Lớp chạm: biển gỗ tên tầng gắn trên thân, quả dưa, bọ rùa */}
            {FLOORS.map((def) => {
              const f = floors[def.level - 1];
              const g = GEOM[def.level - 1];
              const empty = !loading && f.total === 0;
              const locked = loading || empty || !f.unlocked;
              const isCurrent = !loading && def.level === current;
              const d = (def.level - 1) * 0.14;
              const top = rowTop(def.level);
              const cx = trunkCx(top + 100);
              return (
                <div key={def.level} className="contents">
                  <button
                    type="button"
                    id={`wm-floor-${def.level}`}
                    onClick={() => setSelected({ level: def.level, fruit: null })}
                    className={`wm-label rounded-xl border-2 bg-[#fff8ea]/95 p-1.5 shadow-[0_5px_14px_rgb(60,30,10,0.35)] ${
                      isCurrent ? "border-rose-500 ring-4 ring-rose-400/35" : "border-[#8a5a34]"
                    } ${locked ? "opacity-90" : ""}`}
                    style={
                      {
                        left: pctX(cx),
                        top: pctY(top + 66),
                        "--d": `${d}s`,
                      } as React.CSSProperties
                    }
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${def.grad} text-[11px] font-extrabold text-white ${
                          locked ? "grayscale" : ""
                        }`}
                      >
                        {locked ? "🔒" : def.level}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[8px] font-bold uppercase leading-none tracking-wider text-[#a0622f]">
                          Tầng {def.level}
                        </span>
                        <span className="block truncate text-[11.5px] font-bold leading-tight text-[#3d2412]">
                          {def.name}
                        </span>
                      </span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#e6d3b3]">
                      <span
                        className={`block h-full rounded-full bg-gradient-to-r ${def.grad} transition-[width] duration-700`}
                        style={{ width: `${Math.round(f.pct * 100)}%` }}
                      />
                    </span>
                    <span className="mt-0.5 flex items-center justify-between text-[9px] font-medium text-[#7a5a3a]">
                      <span>{loading ? "..." : empty ? "Đang ươm" : `${f.learned}/${f.total}`}</span>
                      <span>🍉{f.stars}/3</span>
                    </span>
                    {isCurrent && (
                      <span className="absolute -right-1.5 -top-3 whitespace-nowrap rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-bold text-white shadow">
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
            <div className="wm-sheet sticky bottom-3 z-30 mt-3 rounded-3xl border border-rose-100 bg-white/95 p-4 shadow-[0_-10px_40px_rgb(229,51,79,0.2)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
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
                  Cành này đang ươm: chưa có từ nào ở cấp này trong dữ liệu HSK 3.0 hiện tại.
                </p>
              ) : !sel.unlocked ? (
                <p className="mt-3 text-sm text-stone-600">
                  Hái ít nhất 1 quả chín ở tầng {selDef.level - 1} để mở cành này.
                </p>
              ) : (
                <>
                  <ul className="mt-3 space-y-1.5">
                    {sel.targets.map((t, k) => {
                      const ripe = sel.learned >= t;
                      const isPicked = picked.has(`${sel.level}-${k}`);
                      const focus = selected.fruit === k;
                      return (
                        <li
                          key={k}
                          className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
                            focus ? "bg-rose-50 ring-2 ring-rose-200" : "bg-stone-50"
                          }`}
                        >
                          <span>🍉 Quả {k + 1}</span>
                          <span className={ripe ? "font-semibold text-emerald-700" : "text-stone-600"}>
                            {isPicked
                              ? "Đã hái ✓"
                              : ripe
                                ? "Chín rồi, chạm để hái!"
                                : `Cần thuộc ${t} từ · còn ${t - sel.learned}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-stone-500">
                    Đã có thẻ {sel.cards} từ · đã thuộc {sel.learned}/{sel.total} từ · mốc{" "}
                    {sel.milestonesDone}/{sel.milestonesTotal} (mỗi mốc {MILESTONE_SIZE} từ).
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
