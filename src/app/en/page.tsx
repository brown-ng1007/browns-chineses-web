"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import { db, type EnLog } from "@/lib/db";
import { EN_WORLDS } from "@/lib/en/words";
import { getEnStatus, loadEnWords } from "@/lib/en/vocab";
import { countDue, readLogs } from "@/lib/en/store";
import { dayKey } from "@/lib/tower";
import { STAGE_SIZE, buildStages, stageStates, type Prog, type StageState } from "@/lib/en/map";

// Bảng màu trầm ấm, sang trọng, dịu mắt cho từng Unit
const UNIT_THEME = [
  {
    bg: "#0d6e57",
    bg2: "#128c6e",
    edge: "#084c3c",
    text: "#0d6e57",
    shadow: "rgba(13, 110, 87, 0.26)",
    ring: "#10b981",
  },
  {
    bg: "#364fc7",
    bg2: "#4c6ef5",
    edge: "#283b99",
    text: "#364fc7",
    shadow: "rgba(54, 79, 199, 0.26)",
    ring: "#6366f1",
  },
  {
    bg: "#5f3dc4",
    bg2: "#7950f2",
    edge: "#472d96",
    text: "#5f3dc4",
    shadow: "rgba(95, 61, 196, 0.26)",
    ring: "#8b5cf6",
  },
  {
    bg: "#c94814",
    bg2: "#e8590c",
    edge: "#9c360d",
    text: "#c94814",
    shadow: "rgba(201, 72, 20, 0.26)",
    ring: "#f97316",
  },
  {
    bg: "#0b7285",
    bg2: "#1098ad",
    edge: "#085563",
    text: "#0b7285",
    shadow: "rgba(11, 114, 133, 0.26)",
    ring: "#06b6d4",
  },
];
const themeOf = (unitIndex: number) => UNIT_THEME[(unitIndex - 1) % UNIT_THEME.length];

/* Hệ thống Icon Vector cho 6 công cụ luyện tập (Thay thế toàn bộ Emoji) */
const TOOLS: {
  href: string;
  label: string;
  tone: string;
  icon: ReactNode;
}[] = [
  {
    href: "/en/vocab",
    label: "Từ vựng",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    ),
  },
  {
    href: "/en/review",
    label: "Ôn tập",
    tone: "bg-blue-50 text-blue-700 border-blue-200/70",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </svg>
    ),
  },
  {
    href: "/en/listen",
    label: "Nghe",
    tone: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    ),
  },
  {
    href: "/en/speak",
    label: "Nói",
    tone: "bg-rose-50 text-rose-700 border-rose-200/70",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    ),
  },
  {
    href: "/en/games",
    label: "Trò chơi",
    tone: "bg-amber-50 text-amber-700 border-amber-200/70",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="12" x="2" y="6" rx="3" />
        <path d="M6 12h4m-2-2v4m7-1h.01M18 11h.01" />
      </svg>
    ),
  },
  {
    href: "/en/skills",
    label: "Kỹ năng",
    tone: "bg-violet-50 text-violet-700 border-violet-200/70",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" x2="18" y1="20" y2="10" />
        <line x1="12" x2="12" y1="20" y2="4" />
        <line x1="6" x2="6" y1="20" y2="14" />
      </svg>
    ),
  },
];

const NODE_SIZE = 68;
const BOSS_SIZE = 76;

// Đường cong chữ S cân đối
function offsetOf(n: number, boss: boolean) {
  if (boss) return 0;
  const pattern = [0, -40, -64, -40, 0, 40, 64, 40];
  return pattern[(n - 1) % pattern.length];
}

/* ================= CÁC ICON VECTOR TRÊN NÚT CHẶNG ================= */
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function IconStar({ size = 28, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <polygon
        points="12,2.5 14.9,8.7 21.6,9.5 16.6,14.1 18,20.8 12,17.4 6,20.8 7.4,14.1 2.4,9.5 9.1,8.7"
        fill={color}
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="14" height="10" x="5" y="11" rx="2.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function IconTrophy({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

/* Rương cột mốc Vector sắc nét (Milestone Reward Chest) */
function MilestoneChest({ unlocked }: { unlocked: boolean }) {
  const outer = unlocked ? "#d97706" : "#94a3b8";
  const body = unlocked ? "#f59e0b" : "#e2e8f0";
  const lid = unlocked ? "#fbbf24" : "#f1f5f9";
  const band = unlocked ? "#78350f" : "#64748b";
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 shadow-sm transition ${
        unlocked
          ? "border-amber-300/90 bg-gradient-to-b from-amber-50/90 to-white"
          : "border-slate-200 bg-slate-50/80"
      }`}
    >
      <svg viewBox="0 0 44 40" width="34" height="31" aria-hidden="true">
        <rect x="4" y="16" width="36" height="20" rx="4" fill={body} stroke={outer} strokeWidth="2" />
        <path d="M4 17 C4 9, 40 9, 40 17 Z" fill={lid} stroke={outer} strokeWidth="2" />
        <rect x="11" y="10" width="4" height="26" fill={band} opacity="0.25" />
        <rect x="29" y="10" width="4" height="26" fill={band} opacity="0.25" />
        <rect x="18" y="13" width="8" height="9" rx="2.5" fill="#ffffff" stroke={outer} strokeWidth="2" />
        <circle cx="22" cy="17.5" r="1.5" fill={band} />
      </svg>
      <div className="text-left">
        <p className={`text-xs font-bold leading-tight ${unlocked ? "text-amber-900" : "text-slate-600"}`}>
          Rương cột mốc
        </p>
        <p className="text-[11px] font-medium text-slate-500">
          {unlocked ? "Đã mở khóa phần thưởng" : "Hoàn thành chặng trên"}
        </p>
      </div>
    </div>
  );
}

function SmallStars({ n }: { n: number }) {
  return (
    <div
      className="absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 shadow-[0_2px_6px_rgba(15,23,42,0.08)]"
      style={{ bottom: -15 }}
      aria-label={`${n} sao`}
    >
      {[1, 2, 3].map((i) => (
        <IconStar key={i} size={11} color={i <= n ? "#f59e0b" : "#cbd5e1"} />
      ))}
    </div>
  );
}

interface Group {
  world: number;
  items: StageState[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_LABELS = ["M", "Tu", "W", "Th", "F", "Sa", "Su"];

export default function EnMapPage() {
  const [states, setStates] = useState<StageState[] | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [dueN, setDueN] = useState(0);
  const [logs, setLogs] = useState<EnLog[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const words = await loadEnWords();
      const stages = buildStages(words);
      const progress: Record<string, Prog> = {};
      try {
        const rows = await db.en_progress.toArray();
        for (const r of rows) {
          progress[r.stage_id] = {
            stars: r.stars,
            doneOn: r.done_on,
            used: !!r.used,
            recalled: !!r.recalled,
            recallOn: r.recall_on,
          };
        }
      } catch {
        // chưa đọc được dữ liệu trong máy
      }
      let dueCount = 0;
      let logList: EnLog[] = [];
      try {
        dueCount = await countDue();
        logList = await readLogs();
      } catch {
        // chưa đọc được thẻ ôn / nhật ký
      }
      if (alive) {
        setDueN(dueCount);
        setLogs(logList);
        setStates(stageStates(stages, progress, dayKey(new Date())));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const groups = useMemo<Group[] | null>(() => {
    if (!states) return null;
    const out: Group[] = [];
    for (const s of states) {
      const last = out[out.length - 1];
      if (last && last.world === s.stage.world) last.items.push(s);
      else out.push({ world: s.stage.world, items: [s] });
    }
    return out;
  }, [states]);

  function showHint(id: string) {
    setHint(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHint(null), 2400);
  }

  if (!states || !groups) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-[#0d6e57]" />
        <p className="text-sm font-semibold text-slate-600">Đang tải lộ trình học...</p>
      </div>
    );
  }

  const today = dayKey(new Date());
  const totalStars = states.reduce((a, s) => a + s.stars, 0);
  const due = states.filter((s) => s.recallDue);
  const recalledToday = states.filter((s) => s.prog?.recallOn === today).length;
  const learnedToday = states.some((s) => s.prog?.doneOn === today);
  const cur = states.find((s) => s.current) ?? states[0];
  const normal = states.filter((s) => !s.stage.boss);
  const wordsTotal = normal.reduce((a, s) => a + s.stage.wordIds.length, 0);
  const wordsLearned = normal.filter((s) => s.stars > 0).reduce((a, s) => a + s.stage.wordIds.length, 0);
  const pct = wordsTotal > 0 ? Math.round((wordsLearned / wordsTotal) * 100) : 0;

  // Tính XP hôm nay và dữ liệu biểu đồ 7 ngày
  const now = Date.now();
  const todayLogs = logs.filter((l) => l.day === today);
  const rawTodayXp = todayLogs.reduce((a, l) => a + l.total * 2, 0) + (learnedToday ? 20 : 0);
  const todayXp = rawTodayXp > 0 ? rawTodayXp : 40;
  const dailyGoalXp = 10;
  const goalPct = Math.min(100, Math.round((todayXp / dailyGoalXp) * 100));

  const fallbackCurve = [920, 45, 35, 140, 10, 15, 40];
  const chartDays = WEEK_LABELS.map((dayLabel, idx) => {
    const dKey = dayKey(new Date(now - (6 - idx) * DAY_MS));
    const dayXp = logs.filter((l) => l.day === dKey).reduce((a, l) => a + l.total * 10, 0);
    const val = logs.length > 0 ? dayXp : fallbackCurve[idx];
    return { label: dayLabel, val };
  });
  const maxChartVal = Math.max(920, ...chartDays.map((d) => d.val));

  // Bảng xếp hạng Classroom với Avatar Monogram sắc nét (không dùng Emoji)
  const userTotalXp = Math.max(90, totalStars * 20 + wordsLearned * 4 + rawTodayXp);
  const leaderboard = [
    {
      name: "Jay",
      xp: 204,
      initials: "JM",
      avatarCls: "bg-blue-100 text-blue-800 border-blue-200",
      isMe: false,
    },
    {
      name: "Bridgette",
      xp: 104,
      initials: "BC",
      avatarCls: "bg-rose-100 text-rose-800 border-rose-200",
      isMe: false,
    },
    {
      name: "Steph",
      xp: 90,
      initials: "SK",
      avatarCls: "bg-violet-100 text-violet-800 border-violet-200",
      isMe: false,
    },
    {
      name: "Brown (Bạn)",
      xp: userTotalXp,
      initials: "BN",
      avatarCls: "bg-emerald-100 text-emerald-800 border-emerald-300",
      isMe: true,
    },
  ]
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 4);

  const st = getEnStatus();
  const srcNote =
    st.source === "seed"
      ? `Bộ từ vựng mẫu (${st.count} từ)`
      : `${st.count} từ vựng Oxford / IELTS (${st.source === "cache" ? "Đã lưu trên máy" : "Supabase"})`;

  return (
    <main className="mx-auto w-full max-w-5xl pb-24 pt-2">
      {/* Thanh công cụ nhanh trên màn hình nhỏ (Mobile/Tablet) */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden no-scrollbar">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="relative flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-xs active:translate-y-0.5"
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-lg border ${t.tone}`}>
              {t.icon}
            </span>
            <span>{t.label}</span>
            {t.href === "/en/review" && dueN > 0 && <span className="en-badge">{dueN}</span>}
          </Link>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_350px]">
        {/* ================= CỘT TRÁI: LỘ TRÌNH HỌC SẮC NÉT ================= */}
        <section className="mx-auto w-full max-w-[500px]">
          {groups.map((g, gi) => {
            const w = EN_WORLDS.find((x) => x.id === g.world);
            const t = themeOf(gi + 1);
            const done = g.items.filter((s) => s.stars > 0).length;
            const shown = open[g.world] ?? true;
            const isNextLockedUnit = gi > 0 && done === 0 && !g.items.some((s) => s.current);

            return (
              <div key={`w${g.world}`} className="mb-12">
                {/* Banner Unit sang trọng, chữ sắc nét, tương phản cao */}
                <button
                  type="button"
                  onClick={() => setOpen({ ...open, [g.world]: !shown })}
                  aria-expanded={shown}
                  className="duo-unit-banner"
                  style={
                    {
                      "--u-bg": t.bg,
                      "--u-bg2": t.bg2,
                      "--u-edge": t.edge,
                      "--u-shadow": t.shadow,
                    } as CSSProperties
                  }
                >
                  <div className="relative z-10 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white/95 backdrop-blur-xs">
                        Unit {gi + 1} · {w?.tag ?? "B1"}
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-[19px] font-bold tracking-tight text-white">
                      {w?.name ?? `Phần ${gi + 1}`}
                    </h2>
                    <p className="mt-0.5 text-[13px] font-medium text-white/85">
                      {gi === 0
                        ? `Từ vựng cốt lõi ${w?.tag ?? "B1"} & cấu trúc câu giao tiếp hằng ngày`
                        : gi === 1
                        ? `Tình huống công sở, email thương mại & luyện phản xạ TOEIC`
                        : `Từ vựng học thuật, phân tích số liệu & chủ đề IELTS 5.0+`}
                    </p>
                  </div>

                  <span className="relative z-10 flex shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-black/15 px-3 py-1.5 text-xs font-bold text-white">
                    <span>
                      {done}/{g.items.length}
                    </span>
                    <svg
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${shown ? "rotate-180" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>

                {/* Nút "JUMP HERE?" cho các Unit tiếp theo */}
                {shown && isNextLockedUnit && g.items[0] && (
                  <div className="mt-6 -mb-3 flex flex-col items-center">
                    <Link
                      href={`/en/stage/${g.items[0].stage.id}`}
                      className="duo-start-bubble"
                      style={{ color: t.text }}
                    >
                      <span>JUMP HERE?</span>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14m-6-6 6 6-6 6" />
                      </svg>
                    </Link>
                  </div>
                )}

                {/* Các nút chặng uốn lượn theo hình chữ S */}
                <div className="relative pt-10" hidden={!shown}>
                  {shown &&
                    g.items.map((s, idx) => {
                      const boss = s.stage.boss;
                      const size = boss ? BOSS_SIZE : NODE_SIZE;
                      const x = offsetOf(s.stage.n, boss);
                      const isDone = s.unlocked && s.stars > 0;
                      const kind = !s.unlocked ? "locked" : isDone ? "done" : "current";
                      const href = s.recallDue ? `/en/stage/${s.stage.id}?recall=1` : `/en/stage/${s.stage.id}`;
                      const showChest = !boss && idx > 0 && idx % 4 === 3;

                      const icon =
                        kind === "locked" ? (
                          boss ? (
                            <IconTrophy />
                          ) : idx % 2 === 1 ? (
                            <IconBook />
                          ) : (
                            <IconLock />
                          )
                        ) : boss ? (
                          <IconTrophy />
                        ) : kind === "done" ? (
                          idx % 2 === 1 ? (
                            <IconBook />
                          ) : (
                            <IconCheck />
                          )
                        ) : (
                          <IconStar />
                        );

                      return (
                        <div key={s.stage.id}>
                          {/* Rương cột mốc xen kẽ trên đường học */}
                          {showChest && (
                            <div
                              className="relative mb-8 flex justify-center"
                              style={{ transform: `translateX(${Math.round(x * 0.45)}px)` }}
                            >
                              <Link
                                href={isDone || s.unlocked ? href : "/en/review"}
                                className="duo-chest"
                              >
                                <MilestoneChest unlocked={isDone || s.unlocked} />
                              </Link>
                            </div>
                          )}

                          <div
                            id={s.current ? "en-current" : undefined}
                            className="relative flex justify-center"
                            style={{
                              marginBottom: 38,
                              marginTop: s.current ? 46 : s.recallDue ? 28 : 0,
                            }}
                          >
                            {/* Thẻ thông tin chặng hiện tại bên cạnh nút START (thay thế hình cú hoạt hình) */}
                            {s.current && (
                              <div
                                className=" hidden sm:flex items-center absolute z-10"
                                style={{
                                  left: x >= 0 ? "calc(50% - 215px)" : "calc(50% + 72px)",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                }}
                              >
                                <Link
                                  href={`/en/stage/${s.stage.id}`}
                                  className="group flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition hover:border-slate-300 hover:shadow-md"
                                >
                                  <span
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                                    style={{ background: t.bg }}
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                      <polygon points="6 4 20 12 6 20 6 4" />
                                    </svg>
                                  </span>
                                  <div className="text-left">
                                    <p className="text-xs font-bold text-slate-900 leading-tight">
                                      Chặng {s.stage.n}
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500">
                                      {boss ? "Bài tổng hợp" : `${STAGE_SIZE} từ mới`}
                                    </p>
                                  </div>
                                </Link>
                              </div>
                            )}

                            <div
                              className="relative flex items-center justify-center"
                              style={{
                                transform: `translateX(${x}px)`,
                                width: s.current ? size + 22 : size,
                                height: s.current ? size + 22 : size,
                              }}
                            >
                              {/* Nhãn START sắc nét phía trên chặng hiện tại */}
                              {s.current && (
                                <div
                                  className="absolute left-1/2 z-20 -translate-x-1/2"
                                  style={{ bottom: size + 24 }}
                                >
                                  <Link
                                    href={`/en/stage/${s.stage.id}`}
                                    className="duo-start-bubble"
                                    style={{ color: t.text }}
                                  >
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ background: t.ring }}
                                    />
                                    <span>START</span>
                                  </Link>
                                </div>
                              )}

                              {/* Nhãn nhắc Ôn lại (đặt gọn phía trên hoặc bên cạnh không đè vào START) */}
                              {s.recallDue && (
                                <Link
                                  href={href}
                                  className="absolute left-1/2 z-20 -translate-x-1/2 flex items-center gap-1 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-amber-900 shadow-xs transition hover:bg-amber-100"
                                  style={{ bottom: size + 10 }}
                                >
                                  <svg className="w-3 h-3 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                    <path d="M3 3v5h5" />
                                  </svg>
                                  <span>Ôn lại</span>
                                </Link>
                              )}

                              {/* Gợi ý khi bấm vào chặng đang khóa */}
                              {kind === "locked" && hint === s.stage.id && (
                                <div
                                  className="absolute left-1/2 z-30 -translate-x-1/2"
                                  style={{ bottom: size + 14 }}
                                >
                                  <div className="duo-start-bubble !text-xs !font-semibold !normal-case !tracking-normal !text-slate-600">
                                    <span>Hoàn thành chặng trước hoặc</span>
                                    <Link
                                      href={`/en/stage/${s.stage.id}`}
                                      className="font-bold text-[#2563eb] underline"
                                    >
                                      Học thử ngay
                                    </Link>
                                  </div>
                                </div>
                              )}

                              {/* Vòng tròn tiến độ bao quanh nút START hiện tại */}
                              {s.current && (
                                <svg
                                  viewBox="0 0 94 94"
                                  className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                                  aria-hidden="true"
                                >
                                  <circle
                                    cx="47"
                                    cy="47"
                                    r="42"
                                    fill="none"
                                    stroke="#e2e8f0"
                                    strokeWidth="5"
                                  />
                                  <circle
                                    cx="47"
                                    cy="47"
                                    r="42"
                                    fill="none"
                                    stroke={t.ring}
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                    strokeDasharray="175 264"
                                  />
                                </svg>
                              )}

                              {kind === "locked" ? (
                                <button
                                  type="button"
                                  onClick={() => showHint(s.stage.id)}
                                  aria-label={`Chặng ${s.stage.n} đang khóa`}
                                  className={`duo-node duo-node--locked ${hint === s.stage.id ? "en-shake" : ""}`}
                                  style={{ width: size, height: size }}
                                >
                                  {icon}
                                </button>
                              ) : (
                                <Link
                                  href={kind === "current" ? `/en/stage/${s.stage.id}` : href}
                                  aria-label={boss ? "Chặng tổng hợp" : `Chặng ${s.stage.n}`}
                                  className={`duo-node duo-node--${kind}`}
                                  style={
                                    {
                                      "--face": t.bg,
                                      "--face2": t.bg2,
                                      "--edge": t.edge,
                                      "--u-shadow": t.shadow,
                                      width: size,
                                      height: size,
                                    } as CSSProperties
                                  }
                                >
                                  {icon}
                                </Link>
                              )}

                              {isDone && <SmallStars n={s.stars} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}

          {/* Thanh trạng thái nguồn dữ liệu gọn nhẹ ở cuối lộ trình */}
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-slate-600">{srcNote}</span>
            </div>
            <Link
              href="/en/vocab"
              className="text-xs font-bold text-[#0d6e57] hover:underline"
            >
              Tra từ điển →
            </Link>
          </div>
        </section>

        {/* ================= CỘT PHẢI: SIDEBAR WIDGETS SẮC NÉT ================= */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          {/* Card 1: My Assignments */}
          <div className="duo-widget">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[16px] font-bold tracking-tight text-slate-900">
                My Assignments
              </h3>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                Hôm nay
              </span>
            </div>

            <Link
              href={cur ? `/en/stage/${cur.stage.id}` : "/en"}
              className="mt-3.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-amber-600 border border-amber-200/80">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">10 XP</p>
                  <p className="text-xs font-medium text-slate-500">
                    {learnedToday ? "10/10 XP hoàn thành" : `${Math.min(rawTodayXp, 10)}/10 XP`}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  learnedToday
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-white text-slate-700 border border-slate-200"
                }`}
              >
                {learnedToday ? "Đã xong" : `Chặng ${cur?.stage.n ?? 1}`}
              </span>
            </Link>

            {due.length > 0 && (
              <Link
                href={`/en/stage/${due[0].stage.id}?recall=1`}
                className="mt-2.5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100/70"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  <span>Ôn lại bài hôm trước (không gợi ý)</span>
                </span>
                <span className="rounded-md bg-amber-200/60 px-1.5 py-0.5 font-bold text-amber-900">
                  {recalledToday}/{recalledToday + due.length}
                </span>
              </Link>
            )}
          </div>

          {/* Card 2: Schools Team Classroom (Leaderboard) */}
          <div className="duo-widget">
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-xs ring-1 ring-amber-500/20">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold tracking-tight text-slate-900">
                  Schools Team Classroom
                </h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Còn 3 ngày · <span className="font-semibold text-amber-700">{wordsLearned}/{wordsTotal} từ ({totalStars} sao)</span>
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              {leaderboard.map((u, i) => {
                const rank = i + 1;
                const badgeCls =
                  rank === 1
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : rank === 2
                    ? "bg-slate-100 text-slate-700 border border-slate-300"
                    : rank === 3
                    ? "bg-orange-100 text-orange-800 border border-orange-300"
                    : "bg-slate-50 text-slate-500 border border-slate-200";
                return (
                  <div
                    key={u.name}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-2 transition ${
                      u.isMe
                        ? "bg-emerald-50/70 border border-emerald-200/80"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${badgeCls}`}
                      >
                        {rank}
                      </span>
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold tracking-tight ${u.avatarCls}`}
                      >
                        {u.initials}
                      </span>
                      <span className="text-[13.5px] font-semibold text-slate-900">
                        {u.name}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-600">{u.xp} XP</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: XP Progress (Daily Goal + Biểu đồ đường 7 ngày) */}
          <div className="duo-widget">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold tracking-tight text-slate-900">
                XP Progress
              </h3>
              <Link
                href="/en/skills"
                className="text-xs font-bold text-[#2563eb] hover:underline"
              >
                Chi tiết →
              </Link>
            </div>

            <div className="mt-3.5 flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100/80 text-[#0d6e57] border border-emerald-200/80">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Mục tiêu ngày</span>
                  <span className="text-xs font-bold text-[#0d6e57]">
                    {todayXp}/{dailyGoalXp} XP
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0d6e57] to-[#10b981] transition-all"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Biểu đồ đường 7 ngày sắc nét */}
            <div className="mt-5">
              <svg viewBox="0 0 280 120" className="h-28 w-full overflow-visible">
                <defs>
                  <linearGradient id="xpAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d6e57" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#0d6e57" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {[
                  { y: 10, label: String(maxChartVal) },
                  { y: 32, label: String(Math.round(maxChartVal * 0.75)) },
                  { y: 54, label: String(Math.round(maxChartVal * 0.5)) },
                  { y: 76, label: String(Math.round(maxChartVal * 0.25)) },
                  { y: 98, label: "0" },
                ].map((row, idx) => (
                  <g key={idx}>
                    <text
                      x="26"
                      y={row.y + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-medium"
                    >
                      {row.label}
                    </text>
                    <line
                      x1="36"
                      y1={row.y}
                      x2="270"
                      y2={row.y}
                      stroke="#f1f5f9"
                      strokeWidth="1.5"
                    />
                  </g>
                ))}

                {(() => {
                  const pts = chartDays.map((d, i) => {
                    const x = 45 + i * 36;
                    const y = 98 - Math.min(88, Math.round((d.val / maxChartVal) * 88));
                    return { x, y, label: d.label };
                  });
                  const polyPoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
                  const areaPoints = `${polyPoints} ${pts[pts.length - 1].x},98 ${pts[0].x},98`;
                  return (
                    <>
                      <polygon points={areaPoints} fill="url(#xpAreaGrad)" />
                      <polyline
                        fill="none"
                        stroke="#0d6e57"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={polyPoints}
                      />
                      {pts.map((p, i) => (
                        <g key={i}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="3.5"
                            fill="#ffffff"
                            stroke="#0d6e57"
                            strokeWidth="2.2"
                          />
                          <text
                            x={p.x}
                            y="115"
                            textAnchor="middle"
                            className="fill-slate-500 text-[10px] font-semibold"
                          >
                            {p.label}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* Card 4: Progress Quiz */}
          <div className="duo-widget">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold tracking-tight text-slate-900">
                Progress Quiz
              </h3>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
                IELTS Band
              </span>
            </div>
            <div className="mt-3.5 flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2b50d8] to-[#1e3a9e] text-sm font-bold text-white shadow-xs">
                {(3.5 + (pct / 100) * 1.5).toFixed(1)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  {dueN > 0
                    ? `Có ${dueN} thẻ từ vựng đến hạn cần ôn tập hôm nay.`
                    : `Đã nắm vững ${pct}% lộ trình (${wordsLearned}/${wordsTotal} từ).`}
                </p>
                <Link
                  href="/en/skills"
                  className="mt-0.5 inline-block text-xs font-bold text-[#2563eb] hover:underline"
                >
                  Xem lịch sử học →
                </Link>
              </div>
            </div>
            <Link
              href={dueN > 0 ? "/en/review" : cur ? `/en/stage/${cur.stage.id}` : "/en/games"}
              className="en-btn en-btn--blue mt-4"
            >
              {dueN > 0 ? `Ôn tập ${dueN} thẻ ngay` : "Làm bài kiểm tra"}
            </Link>
          </div>

          {/* Card 5: Các chế độ Luyện tập bổ trợ */}
          <div className="duo-widget">
            <h3 className="mb-3 text-[15px] font-bold tracking-tight text-slate-900">
              Luyện tập kỹ năng
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {TOOLS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="relative flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 active:translate-y-0.5"
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${t.tone}`}>
                    {t.icon}
                  </span>
                  <span>{t.label}</span>
                  {t.href === "/en/review" && dueN > 0 && <span className="en-badge">{dueN}</span>}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
