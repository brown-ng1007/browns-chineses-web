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
  { bg: "#174ea6", bg2: "#2563eb", edge: "#123c83", text: "#174ea6", shadow: "rgba(37, 99, 235, 0.25)", ring: "#60a5fa" },
  { bg: "#4338ca", bg2: "#6366f1", edge: "#312e81", text: "#4338ca", shadow: "rgba(79, 70, 229, 0.24)", ring: "#818cf8" },
  { bg: "#0e7490", bg2: "#0891b2", edge: "#155e75", text: "#0e7490", shadow: "rgba(8, 145, 178, 0.24)", ring: "#22d3ee" },
  { bg: "#b45309", bg2: "#d97706", edge: "#92400e", text: "#b45309", shadow: "rgba(217, 119, 6, 0.23)", ring: "#fbbf24" },
  { bg: "#5b21b6", bg2: "#7c3aed", edge: "#4c1d95", text: "#5b21b6", shadow: "rgba(124, 58, 237, 0.23)", ring: "#a78bfa" },
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

// Bản đồ kho báu dùng hàng cố định để đường đi SVG luôn khớp tâm checkpoint.
const TREASURE_ROW_HEIGHT = 146;
const TREASURE_NODE_CENTER = 70;
const TREASURE_MAP_WIDTH = 620;

function treasureRoutePath(items: StageState[]): string {
  const points = items.map((item, index) => ({
    x: 500 + (offsetOf(item.stage.n, item.stage.boss) / TREASURE_MAP_WIDTH) * 1000,
    y: TREASURE_NODE_CENTER + index * TREASURE_ROW_HEIGHT,
  }));
  if (!points.length) return "";
  const first = points[0];
  let d = `M500 12 C500 38 ${first.x} ${first.y - 36} ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    d += ` C${a.x} ${a.y + 54} ${b.x} ${b.y - 54} ${b.x} ${b.y}`;
  }
  const last = points[points.length - 1];
  d += ` C${last.x} ${last.y + 48} 500 ${last.y + 56} 500 ${last.y + 88}`;
  return d;
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
  // Đích kho báu chỉ mở khi mọi checkpoint trên toàn bộ bản đồ đã đạt ít nhất 1 sao.
  const checkpointsPassed = states.filter((stage) => stage.unlocked && stage.stars >= 1).length;
  const checkpointsTotal = states.length;
  const treasureProgress = checkpointsTotal > 0 ? Math.round((checkpointsPassed / checkpointsTotal) * 100) : 0;
  const treasureUnlocked = checkpointsTotal > 0 && checkpointsPassed === checkpointsTotal;

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

      <section className="en-journey-hero mb-6" aria-labelledby="en-journey-title">
        <div className="en-journey-main">
          <span className="en-journey-kicker">ENGLISH QUEST · WORLD ROUTE</span>
          <h1 id="en-journey-title">Chinh phục tiếng Anh từng chặng</h1>
          <p>Tiến đều mỗi ngày: học từ mới, dùng từ trong câu, rồi quay lại kiểm tra trí nhớ. Lỡ một ngày cũng không phải học bù tất cả.</p>
          <div className="en-journey-stats">
            <div><strong>{pct}%</strong><span>lộ trình đã qua</span></div>
            <div><strong>{wordsLearned}</strong><span>từ đã hoàn thành</span></div>
            <div><strong>{dueN}</strong><span>thẻ đến hạn ôn</span></div>
          </div>
          <div className="en-journey-progress" role="progressbar" aria-label="Tiến độ lộ trình tiếng Anh" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="en-journey-focus">
          <div className="en-journey-focus-top"><span>CHECKPOINT TIẾP THEO</span><b>{cur?.stage.boss ? "BOSS" : `UNIT ${cur?.stage.world ?? 1}`}</b></div>
          <strong>{cur?.stage.boss ? "Ôn tập tổng hợp" : `Chặng ${cur?.stage.n ?? 1}`}</strong>
          <p>{cur?.stage.boss ? "Tổng hợp kiến thức của Unit trước khi mở vùng mới." : `${cur?.stage.wordIds.length ?? STAGE_SIZE} từ mới · một lượt luyện ngắn.`}</p>
          <Link href={cur ? (cur.recallDue ? `/en/stage/${cur.stage.id}?recall=1` : `/en/stage/${cur.stage.id}`) : "/en"} className="en-journey-continue">{cur?.recallDue ? "Ôn lại chặng này" : "Tiếp tục học"} <span>→</span></Link>
          <div className="en-journey-three-steps">
            <span><b>01</b> Học ≥60%</span>
            <span><b>02</b> Dùng từ ≥80%</span>
            <span><b>03</b> Nhớ lại ngày mai</span>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        {/* ================= CỘT TRÁI: LỘ TRÌNH HỌC SẮC NÉT ================= */}
        <section className="mx-auto w-full max-w-[620px]">
          {/* Thanh nhảy nhanh Unit khi có hàng nghìn từ (60+ Units) */}
          {groups.length > 2 && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <label htmlFor="unit-jump" className="text-xs font-bold text-slate-700">
                  Chuyển nhanh:
                </label>
                <select
                  id="unit-jump"
                  defaultValue={cur ? String(cur.stage.world) : String(groups[0]?.world ?? 1)}
                  onChange={(e) => {
                    const worldId = Number(e.target.value);
                    setOpen((prev) => ({ ...prev, [worldId]: true }));
                    setTimeout(() => {
                      document
                        .getElementById(`unit-box-${worldId}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 60);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-[#0d6e57]"
                >
                  {groups.map((g, idx) => {
                    const w = EN_WORLDS.find((x) => x.id === g.world);
                    const doneCount = g.items.filter((s) => s.stars > 0).length;
                    return (
                      <option key={g.world} value={g.world}>
                        Unit {idx + 1} · {w?.tag ?? "B1"} - {w?.name ?? `Phần ${idx + 1}`} ({doneCount}/{g.items.length})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const nextState: Record<number, boolean> = {};
                    groups.forEach((g, idx) => {
                      const isCur = g.items.some((s) => s.current) || (!cur && idx === 0);
                      nextState[g.world] = isCur;
                    });
                    setOpen(nextState);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Thu gọn bớt
                </button>
              </div>
            </div>
          )}

          {groups.map((g, gi) => {
            const w = EN_WORLDS.find((x) => x.id === g.world);
            const t = themeOf(gi + 1);
            const done = g.items.filter((s) => s.stars > 0).length;
            const unitPct = Math.round((done / Math.max(1, g.items.length)) * 100);
            const curUnitIdx = Math.max(
              0,
              groups.findIndex((grp) => grp.items.some((s) => s.current))
            );
            // Mặc định chỉ mở Unit đang học và Unit kế tiếp để trang không bị dài hàng chục nghìn px khi có 4.000 từ
            const defaultOpen = gi === curUnitIdx || gi === curUnitIdx + 1;
            const shown = open[g.world] ?? defaultOpen;

            return (
              <div key={`w${g.world}`} id={`unit-box-${g.world}`} className="mb-8 scroll-mt-24">
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
                    <div className="duo-unit-progress" role="progressbar" aria-label={`Tiến độ Unit ${gi + 1}`} aria-valuenow={unitPct} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${unitPct}%` }} />
                    </div>
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

                {/* Tuyến kho báu: mỗi checkpoint nối tiếp checkpoint trước */}
                <div className="en-map-stage-field" hidden={!shown}>
                  <div className="duo-map-start-marker" aria-hidden="true">
                    <svg viewBox="0 0 34 28" width="28" height="24" fill="none">
                      <path d="M3 20h28l-4 5H8z" fill="#98652f" stroke="#71451d" strokeWidth="1.4" />
                      <path d="M17 3v17M18 4l10 5-10 5z" fill="#fff2cf" stroke="#98652f" strokeWidth="1.2" strokeLinejoin="round" />
                      <path d="M4 18h26" stroke="#e8bd6e" strokeWidth="1.5" />
                    </svg>
                    <span><b>BẾN KHỞI HÀNH</b><small>UNIT {gi + 1} · {w?.tag ?? "B1"}</small></span>
                  </div>
                  <div className="duo-map-compass" aria-hidden="true">
                    <svg viewBox="0 0 40 40" width="32" height="32" fill="none">
                      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M20 5 23.5 20 20 35 16.5 20Z" fill="#c28c3f" stroke="#8c6128" strokeWidth="1" />
                      <path d="M20 5 16.5 20 20 18Z" fill="#fff2c8" />
                      <circle cx="20" cy="20" r="2.3" fill="#8c6128" />
                    </svg>
                    <span>N</span>
                  </div>
                  <div className="duo-map-legend" aria-hidden="true">
                    <span><i className="is-done" /> Đã qua</span>
                    <span><i className="is-current" /> Đang học</span>
                    <span><i className="is-locked" /> Chưa mở</span>
                  </div>
                  <div className="duo-map-checkpoints" style={{ height: `${g.items.length * TREASURE_ROW_HEIGHT + 104}px` }}>
                    <svg className="duo-treasure-route" viewBox={`0 0 1000 ${g.items.length * TREASURE_ROW_HEIGHT + 104}`} preserveAspectRatio="none" aria-hidden="true">
                      <path d={treasureRoutePath(g.items)} className="duo-treasure-route-shadow" />
                      <path d={treasureRoutePath(g.items)} className="duo-treasure-route-base" />
                      <path d={treasureRoutePath(g.items)} className="duo-treasure-route-dashes" />
                    </svg>
                    <svg className="duo-map-landmarks" viewBox={`0 0 1000 ${g.items.length * TREASURE_ROW_HEIGHT + 104}`} preserveAspectRatio="none" aria-hidden="true">
                      <g transform="translate(40 190)" opacity=".76">
                        <path d="M0 48 Q45 5 94 48Z" fill="#a6c58d" stroke="#789e68" strokeWidth="3" />
                        <path d="M34 45 47 17 60 45M58 45 72 25 85 45" fill="#d6dfbf" stroke="#8da77b" strokeWidth="2" />
                        <path d="M17 48q8-18 16 0m54 0q8-18 16 0" fill="none" stroke="#477b52" strokeWidth="4" strokeLinecap="round" />
                      </g>
                      <g transform={`translate(850 ${Math.max(250, g.items.length * 48)})`} opacity=".72">
                        <path d="M0 44 Q48 8 100 44Z" fill="#a2c58b" stroke="#6c9a68" strokeWidth="3" />
                        <path d="M49 42V7m0 7Q21 0 20 17q19 0 29-3m0 3Q75 0 80 17q-18 0-31 0" fill="#5b9158" stroke="#3f7048" strokeWidth="2" strokeLinejoin="round" />
                      </g>
                      <g transform={`translate(56 ${Math.max(520, g.items.length * 86)})`} opacity=".62">
                        <path d="M0 28q35-28 70 0q-35 22-70 0Z" fill="#9fc8d1" stroke="#6d9ca9" strokeWidth="2" />
                        <path d="M35 4v27m0-25 21 11H35" fill="#fff4d8" stroke="#9b7540" strokeWidth="2" />
                      </g>
                    </svg>
                    {g.items.map((s, idx) => {
                      const boss = s.stage.boss;
                      const size = boss ? BOSS_SIZE + 8 : NODE_SIZE;
                      const x = offsetOf(s.stage.n, boss);
                      const xPct = 50 + (x / TREASURE_MAP_WIDTH) * 100;
                      const isDone = s.unlocked && s.stars > 0;
                      const kind = !s.unlocked ? "locked" : isDone ? "done" : "current";
                      const href = s.recallDue ? `/en/stage/${s.stage.id}?recall=1` : `/en/stage/${s.stage.id}`;
                      const icon = boss ? <IconTrophy size={31} /> : kind === "locked" ? <IconLock /> : kind === "done" ? <IconCheck /> : <IconStar size={30} />;
                      const nodeTop = TREASURE_NODE_CENTER - size / 2;

                      return (
                        <div key={s.stage.id} className="duo-checkpoint-row" style={{ top: `${idx * TREASURE_ROW_HEIGHT}px` }}>
                          {s.current && (
                            <div className="duo-checkpoint-sidecard" style={{ top: `${TREASURE_NODE_CENTER - 23}px`, left: x >= 0 ? "5%" : undefined, right: x < 0 ? "5%" : undefined }}>
                              <Link href={`/en/stage/${s.stage.id}`} className="duo-checkpoint-sidecard-link">
                                <span className="duo-sidecard-play" style={{ background: t.bg }}>
                                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M7 4.8c0-.8.9-1.3 1.6-.9l10 7.2a1.1 1.1 0 0 1 0 1.8l-10 7.2c-.7.5-1.6-.1-1.6-.9z" /></svg>
                                </span>
                                <span><b>{boss ? "Thử thách thủ lĩnh" : `Chặng ${s.stage.n}`}</b><small>{boss ? "Ôn tập toàn Unit" : `${s.stage.wordIds.length} từ mới`}</small></span>
                              </Link>
                            </div>
                          )}

                          <div id={s.current ? "en-current" : undefined} className={`duo-checkpoint-anchor duo-checkpoint-anchor--${kind}`} style={{ left: `${xPct}%`, top: `${nodeTop}px`, width: size, height: size }}>
                            <span className="duo-checkpoint-island" aria-hidden="true" />
                            {s.current && (
                              <Link href={`/en/stage/${s.stage.id}`} className="duo-start-bubble" style={{ color: t.text }}>
                                <span className="duo-start-dot" style={{ background: t.ring }} /> START
                              </Link>
                            )}
                            {s.recallDue && (
                              <Link href={href} className="duo-recall-flag">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                ÔN LẠI
                              </Link>
                            )}
                            {kind === "locked" && hint === s.stage.id && (
                              <div className="duo-checkpoint-hint">Hoàn thành checkpoint ngay trước để mở chặng này.</div>
                            )}
                            {s.current && (
                              <svg viewBox="0 0 94 94" className="duo-checkpoint-progress" aria-hidden="true">
                                <circle cx="47" cy="47" r="42" fill="none" stroke="#eadfc7" strokeWidth="5" />
                                <circle cx="47" cy="47" r="42" fill="none" stroke={t.ring} strokeWidth="5" strokeLinecap="round" strokeDasharray="175 264" />
                              </svg>
                            )}
                            {kind === "locked" ? (
                              <button type="button" onClick={() => showHint(s.stage.id)} aria-label={`Chặng ${s.stage.n} đang khóa`} className="duo-node duo-node--locked" style={{ width: size, height: size }}>
                                <span className="duo-node-glyph">{icon}</span>
                                <span className="duo-node-code">{boss ? "BOSS" : `CP ${String(s.stage.index + 1).padStart(2, "0")}`}</span>
                              </button>
                            ) : (
                              <Link href={kind === "current" ? `/en/stage/${s.stage.id}` : href} aria-label={boss ? "Chặng tổng hợp" : `Chặng ${s.stage.n}`} className={`duo-node duo-node--${kind}`} style={{ "--face": t.bg, "--face2": t.bg2, "--edge": t.edge, "--u-shadow": t.shadow, width: size, height: size } as CSSProperties}>
                                <span className="duo-node-glyph">{icon}</span>
                                <span className="duo-node-code">{boss ? "BOSS" : `CP ${String(s.stage.index + 1).padStart(2, "0")}`}</span>
                              </Link>
                            )}
                            {isDone && <SmallStars n={s.stars} />}
                          </div>
                        </div>
                      );
                    })}
                    <div className="duo-unit-endpoint" style={{ top: `${g.items.length * TREASURE_ROW_HEIGHT + 10}px` }}>
                      <span className="duo-endpoint-chest" aria-hidden="true">
                        <svg viewBox="0 0 52 44" width="42" height="36" fill="none"><path d="M6 17h40v22H6z" fill="#a96f2e" stroke="#70451f" strokeWidth="2.5"/><path d="M4 17c0-13 44-13 44 0v6H4z" fill="#e7bb62" stroke="#8e5b27" strokeWidth="2.5"/><path d="M15 17v22m22-22v22" stroke="#74491f" strokeWidth="3"/><rect x="22" y="23" width="8" height="11" rx="2" fill="#fff0c6" stroke="#70451f" strokeWidth="1.5"/></svg>
                      </span>
                      <span><b>CỔNG KHO BÁU UNIT {gi + 1}</b><small>{done}/{g.items.length} checkpoint đã vượt qua</small></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <section className={`duo-final-treasure ${treasureUnlocked ? "is-unlocked" : ""}`} aria-label="Đích đến cuối hành trình tiếng Anh">
            <div className="duo-final-treasure-art" aria-hidden="true">
              <svg viewBox="0 0 112 92" width="104" height="86" fill="none">
                <path d="M14 38h84v43H14z" fill={treasureUnlocked ? "#d99a37" : "#cbd5e1"} stroke={treasureUnlocked ? "#8c6128" : "#64748b"} strokeWidth="3" strokeLinejoin="round"/>
                <path d="M10 39c0-20 92-20 92 0v8H10z" fill={treasureUnlocked ? "#f4c76c" : "#e2e8f0"} stroke={treasureUnlocked ? "#8c6128" : "#64748b"} strokeWidth="3"/>
                <path d="M26 30v50m60-50v50" stroke={treasureUnlocked ? "#8c6128" : "#94a3b8"} strokeWidth="7" opacity=".72"/>
                <rect x="46" y="42" width="20" height="23" rx="5" fill="#fff6d8" stroke={treasureUnlocked ? "#8c6128" : "#64748b"} strokeWidth="2.5"/>
                <path d="M56 49v8m-4-4h8" stroke="#8c6128" strokeWidth="2.5" strokeLinecap="round"/>
                {treasureUnlocked && <path d="M56 4 61 17 75 13 68 26 80 34 65 35 62 50 54 38 41 44 46 30 34 22 49 20Z" fill="#f6c76e" stroke="#b7791f" strokeWidth="1.6"/>}
              </svg>
            </div>
            <div className="duo-final-treasure-copy">
              <span className="duo-final-kicker">ĐÍCH CUỐI · ĐẢO KHO BÁU</span>
              <h3>{treasureUnlocked ? "Cậu đã tìm thấy kho báu!" : "Đảo kho báu đang chờ cậu"}</h3>
              <p>{treasureUnlocked ? "Tất cả checkpoint đã hoàn thành. Mở thử thách tổng kết để nhận phần thưởng cuối hành trình." : `Đã vượt ${checkpointsPassed}/${checkpointsTotal} checkpoint. Đi tiếp từng chặng để mở chiếc rương cuối bản đồ.`}</p>
              <div className="duo-treasure-progress" role="progressbar" aria-valuenow={treasureProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ tới kho báu">
                <span style={{ width: `${treasureProgress}%` }} />
              </div>
            </div>
            {treasureUnlocked ? (
              <Link href="/en/games/ioe" className="duo-treasure-action">Mở rương kho báu <span>→</span></Link>
            ) : (
              <span className="duo-treasure-locked">Còn {Math.max(0, checkpointsTotal - checkpointsPassed)} checkpoint</span>
            )}
          </section>

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

        {/* ================= CỘT PHẢI: SIDEBAR CUỘN ĐỘC LẬP ================= */}
        <aside className="en-sidebar-scroll space-y-4 lg:self-start">
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
