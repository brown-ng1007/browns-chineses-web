"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { refreshSettings } from "@/lib/settings";
import Watermelon from "@/components/Watermelon";
import {
  FLOORS,
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

export default function TowerHome() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<TowerData | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [open, setOpen] = useState<number | null>(null);

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

      {/* ===== Tháp 9 tầng ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400">
            Tháp Dưa Hấu · HSK 3.0
          </h2>
          <span className="text-xs font-medium text-emerald-700/70">
            {data ? `Đang ở tầng ${current}` : ""}
          </span>
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

        {/* Đỉnh tháp */}
        <div className="flex justify-center -mb-1">
          <Watermelon
            className={`hero-slice w-20 h-auto drop-shadow-md ${
              data && floors[8].stars === 3 ? "" : "opacity-70"
            }`}
          />
        </div>

        <div className="space-y-2">
          {[...FLOORS].reverse().map((def) => {
            const f = floors[def.level - 1];
            const isCurrent = data !== null && def.level === current;
            const locked = data !== null && !f.unlocked;
            const isOpen = open === def.level;
            const width = 100 - (def.level - 1) * 2.4;

            return (
              <div
                key={def.level}
                className="rise mx-auto"
                style={
                  {
                    width: `${width}%`,
                    "--i": def.level,
                  } as React.CSSProperties
                }
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : def.level)}
                  aria-expanded={isOpen}
                  className={`w-full text-left rounded-2xl bg-white/85 backdrop-blur-xl border p-3 sm:p-3.5 shadow-[0_6px_20px_rgb(229,51,79,0.07)] transition-all duration-300 ${
                    isCurrent
                      ? "border-rose-300 ring-4 ring-rose-400/15"
                      : "border-white/90"
                  } ${locked ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${def.grad} text-white flex items-center justify-center text-lg font-extrabold shadow-md shadow-stone-900/10 ${
                        locked ? "grayscale" : ""
                      }`}
                    >
                      {locked ? "🔒" : def.level}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-sm sm:text-base font-bold text-stone-900 truncate">
                            Tầng {def.level} · {def.name}
                          </span>
                          {isCurrent && (
                            <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                              Đang leo
                            </span>
                          )}
                        </span>
                        <Stars n={f.stars} />
                      </span>
                      <span className="mt-1.5 block h-2 rounded-full bg-stone-200/70 overflow-hidden">
                        <span
                          className={`block h-full rounded-full bg-gradient-to-r ${def.grad} transition-[width] duration-700`}
                          style={{ width: `${Math.round(f.pct * 100)}%` }}
                        />
                      </span>
                      <span className="mt-1 block text-[11px] text-stone-500">
                        {data
                          ? `${f.learned}/${f.total} từ đã thuộc · mốc ${f.milestonesDone}/${f.milestonesTotal}`
                          : "..."}
                      </span>
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="anim-fade-in mt-1.5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/90 p-4 text-sm text-stone-700 space-y-3">
                    {locked ? (
                      <p>
                        Đạt ít nhất 1 sao ở tầng {def.level - 1} để mở tầng này.
                      </p>
                    ) : (
                      <>
                        <ul className="space-y-1 text-stone-600">
                          <li>
                            Đã có thẻ: <b className="text-stone-900">{f.cards}</b> từ
                          </li>
                          <li>
                            Đã thuộc: <b className="text-stone-900">{f.learned}</b>/{f.total} từ
                            ({Math.round(f.pct * 100)}%)
                          </li>
                          <li>
                            Mỗi mốc gồm {MILESTONE_SIZE} từ. Đã qua{" "}
                            <b className="text-stone-900">{f.milestonesDone}</b>/
                            {f.milestonesTotal} mốc.
                          </li>
                          <li className="text-xs text-stone-500">
                            Sao: ★ từ 25% · ★★ từ 50% · ★★★ từ 80% số từ đã thuộc.
                          </li>
                        </ul>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href="/review"
                            className="rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-rose-500/25"
                          >
                            Ôn thẻ
                          </Link>
                          <Link
                            href="/vocab"
                            className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
                          >
                            Xem từ vựng
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mặt đất */}
        <div aria-hidden="true" className="mx-auto h-2.5 w-full rounded-full bg-gradient-to-r from-emerald-700/70 via-emerald-500/70 to-emerald-700/70" />
      </section>
    </div>
  );
}
