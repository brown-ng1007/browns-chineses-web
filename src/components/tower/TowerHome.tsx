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

// ===== Hình học của cây (đơn vị viewBox; cây co giãn theo bề ngang màn hình) =====
const VB_W = 400;
const ROW_H = 170; // chiều cao mỗi tầng (cành)
const TOP_H = 170; // phần trời phía trên có quả dưa khổng lồ
const GROUND_H = 120; // phần đất phía dưới
const VB_H = TOP_H + FLOORS.length * ROW_H + GROUND_H;
const TRUNK_X = 200;
const TRUNK_TOP = TOP_H - 40;
const GROUND_Y = VB_H - GROUND_H + 14;

const rowTop = (level: number) => TOP_H + (FLOORS.length - level) * ROW_H;
const attachY = (level: number) => rowTop(level) + 92; // chỗ cành bám vào thân
const sideOf = (level: number): 1 | -1 => (level % 2 === 1 ? 1 : -1);
const pctX = (x: number) => `${(x / VB_W) * 100}%`;
const pctY = (y: number) => `${(y / VB_H) * 100}%`;

// Vị trí 3 quả dọc theo cành (tính từ điểm bám vào thân)
const FRUIT_POS = [
  { dx: 53, dy: -4 },
  { dx: 91, dy: -8 },
  { dx: 132, dy: -7 },
];
const FRUIT_CENTER_Y = 31; // tâm quả tính từ điểm treo

const TRUNK_PATH = `M186 ${TRUNK_TOP} C186 ${TRUNK_TOP + 520} 178 ${GROUND_Y - 520} 163 ${GROUND_Y} L237 ${GROUND_Y} C222 ${GROUND_Y - 520} 214 ${TRUNK_TOP + 520} 214 ${TRUNK_TOP} Z`;
const TRUNK_STRIPES = [-1, -0.5, 0, 0.5, 1].map(
  (a) =>
    `M${TRUNK_X + a * 9} ${TRUNK_TOP} C${TRUNK_X + a * 9} ${TRUNK_TOP + 520} ${
      TRUNK_X + a * 15
    } ${GROUND_Y - 520} ${TRUNK_X + a * 28} ${GROUND_Y}`
);
const LEAF = "M0 0 C6 -11 20 -13 30 0 C20 13 6 11 0 0Z";

// Sao trên trời: tạo cố định để máy chủ và trình duyệt vẽ giống nhau
const STARS = (() => {
  const out: { x: number; y: number; r: number; d: number }[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 38; i++) {
    out.push({ x: 8 + rnd() * 384, y: 8 + rnd() * 330, r: 0.8 + rnd() * 1.6, d: rnd() * 4 });
  }
  return out;
})();

const CLOUDS = [
  { x: 70, y: 380, d: "0s" },
  { x: 300, y: 690, d: "-9s" },
  { x: 110, y: 1060, d: "-4s" },
  { x: 310, y: 1330, d: "-14s" },
];

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

function branchGeometry(level: number) {
  const s = sideOf(level);
  const ay = attachY(level);
  const tipX = TRUNK_X + s * 150;
  const tipY = ay - 6;
  return {
    s,
    ay,
    path: `M${TRUNK_X} ${ay + 10} Q${TRUNK_X + s * 60} ${ay - 14} ${tipX} ${tipY}`,
    tendril: `M${tipX} ${tipY} c ${s * 10} -4 ${s * 14} 6 ${s * 6} 11 c ${-s * 5} 4 ${-s * 10} -2 ${-s * 6} -6`,
    leaves: [
      { x: TRUNK_X + s * 48, y: ay - 3, rot: s > 0 ? -55 : -125, sc: 1, v: 1 },
      { x: TRUNK_X + s * 108, y: ay - 8, rot: s > 0 ? -35 : -145, sc: 0.9, v: 2 },
      { x: tipX, y: tipY, rot: s > 0 ? -8 : -172, sc: 0.8, v: 1 },
    ],
  };
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

      {/* ===== Cây Dưa Hấu khổng lồ ===== */}
      <section className="space-y-3">
        <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Cây Dưa Hấu khổng lồ · HSK 3.0
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
              aria-label="Cây dưa hấu khổng lồ, mỗi tầng là một cành có ba quả dưa"
            >
              {/* Trời: sao, trăng, mây */}
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
              <circle cx="58" cy="66" r="32" fill="#fff4c9" opacity="0.14" />
              <circle cx="58" cy="66" r="20" fill="#fff4c9" />
              <circle cx="52" cy="60" r="4" fill="#f0e3a8" />
              <circle cx="65" cy="72" r="3" fill="#f0e3a8" />
              {CLOUDS.map((c, i) => (
                <g key={i} className="wm-cloud" style={{ "--cd": c.d } as React.CSSProperties}>
                  <g transform={`translate(${c.x} ${c.y})`} fill="#fff" opacity="0.78">
                    <ellipse cx="0" cy="0" rx="28" ry="10" />
                    <ellipse cx="-16" cy="-5" rx="14" ry="9" />
                    <ellipse cx="12" cy="-8" rx="16" ry="11" />
                  </g>
                </g>
              ))}

              {/* Đất và rễ */}
              <path
                d={`M0 ${GROUND_Y - 10} Q100 ${GROUND_Y - 34} 200 ${GROUND_Y - 12} T400 ${GROUND_Y - 16} L400 ${VB_H} L0 ${VB_H} Z`}
                fill="#6cc04a"
              />
              <rect x="0" y={GROUND_Y + 10} width={VB_W} height={VB_H - GROUND_Y - 10} fill="#7a5230" />
              <rect x="0" y={GROUND_Y + 10} width={VB_W} height="8" fill="#8b6239" opacity="0.7" />
              {[
                `M166 ${GROUND_Y} C150 ${GROUND_Y + 8} 128 ${GROUND_Y + 6} 104 ${GROUND_Y + 26}`,
                `M234 ${GROUND_Y} C252 ${GROUND_Y + 8} 274 ${GROUND_Y + 6} 298 ${GROUND_Y + 26}`,
                `M190 ${GROUND_Y} C186 ${GROUND_Y + 20} 176 ${GROUND_Y + 30} 168 ${GROUND_Y + 50}`,
                `M212 ${GROUND_Y} C216 ${GROUND_Y + 20} 226 ${GROUND_Y + 30} 236 ${GROUND_Y + 50}`,
              ].map((d, i) => (
                <path key={i} d={d} fill="none" stroke="#5a3a1e" strokeWidth="5" strokeLinecap="round" />
              ))}
              {[
                [60, 52, -20],
                [330, 60, 25],
                [120, 80, 10],
                [290, 84, -15],
              ].map(([x, y, r], i) => (
                <ellipse
                  key={i}
                  cx={x}
                  cy={GROUND_Y + y}
                  rx="4.5"
                  ry="2.6"
                  fill="#2b1b1b"
                  transform={`rotate(${r} ${x} ${GROUND_Y + y})`}
                />
              ))}

              {/* Từng cành = từng tầng */}
              {FLOORS.map((def) => {
                const f = floors[def.level - 1];
                const g = branchGeometry(def.level);
                const locked = loading || f.total === 0 || !f.unlocked;
                const d = (def.level - 1) * 0.14;
                return (
                  <g
                    key={def.level}
                    className={locked ? "wm-locked" : undefined}
                    style={{ "--d": `${d}s` } as React.CSSProperties}
                  >
                    <path d={g.path} pathLength={1} fill="none" strokeWidth="18" strokeLinecap="round" className="wm-vine wm-vine-a" />
                    <path d={g.path} pathLength={1} fill="none" strokeWidth="11" strokeLinecap="round" className="wm-vine wm-vine-b" />
                    <path d={g.tendril} fill="none" strokeWidth="2.2" strokeLinecap="round" className="wm-tendril" />
                    {g.leaves.map((lf, i) => (
                      <g key={i} transform={`translate(${lf.x} ${lf.y}) rotate(${lf.rot}) scale(${lf.sc})`}>
                        <path
                          d={LEAF}
                          className={`wm-leaf ${lf.v === 2 ? "wm-leaf-2" : ""}`}
                          style={{ "--d": `${d + i * 0.12}s` } as React.CSSProperties}
                        />
                      </g>
                    ))}
                  </g>
                );
              })}

              {/* Thân cây sọc như vỏ dưa */}
              <path d={TRUNK_PATH} fill="#4fae5e" stroke="#2e7d32" strokeWidth="1.5" />
              {TRUNK_STRIPES.map((d, i) => (
                <path key={i} d={d} fill="none" stroke="#1b6b34" strokeWidth="3" opacity="0.45" strokeLinecap="round" />
              ))}
              <path
                d={`M192 ${TRUNK_TOP + 20} C191 ${TRUNK_TOP + 520} 184 ${GROUND_Y - 520} 175 ${GROUND_Y - 20}`}
                fill="none"
                stroke="#b9f0b5"
                strokeWidth="3"
                opacity="0.5"
                strokeLinecap="round"
              />

              {/* Quả dưa khổng lồ trên đỉnh */}
              <g transform={`translate(${TRUNK_X} 82)`}>
                {crownReady && (
                  <g className="wm-rays">
                    {Array.from({ length: 12 }, (_, i) => (
                      <rect key={i} x="-2" y="-78" width="4" height="16" rx="2" fill="#ffd24d" transform={`rotate(${i * 30})`} />
                    ))}
                  </g>
                )}
                <g className="wm-crown">
                  <circle r="50" fill={crownReady ? "#2f9e44" : "#7fa97f"} />
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
            </svg>

            {/* Lớp chạm: thẻ tên tầng, quả dưa, bọ rùa */}
            {FLOORS.map((def) => {
              const f = floors[def.level - 1];
              const g = branchGeometry(def.level);
              const s = g.s;
              const empty = !loading && f.total === 0;
              const locked = loading || empty || !f.unlocked;
              const isCurrent = !loading && def.level === current;
              const d = (def.level - 1) * 0.14;
              return (
                <div key={def.level} className="contents">
                  <button
                    type="button"
                    id={`wm-floor-${def.level}`}
                    onClick={() => setSelected({ level: def.level, fruit: null })}
                    className={`wm-label rounded-2xl border bg-white/90 p-2 shadow-[0_6px_18px_rgb(60,20,80,0.18)] backdrop-blur-md ${
                      isCurrent ? "border-rose-400 ring-4 ring-rose-400/25" : "border-white/90"
                    } ${locked ? "opacity-85" : ""}`}
                    style={
                      {
                        left: pctX(s > 0 ? 4 : 240),
                        top: pctY(rowTop(def.level) + 44),
                        "--d": `${d}s`,
                      } as React.CSSProperties
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${def.grad} text-[13px] font-extrabold text-white ${
                          locked ? "grayscale" : ""
                        }`}
                      >
                        {locked ? "🔒" : def.level}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[9px] font-bold uppercase leading-none tracking-wider text-rose-400">
                          Tầng {def.level}
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] font-bold leading-tight text-stone-900">
                          {def.name}
                        </span>
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-stone-200/80">
                      <span
                        className={`block h-full rounded-full bg-gradient-to-r ${def.grad} transition-[width] duration-700`}
                        style={{ width: `${Math.round(f.pct * 100)}%` }}
                      />
                    </span>
                    <span className="mt-1 flex items-center justify-between text-[10px] text-stone-500">
                      <span>{loading ? "..." : empty ? "Đang ươm" : `${f.learned}/${f.total} từ`}</span>
                      <span>🍉 {f.stars}/3</span>
                    </span>
                    {isCurrent && (
                      <span className="absolute -top-2 right-2 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-bold text-white shadow">
                        Đang leo
                      </span>
                    )}
                  </button>

                  {FRUIT_POS.map((p, k) => {
                    const key = `${def.level}-${k}`;
                    const state = fruitState(f, k, picked, locked);
                    const fx = TRUNK_X + s * p.dx;
                    const by = g.ay + p.dy;
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
                      style={{ left: pctX(TRUNK_X), top: pctY(g.ay + 2) }}
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
