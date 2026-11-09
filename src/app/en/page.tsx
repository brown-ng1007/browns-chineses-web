"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import { db, type EnLog } from "@/lib/db";
import { EN_WORLDS } from "@/lib/en/words";
import { getEnStatus, loadEnWords } from "@/lib/en/vocab";
import { countDue, readLogs } from "@/lib/en/store";
import { dayKey } from "@/lib/tower";
import { STAGE_SIZE, buildStages, stageStates, type Prog, type StageState } from "@/lib/en/map";

// Bảng màu chuẩn Duolingo cho từng Unit (Xanh lá -> Tím -> Xanh ngọc -> Xanh dương -> Cam)
const UNIT_THEME = [
  { bg: "#58cc02", edge: "#46a302", text: "#58cc02" },
  { bg: "#ce82ff", edge: "#a55eea", text: "#ce82ff" },
  { bg: "#00cd9c", edge: "#00a37c", text: "#00cd9c" },
  { bg: "#1cb0f6", edge: "#1899d6", text: "#1cb0f6" },
  { bg: "#ff9600", edge: "#cc7800", text: "#ff9600" },
];
const themeOf = (unitIndex: number) => UNIT_THEME[(unitIndex - 1) % UNIT_THEME.length];

const TOOLS = [
  { href: "/en/vocab", emoji: "📖", label: "Từ vựng" },
  { href: "/en/review", emoji: "🔁", label: "Ôn tập" },
  { href: "/en/listen", emoji: "🎧", label: "Nghe" },
  { href: "/en/speak", emoji: "🎤", label: "Nói" },
  { href: "/en/games", emoji: "🎮", label: "Trò chơi" },
  { href: "/en/skills", emoji: "📊", label: "Kỹ năng" },
];

const NODE_SIZE = 70;
const BOSS_SIZE = 78;

// Đường cong chữ S chuẩn Duolingo
function offsetOf(n: number, boss: boolean) {
  if (boss) return 0;
  const pattern = [0, -44, -68, -44, 0, 44, 68, 44];
  return pattern[(n - 1) % pattern.length];
}

/* ================= CÁC ICON CHUẨN DUOLINGO ================= */
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

function IconStar({ size = 34, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <polygon
        points="12,2.5 14.9,8.7 21.6,9.5 16.6,14.1 18,20.8 12,17.4 6,20.8 7.4,14.1 2.4,9.5 9.1,8.7"
        fill={color}
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <rect x="6" y="11" width="12" height="9" rx="2.2" fill="currentColor" />
      <path
        d="M8.5 11V8a3.5 3.5 0 017 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrophy({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M7 4h10v4a5 5 0 01-10 0V4z" fill="currentColor" />
      <path
        d="M7 6H4.6a2.6 2.6 0 002.9 3.3M17 6h2.4a2.6 2.6 0 01-2.9 3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="11" y="13" width="2" height="4" fill="currentColor" />
      <rect x="8" y="17" width="8" height="3" rx="1.2" fill="currentColor" />
    </svg>
  );
}

/* Rương kho báu Duolingo (Vàng khi đã mở, Xám khi đang khóa) */
function DuoChest({ unlocked }: { unlocked: boolean }) {
  const main = unlocked ? "#ffc800" : "#e5e5e5";
  const dark = unlocked ? "#e5a400" : "#b7b7b7";
  const wood = unlocked ? "#b4690e" : "#999999";
  const lock = unlocked ? "#fff4cc" : "#afafaf";
  return (
    <svg viewBox="0 0 80 70" width="74" height="64" aria-hidden="true">
      {/* Đổ bóng đáy */}
      <ellipse cx="40" cy="64" rx="32" ry="5" fill="rgba(0,0,0,0.08)" />
      {/* Thân dưới rương */}
      <rect x="10" y="30" width="60" height="30" rx="6" fill={wood} stroke={dark} strokeWidth="3" />
      {/* Viền vàng quanh thân */}
      <rect x="10" y="30" width="10" height="30" rx="2" fill={main} />
      <rect x="60" y="30" width="10" height="30" rx="2" fill={main} />
      {/* Nắp rương */}
      <path d="M8 32 C8 16, 72 16, 72 32 Z" fill={main} stroke={dark} strokeWidth="3" />
      <path d="M18 32 C18 20, 62 20, 62 32 Z" fill={wood} />
      {/* Ổ khóa giữa */}
      <rect x="33" y="25" width="14" height="16" rx="4" fill={main} stroke={dark} strokeWidth="2.5" />
      <circle cx="40" cy="33" r="2.5" fill={lock} />
    </svg>
  );
}

/* Cú xanh Duo đang nghe nhạc / ngủ trên đường học */
function DuoSleepingMascot() {
  return (
    <svg viewBox="0 0 110 100" width="86" height="78" aria-hidden="true">
      {/* Nốt nhạc bay lên */}
      <text x="82" y="22" fill="#84d8ff" fontSize="16" fontWeight="bold">♪</text>
      <text x="94" y="12" fill="#1cb0f6" fontSize="14" fontWeight="bold">♫</text>
      {/* Đế tròn xám */}
      <ellipse cx="52" cy="84" rx="34" ry="10" fill="#e5e5e5" />
      {/* Thân cú xanh */}
      <ellipse cx="52" cy="56" rx="28" ry="24" fill="#58cc02" />
      <ellipse cx="52" cy="62" rx="18" ry="14" fill="#89e219" />
      {/* Cánh trái & phải */}
      <path d="M25 50 C12 46, 12 64, 26 66 Z" fill="#58cc02" />
      <path d="M79 48 C94 42, 96 58, 78 64 Z" fill="#58cc02" />
      {/* Mắt nhắm thư giãn */}
      <path d="M36 48 Q42 53 48 48" fill="none" stroke="#3c3c3c" strokeWidth="3" strokeLinecap="round" />
      <path d="M56 48 Q62 53 68 48" fill="none" stroke="#3c3c3c" strokeWidth="3" strokeLinecap="round" />
      {/* Mỏ & chân cam */}
      <polygon points="48,53 56,53 52,60" fill="#ff9600" />
      <ellipse cx="42" cy="80" rx="6" ry="3.5" fill="#ff9600" />
      <ellipse cx="62" cy="80" rx="6" ry="3.5" fill="#ff9600" />
    </svg>
  );
}

/* Cú xanh Duo đứng vẫy tay cạnh chặng hiện tại */
function DuoCheerMascot() {
  return (
    <svg viewBox="0 0 100 100" width="82" height="82" aria-hidden="true">
      {/* Đế tròn xám */}
      <ellipse cx="50" cy="86" rx="32" ry="9" fill="#e5e5e5" />
      {/* Thân cú xanh */}
      <rect x="24" y="30" width="52" height="50" rx="24" fill="#58cc02" />
      {/* Bụng xanh nhạt */}
      <ellipse cx="50" cy="64" rx="17" ry="13" fill="#89e219" />
      {/* Hai cánh */}
      <path d="M25 46 C12 48, 12 66, 26 66 Z" fill="#46a302" />
      <path d="M75 46 C88 48, 88 66, 74 66 Z" fill="#46a302" />
      {/* Quầng mắt trắng */}
      <circle cx="39" cy="48" r="10" fill="#ffffff" />
      <circle cx="61" cy="48" r="10" fill="#ffffff" />
      {/* Con ngươi */}
      <circle cx="40" cy="48" r="5" fill="#3c3c3c" />
      <circle cx="60" cy="48" r="5" fill="#3c3c3c" />
      <circle cx="42" cy="46" r="1.8" fill="#ffffff" />
      <circle cx="62" cy="46" r="1.8" fill="#ffffff" />
      {/* Mỏ cam */}
      <polygon points="46,54 54,54 50,61" fill="#ff9600" />
      {/* Hai chân cam */}
      <ellipse cx="40" cy="82" rx="6" ry="3.5" fill="#ff9600" />
      <ellipse cx="60" cy="82" rx="6" ry="3.5" fill="#ff9600" />
    </svg>
  );
}

function SmallStars({ n }: { n: number }) {
  return (
    <div
      className="absolute left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full border-2 border-[#e5e5e5] bg-white px-2 py-0.5 shadow-sm"
      style={{ bottom: -16 }}
      aria-label={`${n} sao`}
    >
      {[1, 2, 3].map((i) => (
        <IconStar key={i} size={12} color={i <= n ? "#ffc800" : "#e5e5e5"} />
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
    timer.current = setTimeout(() => setHint(null), 2200);
  }

  if (!states || !groups) {
    return <p className="py-20 text-center text-sm font-bold text-[#afafaf]">Đang dựng lộ trình Duolingo...</p>;
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
  const todayXp = rawTodayXp > 0 ? rawTodayXp : 40; // Hiển thị 40/10 XP giống mẫu khi bắt đầu hoặc XP thật
  const dailyGoalXp = 10;
  const goalPct = Math.min(100, Math.round((todayXp / dailyGoalXp) * 100));

  // Dữ liệu 7 ngày (Nếu chưa có log thì hiển thị đường biểu đồ mẫu của Duolingo, khi học sẽ cộng XP thật vào)
  const fallbackCurve = [920, 45, 35, 140, 10, 15, 40];
  const chartDays = WEEK_LABELS.map((dayLabel, idx) => {
    const dKey = dayKey(new Date(now - (6 - idx) * DAY_MS));
    const dayXp = logs.filter((l) => l.day === dKey).reduce((a, l) => a + l.total * 10, 0);
    const val = logs.length > 0 ? dayXp : fallbackCurve[idx];
    return { label: dayLabel, val };
  });
  const maxChartVal = Math.max(920, ...chartDays.map((d) => d.val));

  // Bảng xếp hạng Classroom (Cập nhật điểm XP thật của bạn)
  const userTotalXp = Math.max(90, totalStars * 20 + wordsLearned * 4 + rawTodayXp);
  const leaderboard = [
    { name: "Jay", xp: 204, avatar: "🧑‍🎓", isMe: false },
    { name: "Bridgette", xp: 104, avatar: "👩‍💼", isMe: false },
    { name: "Steph", xp: 90, avatar: "👩‍🎨", isMe: false },
    { name: "Brown (Bạn)", xp: userTotalXp, avatar: "🦉", isMe: true },
  ]
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 4);

  const st = getEnStatus();
  const srcNote =
    st.source === "seed"
      ? `Đang dùng ${st.count} từ mẫu (${st.detail || "chưa kết nối bảng từ vựng"})`
      : `Đã tải ${st.count} từ vựng Oxford/IELTS (${st.source === "cache" ? "bản lưu máy" : "Supabase"})`;

  return (
    <main className="mx-auto w-full max-w-5xl pb-24 pt-2">
      {/* Thanh công cụ nhanh trên màn hình nhỏ (Mobile/Tablet) */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden no-scrollbar">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="relative flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-[#e5e5e5] bg-white px-3.5 py-2 text-xs font-extrabold text-[#3c3c3c] shadow-[0_3px_0_#e5e5e5] active:translate-y-0.5"
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
            {t.href === "/en/review" && dueN > 0 && <span className="en-badge">{dueN}</span>}
          </Link>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_350px]">
        {/* ================= CỘT TRÁI: LỘ TRÌNH DUOLINGO ================= */}
        <section className="mx-auto w-full max-w-[480px]">
          {groups.map((g, gi) => {
            const w = EN_WORLDS.find((x) => x.id === g.world);
            const t = themeOf(gi + 1);
            const done = g.items.filter((s) => s.stars > 0).length;
            // Mặc định mở tất cả các Unit để giống hệt Duolingo cuộn liền mạch
            const shown = open[g.world] ?? true;
            const isNextLockedUnit = gi > 0 && done === 0 && !g.items.some((s) => s.current);

            return (
              <div key={`w${g.world}`} className="mb-10">
                {/* Banner Unit (Xanh lá ở Unit 1, Tím ở Unit 2, Ngọc ở Unit 3...) */}
                <button
                  type="button"
                  onClick={() => setOpen({ ...open, [g.world]: !shown })}
                  aria-expanded={shown}
                  className="duo-unit-banner"
                  style={{ "--u-bg": t.bg, "--u-edge": t.edge } as CSSProperties}
                >
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-white">
                      Unit {gi + 1} · {w?.name ?? `Phần ${gi + 1}`}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-white/90">
                      {gi === 0
                        ? `Use core ${w?.tag ?? "B1"} vocabulary & sentence structures`
                        : gi === 1
                        ? `Talk about workplace, TOEIC situations & emails`
                        : `Master academic IELTS vocabulary & speaking topics`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-xl border-2 border-white/30 bg-black/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-white">
                    {done}/{g.items.length} {shown ? "▴" : "▾"}
                  </span>
                </button>

                {/* Nút "JUMP HERE?" ngay dưới Banner của Unit kế tiếp (giống ảnh mẫu Unit 92) */}
                {shown && isNextLockedUnit && g.items[0] && (
                  <div className="mt-6 -mb-4 flex flex-col items-center">
                    <Link
                      href={`/en/stage/${g.items[0].stage.id}`}
                      className="duo-start-bubble en-bob"
                      style={{ color: t.text }}
                    >
                      JUMP HERE?
                    </Link>
                  </div>
                )}

                {/* Các nút bài học uốn lượn theo hình chữ S */}
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

                      // Chọn biểu tượng bên trong nút giống Duolingo (Tích, Sách mở, Sao, Khóa, Cúp)
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
                          {/* Rương kho báu xen kẽ trên đường học giống ảnh mẫu Duolingo */}
                          {showChest && (
                            <div
                              className="relative mb-7 flex justify-center"
                              style={{ transform: `translateX(${Math.round(x * 0.5)}px)` }}
                            >
                              <Link
                                href={isDone || s.unlocked ? href : "/en/review"}
                                className="duo-chest"
                                title={isDone ? "Rương phần thưởng đã mở" : "Hoàn thành các chặng trên để mở rương"}
                              >
                                <DuoChest unlocked={isDone || s.unlocked} />
                              </Link>
                            </div>
                          )}

                          <div
                            id={s.current ? "en-current" : undefined}
                            className="relative flex justify-center"
                            style={{ marginBottom: 28, marginTop: s.current ? 24 : 0 }}
                          >
                            {/* Linh vật Cú xanh ngủ nghe nhạc ở khúc cua trên bên phải */}
                            {gi === 0 && idx === 2 && (
                              <div
                                className="pointer-events-none absolute hidden sm:block"
                                style={{ left: "calc(50% + 75px)", top: -12 }}
                              >
                                <DuoSleepingMascot />
                              </div>
                            )}

                            {/* Linh vật Cú xanh cổ vũ đứng cạnh chặng START hiện tại */}
                            {s.current && (
                              <div
                                className="pointer-events-none absolute hidden sm:block"
                                style={{
                                  left: x >= 0 ? "calc(50% - 155px)" : "calc(50% + 75px)",
                                  top: "50%",
                                  marginTop: -42,
                                }}
                              >
                                <div className="en-bob">
                                  <DuoCheerMascot />
                                </div>
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
                              {/* Bong bóng START nảy trên đầu chặng hiện tại */}
                              {s.current && (
                                <div
                                  className="absolute left-1/2 z-20 -translate-x-1/2"
                                  style={{ bottom: size + 24 }}
                                >
                                  <Link
                                    href={`/en/stage/${s.stage.id}`}
                                    className="duo-start-bubble en-bob"
                                    style={{ color: t.text }}
                                  >
                                    START
                                  </Link>
                                </div>
                              )}

                              {/* Nhãn nhắc Ôn lại (khi chặng hôm trước đến hạn nhớ lại) */}
                              {s.recallDue && (
                                <Link
                                  href={href}
                                  className="absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-xl border-2 border-[#e5a400] bg-[#ffc800] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#784800] shadow-sm"
                                  style={{ bottom: size + 10 }}
                                >
                                  ÔN LẠI
                                </Link>
                              )}

                              {/* Gợi ý khi bấm vào chặng đang khóa */}
                              {kind === "locked" && hint === s.stage.id && (
                                <div
                                  className="absolute left-1/2 z-30 -translate-x-1/2"
                                  style={{ bottom: size + 14 }}
                                >
                                  <div className="duo-start-bubble !text-xs !normal-case !tracking-normal !text-[#777777]">
                                    Hoàn thành chặng trước để mở khóa (hoặc bấm{" "}
                                    <Link
                                      href={`/en/stage/${s.stage.id}`}
                                      className="font-extrabold text-[#1cb0f6] underline"
                                    >
                                      Học thử ngay
                                    </Link>
                                    )
                                  </div>
                                </div>
                              )}

                              {/* Vòng tròn tiến độ vàng-xám bao quanh nút START hiện tại */}
                              {s.current && (
                                <svg
                                  viewBox="0 0 96 96"
                                  className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                                  aria-hidden="true"
                                >
                                  <circle
                                    cx="48"
                                    cy="48"
                                    r="43"
                                    fill="none"
                                    stroke="#e5e5e5"
                                    strokeWidth="6"
                                  />
                                  <circle
                                    cx="48"
                                    cy="48"
                                    r="43"
                                    fill="none"
                                    stroke="#ffc800"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeDasharray="180 270"
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
                                      "--edge": t.edge,
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

          {/* Nút tròn góc trái dưới giống ảnh mẫu Duolingo (luyện nghe / ôn tập nhanh) */}
          <div className="mt-4 flex items-center justify-between px-2">
            <Link
              href="/en/listen"
              title="Luyện nghe phản xạ"
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#e5e5e5] bg-white text-[#1cb0f6] shadow-[0_4px_0_#e5e5e5] hover:bg-gray-50 active:translate-y-0.5"
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 6.5 17.5 17.5" />
                <path d="M3 10l7-7M14 21l7-7M2 6l4-4M18 22l4-4" />
              </svg>
            </Link>
            <span className="text-xs font-bold text-[#afafaf]">{srcNote}</span>
          </div>
        </section>

        {/* ================= CỘT PHẢI: 4 WIDGET SIDEBAR DUOLINGO ================= */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {/* Card 1: My Assignments */}
          <div className="duo-widget">
            <h3 className="border-b-2 border-[#f0f0f0] pb-3 text-center text-lg font-extrabold text-[#3c3c3c]">
              My Assignments
            </h3>
            <Link
              href={cur ? `/en/stage/${cur.stage.id}` : "/en"}
              className="mt-4 flex items-center justify-between rounded-xl border-2 border-[#e5e5e5] px-4 py-3 transition hover:bg-[#f7f7f7]"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none">⚡</span>
                <div>
                  <p className="text-sm font-extrabold text-[#3c3c3c]">10 XP</p>
                  <p className="text-xs font-bold text-[#afafaf]">
                    {learnedToday ? "10/10 XP" : `${Math.min(rawTodayXp, 10)}/10 XP`}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#777777]">
                {learnedToday ? "Hoàn thành ✅" : `Chặng ${cur?.stage.n ?? 1} · Hôm nay`}
              </span>
            </Link>

            {due.length > 0 && (
              <Link
                href={`/en/stage/${due[0].stage.id}?recall=1`}
                className="mt-2.5 flex items-center justify-between rounded-xl border-2 border-[#ffc800] bg-[#fffbeb] px-4 py-2.5 text-xs font-extrabold text-[#a56800]"
              >
                <span>🔁 Ôn lại bài hôm trước (không gợi ý)</span>
                <span>
                  {recalledToday}/{recalledToday + due.length}
                </span>
              </Link>
            )}
          </div>

          {/* Card 2: Schools Team Classroom (Leaderboard) */}
          <div className="duo-widget">
            <div className="flex flex-col items-center border-b-2 border-[#f0f0f0] pb-4 text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-[#ffc800] text-2xl shadow-[0_3px_0_#e5a400]">
                ✏️
              </div>
              <h3 className="text-base font-extrabold text-[#3c3c3c]">Schools Team Classroom</h3>
              <p className="mt-0.5 text-xs font-extrabold text-[#ffc800]">
                3 days remaining · {wordsLearned}/{wordsTotal} từ ({totalStars} ⭐)
              </p>
            </div>

            <div className="mt-3 divide-y divide-[#f2f2f2]">
              {leaderboard.map((u, i) => {
                const rank = i + 1;
                const badgeCls =
                  rank === 1
                    ? "bg-[#ffc800] text-[#8a5a00]"
                    : rank === 2
                    ? "bg-[#e5e5e5] text-[#777777]"
                    : rank === 3
                    ? "bg-[#e5a45c] text-[#7c4a15]"
                    : "bg-[#f0f0f0] text-[#afafaf]";
                return (
                  <div
                    key={u.name}
                    className={`flex items-center justify-between py-2.5 ${
                      u.isMe ? "rounded-lg bg-[#f0fbe4] px-2 -mx-2" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold ${badgeCls}`}
                      >
                        {rank}
                      </span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#e5e5e5] bg-[#f7f7f7] text-lg">
                        {u.avatar}
                      </span>
                      <span className="text-sm font-extrabold text-[#3c3c3c]">{u.name}</span>
                    </div>
                    <span className="text-sm font-bold text-[#777777]">{u.xp} XP</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: XP Progress (Daily Goal + Biểu đồ đường 7 ngày) */}
          <div className="duo-widget">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#3c3c3c]">XP Progress</h3>
              <Link
                href="/en/skills"
                className="text-xs font-extrabold uppercase tracking-wider text-[#1cb0f6] hover:underline"
              >
                EDIT GOAL
              </Link>
            </div>

            <div className="mt-4 flex items-center gap-4">
              {/* Rương hồng ngọc giống ảnh mẫu Duolingo */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-[#ffc800] bg-[#fff4cc] text-3xl shadow-sm">
                🧰
              </div>
              <div className="flex-1">
                <p className="mb-1.5 text-xs font-bold text-[#777777]">Daily Goal</p>
                <div className="flex items-center gap-3">
                  <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-[#e5e5e5]">
                    <div
                      className="h-full rounded-full bg-[#ffc800] transition-all"
                      style={{ width: `${goalPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-[#777777]">
                    {todayXp}/{dailyGoalXp} XP
                  </span>
                </div>
              </div>
            </div>

            {/* Biểu đồ đường 7 ngày chuẩn mẫu (M Tu W Th F Sa Su) */}
            <div className="mt-6">
              <svg viewBox="0 0 280 120" className="h-28 w-full overflow-visible">
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
                      y={row.y + 4}
                      textAnchor="end"
                      className="fill-[#afafaf] text-[10px] font-bold"
                    >
                      {row.label}
                    </text>
                    <line x1="36" y1={row.y} x2="270" y2={row.y} stroke="#f0f0f0" strokeWidth="1.5" />
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
                      <polygon points={areaPoints} fill="#ffc800" opacity="0.14" />
                      <polyline
                        fill="none"
                        stroke="#ffc800"
                        strokeWidth="2.5"
                        points={polyPoints}
                      />
                      {pts.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="3.8" fill="#ffc800" />
                          <text
                            x={p.x}
                            y="115"
                            textAnchor="middle"
                            className="fill-[#afafaf] text-[10px] font-bold"
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
            <h3 className="text-lg font-extrabold text-[#3c3c3c]">Progress Quiz</h3>
            <div className="mt-3 flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1cb0f6] text-sm font-extrabold text-white shadow-[0_3px_0_#1899d6]">
                { (1.2 + (pct / 100) * 3.8).toFixed(1) }
              </div>
              <div>
                <p className="text-xs font-bold text-[#777777]">
                  {dueN > 0
                    ? `${dueN} thẻ từ vựng đến hạn ôn tập hôm nay`
                    : `Tiến độ từ vựng: ${pct}% (${wordsLearned}/${wordsTotal} từ)`}
                </p>
                <Link
                  href="/en/skills"
                  className="mt-0.5 inline-block text-xs font-extrabold uppercase tracking-wider text-[#1cb0f6] hover:underline"
                >
                  SEE HISTORY
                </Link>
              </div>
            </div>
            <Link
              href={dueN > 0 ? "/en/review" : cur ? `/en/stage/${cur.stage.id}` : "/en/games"}
              className="en-btn en-btn--blue mt-4"
            >
              TAKE A QUIZ
            </Link>
          </div>

          {/* Card 5: Các chế độ Luyện tập nhanh */}
          <div className="duo-widget">
            <h3 className="mb-3 text-base font-extrabold text-[#3c3c3c]">Luyện tập bổ trợ</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {TOOLS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="relative flex items-center gap-2 rounded-xl border-2 border-[#e5e5e5] bg-white px-3 py-2.5 text-xs font-extrabold text-[#3c3c3c] shadow-[0_3px_0_#e5e5e5] transition hover:bg-[#f7f7f7] active:translate-y-0.5"
                >
                  <span className="text-base">{t.emoji}</span>
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
