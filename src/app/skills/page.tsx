"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SrsState, ViVerdict } from "@/types/database.types";

const PAGE_ROWS = 1000;
const MAX_PAGES = 10;
const SOLID_STABILITY_DAYS = 21; // thẻ "vững": đang ở trạng thái ôn và nhớ được >= 21 ngày

interface CardRow {
  id: string;
  word_id: string;
  state: SrsState;
  stability: number | string;
  reps: number;
  lapses: number;
}
interface LogRow {
  card_id: string;
  rating: number;
  reviewed_at: string;
  elapsed_seconds: number | null;
}
interface AttemptRow {
  verdict: ViVerdict;
  score: number;
  created_at: string;
}
interface WordLevelRow {
  id: string;
  hsk_new_level: number | null;
  hsk_old_level: number | null;
}
interface SkillLogRow {
  skill: string;
  minutes: number | string;
  accuracy: number | string | null;
  logged_on: string;
}
interface LevelPair {
  n: number | null;
  o: number | null;
}
interface Loaded {
  skillLogs: SkillLogRow[];
  cards: CardRow[];
  logs: LogRow[];
  attempts: AttemptRow[];
  levels: Map<string, LevelPair>;
  viSaved: number;
}

type PageResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

// Supabase chỉ trả tối đa ~1000 dòng mỗi lần, nên đọc theo từng trang
async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResult>
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_ROWS;
    const res = await build(from, from + PAGE_ROWS - 1);
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_ROWS) break;
  }
  return out;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

interface DayBar {
  key: string;
  label: string;
  good: number;
  bad: number;
}

function DailyBars({ days }: { days: DayBar[] }) {
  const max = Math.max(1, ...days.map((d) => d.good + d.bad));
  const slot = 300 / days.length;
  const barW = slot * 0.7;
  const baseY = 92;
  const maxH = 80;
  const every = days.length > 10 ? 5 : 1;

  return (
    <svg
      viewBox="0 0 300 112"
      className="w-full h-36"
      role="img"
      aria-label="Số lượt ôn mỗi ngày"
    >
      <line x1="0" y1={baseY} x2="300" y2={baseY} className="stroke-slate-200" />
      {days.map((d, i) => {
        const x = i * slot + (slot - barW) / 2;
        const hGood = (d.good / max) * maxH;
        const hBad = (d.bad / max) * maxH;
        return (
          <g key={d.key}>
            <rect
              x={x}
              y={baseY - hGood}
              width={barW}
              height={hGood}
              rx={1.5}
              className="fill-emerald-500"
            />
            <rect
              x={x}
              y={baseY - hGood - hBad}
              width={barW}
              height={hBad}
              rx={1.5}
              className="fill-rose-400"
            />
            {(i % every === 0 || i === days.length - 1) && (
              <text
                x={x + barW / 2}
                y={106}
                textAnchor="middle"
                className="fill-slate-500"
                style={{ fontSize: 8 }}
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Tile({
  value,
  label,
  tone = "slate",
}: {
  value: string;
  label: string;
  tone?: "slate" | "blue" | "emerald" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-50/80 border-slate-200/70 text-slate-800",
    blue: "bg-indigo-50/80 border-indigo-200/70 text-indigo-700",
    emerald: "bg-emerald-50/80 border-emerald-200/70 text-emerald-700",
    amber: "bg-amber-50/80 border-amber-200/70 text-amber-800",
  };
  return (
    <div className={`rounded-2xl border p-3.5 text-center ${tones[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5 opacity-90">{label}</div>
    </div>
  );
}

const STATE_LABEL: Record<SrsState, string> = {
  new: "Mới",
  learning: "Đang học",
  review: "Đang ôn",
  relearning: "Học lại",
};

export default function SkillsPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [period, setPeriod] = useState<7 | 30>(7);
  const [version, setVersion] = useState<"new" | "old">("new");

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - 29);
      const sinceIso = since.toISOString();

      const [cards, logs, attempts, viRes, skillLogs] = await Promise.all([
        fetchAllRows<CardRow>((from, to) =>
          supabase
            .from("srs_cards")
            .select("id, word_id, state, stability, reps, lapses")
            .is("deleted_at", null)
            .order("id")
            .range(from, to)
        ),
        fetchAllRows<LogRow>((from, to) =>
          supabase
            .from("review_logs")
            .select("card_id, rating, reviewed_at, elapsed_seconds")
            .is("deleted_at", null)
            .gte("reviewed_at", sinceIso)
            .order("reviewed_at")
            .order("id")
            .range(from, to)
        ),
        fetchAllRows<AttemptRow>((from, to) =>
          supabase
            .from("vi_attempts")
            .select("verdict, score, created_at")
            .is("deleted_at", null)
            .gte("created_at", sinceIso)
            .order("created_at")
            .order("id")
            .range(from, to)
        ),
        supabase
          .from("vi_user")
          .select("word_id", { count: "exact", head: true })
          .is("deleted_at", null),
        fetchAllRows<SkillLogRow>((from, to) =>
          supabase
            .from("skill_logs")
            .select("skill, minutes, accuracy, logged_on")
            .is("deleted_at", null)
            .gte("logged_on", dateKey(since))
            .order("logged_on")
            .order("id")
            .range(from, to)
        ).catch((): SkillLogRow[] => []),
      ]);

      if (viRes.error) throw new Error(viRes.error.message);

      // Cấp HSK của các từ đã có thẻ
      const levels = new Map<string, LevelPair>();
      const wordIds = Array.from(new Set(cards.map((c) => c.word_id)));
      const chunks: string[][] = [];
      for (let i = 0; i < wordIds.length; i += 100) {
        chunks.push(wordIds.slice(i, i + 100));
      }
      for (let i = 0; i < chunks.length; i += 4) {
        const group = chunks.slice(i, i + 4);
        const results = await Promise.all(
          group.map((chunk) =>
            supabase
              .from("words")
              .select("id, hsk_new_level, hsk_old_level")
              .in("id", chunk)
          )
        );
        for (const r of results) {
          if (r.error) throw new Error(r.error.message);
          for (const w of (r.data ?? []) as WordLevelRow[]) {
            levels.set(w.id, { n: w.hsk_new_level, o: w.hsk_old_level });
          }
        }
      }

      setData({
        skillLogs,
        cards,
        logs,
        attempts,
        levels,
        viSaved: viRes.count ?? 0,
      });
      setStatus("ready");
    } catch {
      setErrorMsg(
        "Chưa tải được số liệu. Cần có mạng; hãy thử lại sau ít giây."
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    if (!data) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (period - 1));
    const startMs = start.getTime();

    // Biểu đồ theo ngày
    const buckets = new Map<string, { good: number; bad: number }>();
    const days: DayBar[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      buckets.set(key, { good: 0, bad: 0 });
      days.push({
        key,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        good: 0,
        bad: 0,
      });
    }

    const logsIn = data.logs.filter(
      (l) => new Date(l.reviewed_at).getTime() >= startMs
    );
    let good = 0;
    let seconds = 0;
    const distinctCards = new Set<string>();
    for (const l of logsIn) {
      distinctCards.add(l.card_id);
      seconds += l.elapsed_seconds ?? 0;
      const isGood = l.rating >= 3;
      if (isGood) good++;
      const b = buckets.get(dateKey(new Date(l.reviewed_at)));
      if (b) {
        if (isGood) b.good++;
        else b.bad++;
      }
    }
    for (const d of days) {
      const b = buckets.get(d.key);
      if (b) {
        d.good = b.good;
        d.bad = b.bad;
      }
    }
    const activeDays = days.filter((d) => d.good + d.bad > 0).length;

    // Thẻ theo trạng thái và theo cấp HSK
    const stateCounts: Record<SrsState, number> = {
      new: 0,
      learning: 0,
      review: 0,
      relearning: 0,
    };
    const cardLevel = new Map<string, number | null>();
    const maxLevel = version === "new" ? 9 : 6;
    const levelStats = Array.from({ length: maxLevel }, (_, i) => ({
      level: i + 1,
      cards: 0,
      solid: 0,
      good: 0,
      total: 0,
    }));
    let solidTotal = 0;

    for (const c of data.cards) {
      stateCounts[c.state] = (stateCounts[c.state] ?? 0) + 1;
      const pair = data.levels.get(c.word_id);
      const lv = pair ? (version === "new" ? pair.n : pair.o) : null;
      cardLevel.set(c.id, lv);
      const isSolid = c.state === "review" && Number(c.stability) >= SOLID_STABILITY_DAYS;
      if (isSolid) solidTotal++;
      if (lv !== null && lv >= 1 && lv <= maxLevel) {
        levelStats[lv - 1].cards++;
        if (isSolid) levelStats[lv - 1].solid++;
      }
    }
    for (const l of logsIn) {
      const lv = cardLevel.get(l.card_id);
      if (lv !== null && lv !== undefined && lv >= 1 && lv <= maxLevel) {
        levelStats[lv - 1].total++;
        if (l.rating >= 3) levelStats[lv - 1].good++;
      }
    }

    // Luyện nghĩa Việt
    const attemptsIn = data.attempts.filter(
      (a) => new Date(a.created_at).getTime() >= startMs
    );
    const verdicts: Record<ViVerdict, number> = {
      correct: 0,
      close: 0,
      incorrect: 0,
    };
    let scoreSum = 0;
    for (const a of attemptsIn) {
      verdicts[a.verdict] = (verdicts[a.verdict] ?? 0) + 1;
      scoreSum += a.score;
    }

    const startKey = dateKey(start);
    const skillStat = (skill: "listening" | "speaking") => {
      const rows = data.skillLogs.filter(
        (r) => r.skill === skill && r.logged_on >= startKey
      );
      const minutes = rows.reduce((sum, r) => sum + Number(r.minutes), 0);
      const withAcc = rows.filter((r) => r.accuracy !== null);
      const accuracy =
        withAcc.length > 0
          ? Math.round(
              (withAcc.reduce((s, r) => s + Number(r.accuracy), 0) /
                withAcc.length) *
                100
            )
          : null;
      return {
        sessions: rows.length,
        minutes: Math.round(minutes * 10) / 10,
        accuracy,
      };
    };

    return {
      listening: skillStat("listening"),
      speaking: skillStat("speaking"),
      days,
      total: logsIn.length,
      good,
      distinct: distinctCards.size,
      seconds,
      activeDays,
      stateCounts,
      solidTotal,
      levelStats,
      attemptsTotal: attemptsIn.length,
      verdicts,
      avgScore: attemptsIn.length > 0 ? Math.round(scoreSum / attemptsIn.length) : 0,
    };
  }, [data, period, version]);

  const minutesLabel =
    stats === null
      ? "0"
      : stats.seconds > 0 && stats.seconds < 60
        ? "<1"
        : String(Math.round(stats.seconds / 60));

  return (
    <main className="space-y-4 pb-8">
      <section className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Kỹ năng</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Tiến độ học tính từ lịch sử ôn tập và luyện nghĩa Việt thật của bạn.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl bg-slate-100/80 p-1">
            {([7, 30] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                  period === p
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p} ngày
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-2xl bg-slate-100/80 p-1">
            {(["new", "old"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVersion(v)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                  version === v
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {v === "new" ? "HSK 3.0" : "HSK 2.0"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {status === "loading" && (
        <div className="p-8 text-center text-slate-500 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90">
          Đang tính số liệu...
        </div>
      )}

      {status === "error" && (
        <div className="rounded-3xl bg-red-50/90 backdrop-blur-xl border border-red-200 p-5 space-y-3">
          <p className="text-sm text-red-700">{errorMsg}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20"
          >
            Thử lại
          </button>
        </div>
      )}

      {status === "ready" && stats && (
        <>
          <section className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Ôn tập trong {period} ngày qua
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile value={String(stats.total)} label="Lượt ôn" tone="blue" />
              <Tile
                value={String(stats.distinct)}
                label="Từ đã ôn"
                tone="slate"
              />
              <Tile
                value={stats.total > 0 ? `${percent(stats.good, stats.total)}%` : "—"}
                label="Tỉ lệ nhớ (Được/Dễ)"
                tone="emerald"
              />
              <Tile
                value={minutesLabel}
                label={`Phút ôn · ${stats.activeDays}/${period} ngày có học`}
                tone="amber"
              />
            </div>

            {stats.total === 0 ? (
              <p className="text-sm text-slate-500">
                Chưa có lượt ôn nào trong {period} ngày qua. Vào tab Ôn tập để
                bắt đầu, biểu đồ sẽ hiện ở đây.
              </p>
            ) : (
              <div className="space-y-1.5">
                <DailyBars days={stats.days} />
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    Nhớ (Được/Dễ)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />
                    Quên/Khó
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Thẻ của bạn
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(Object.keys(STATE_LABEL) as SrsState[]).map((s) => (
                <Tile
                  key={s}
                  value={String(stats.stateCounts[s])}
                  label={STATE_LABEL[s]}
                />
              ))}
              <Tile
                value={String(stats.solidTotal)}
                label={`Vững (nhớ ≥ ${SOLID_STABILITY_DAYS} ngày)`}
                tone="emerald"
              />
            </div>
          </section>

          <section className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Theo cấp {version === "new" ? "HSK 3.0" : "HSK 2.0"}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1.5 pr-3 font-medium">Cấp</th>
                    <th className="py-1.5 pr-3 font-medium">Thẻ</th>
                    <th className="py-1.5 pr-3 font-medium">Vững</th>
                    <th className="py-1.5 font-medium">
                      Tỉ lệ nhớ ({period} ngày)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.levelStats.map((r) => {
                    const rate = percent(r.good, r.total);
                    return (
                      <tr
                        key={r.level}
                        className={`border-t border-slate-100 ${
                          r.cards === 0 ? "text-slate-400" : "text-slate-800"
                        }`}
                      >
                        <td className="py-2 pr-3 font-medium">HSK {r.level}</td>
                        <td className="py-2 pr-3">{r.cards}</td>
                        <td className="py-2 pr-3">{r.solid}</td>
                        <td className="py-2">
                          {r.total > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500"
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                              <span className="text-xs">
                                {rate}% ({r.total} lượt)
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Luyện nghĩa tiếng Việt
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <Tile
                value={String(stats.attemptsTotal)}
                label={`Lượt chấm (${period} ngày)`}
                tone="blue"
              />
              <Tile
                value={stats.attemptsTotal > 0 ? String(stats.avgScore) : "—"}
                label="Điểm trung bình"
                tone="emerald"
              />
              <Tile
                value={String(data?.viSaved ?? 0)}
                label="Từ đã lưu nghĩa Việt"
              />
            </div>
            {stats.attemptsTotal > 0 ? (
              <div className="space-y-1.5">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="bg-emerald-500"
                    style={{
                      width: `${percent(stats.verdicts.correct, stats.attemptsTotal)}%`,
                    }}
                  />
                  <div
                    className="bg-amber-400"
                    style={{
                      width: `${percent(stats.verdicts.close, stats.attemptsTotal)}%`,
                    }}
                  />
                  <div
                    className="bg-rose-400"
                    style={{
                      width: `${percent(stats.verdicts.incorrect, stats.attemptsTotal)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-600">
                  Đúng {stats.verdicts.correct} · Gần đúng {stats.verdicts.close}{" "}
                  · Sai {stats.verdicts.incorrect}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Chưa có lượt chấm nghĩa nào trong {period} ngày qua.
              </p>
            )}
          </section>

          <section className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Nghe và Nói
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <Tile
                value={String(stats.listening.sessions)}
                label={`Lượt nghe (${period} ngày)`}
                tone="blue"
              />
              <Tile
                value={
                  stats.listening.accuracy !== null
                    ? `${stats.listening.accuracy}%`
                    : "—"
                }
                label="Nghe đúng"
                tone="emerald"
              />
              <Tile
                value={String(stats.listening.minutes)}
                label="Phút nghe"
                tone="amber"
              />
              <Tile
                value={String(stats.speaking.sessions)}
                label={`Lượt nói (${period} ngày)`}
                tone="blue"
              />
              <Tile
                value={
                  stats.speaking.accuracy !== null
                    ? `${stats.speaking.accuracy}%`
                    : "—"
                }
                label="Nói chuẩn"
                tone="emerald"
              />
              <Tile
                value={String(stats.speaking.minutes)}
                label="Phút nói"
                tone="amber"
              />
            </div>
            <p className="text-xs text-slate-500">
              Tập viết hiện chưa được ghi lại vào trang này.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
