"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import "@/components/en/en.css";
import { db } from "@/lib/db";
import { EN_WORLDS } from "@/lib/en/words";
import { getEnStatus, loadEnWords } from "@/lib/en/vocab";
import { countDue } from "@/lib/en/store";
import { dayKey } from "@/lib/tower";
import { STAGE_SIZE, buildStages, stageStates, type Prog, type StageState } from "@/lib/en/map";

// Màu từng thế giới (nền, viền đáy cho cảm giác nổi khối)
const WORLD_THEME = [
  { bg: "#22c55e", edge: "#15803d" },
  { bg: "#a855f7", edge: "#7e22ce" },
  { bg: "#0ea5e9", edge: "#0369a1" },
  { bg: "#f43f5e", edge: "#be123c" },
  { bg: "#f59e0b", edge: "#b45309" },
];
const themeOf = (world: number) => WORLD_THEME[(world - 1) % WORLD_THEME.length];

const TOOLS = [
  { href: "/en/vocab", emoji: "📚", label: "Từ vựng" },
  { href: "/en/review", emoji: "🔁", label: "Ôn tập" },
  { href: "/en/listen", emoji: "🎧", label: "Nghe" },
  { href: "/en/speak", emoji: "🎤", label: "Nói" },
  { href: "/en/games", emoji: "🎮", label: "Trò chơi" },
  { href: "/en/skills", emoji: "📊", label: "Kỹ năng" },
];

const NODE = 76;
const BOSS = 90;

// Đường đi uốn lượn kiểu 0, 44, 62, 44, 0, -44, -62, -44 (px)
function offsetOf(n: number, boss: boolean) {
  if (boss) return 0;
  return Math.round(Math.sin(((n - 1) * Math.PI) / 4) * 62);
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="38" height="38" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconStar({ size = 38, color = "currentColor" }: { size?: number; color?: string }) {
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
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
      <rect x="6" y="11" width="12" height="9" rx="2.2" fill="currentColor" />
      <path d="M8.5 11V8a3.5 3.5 0 017 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
function IconTrophy({ size = 42 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M7 4h10v4a5 5 0 01-10 0V4z" fill="currentColor" />
      <path d="M7 6H4.6a2.6 2.6 0 002.9 3.3M17 6h2.4a2.6 2.6 0 01-2.9 3.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="11" y="13" width="2" height="4" fill="currentColor" />
      <rect x="8" y="17" width="8" height="3" rx="1.2" fill="currentColor" />
    </svg>
  );
}

// Linh vật: nửa quả dưa hấu, đứng cạnh chặng hiện tại
function Mascot() {
  return (
    <svg viewBox="0 0 100 100" width="76" height="76" aria-hidden="true">
      <path d="M50 44c-1-9-7-14-14-14 1 8 7 13 14 14z" fill="#22c55e" />
      <path d="M50 44c1-9 7-14 14-14-1 8-7 13-14 14z" fill="#16a34a" />
      <path d="M8 46a42 42 0 0084 0z" fill="#15803d" />
      <path d="M12 46a38 38 0 0076 0z" fill="#f0fdf4" />
      <path d="M15 46a35 35 0 0070 0z" fill="#fb7185" />
      <ellipse cx="38" cy="60" rx="4.6" ry="5.4" fill="#3f1d2b" />
      <ellipse cx="62" cy="60" rx="4.6" ry="5.4" fill="#3f1d2b" />
      <circle cx="39.6" cy="58" r="1.6" fill="#fff" />
      <circle cx="63.6" cy="58" r="1.6" fill="#fff" />
      <circle cx="29" cy="68" r="4.4" fill="#f43f5e" opacity="0.45" />
      <circle cx="71" cy="68" r="4.4" fill="#f43f5e" opacity="0.45" />
      <path d="M44 68q6 7 12 0" fill="none" stroke="#3f1d2b" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="50" cy="52" rx="1.7" ry="2.6" fill="#3f1d2b" opacity="0.55" />
    </svg>
  );
}

function SmallStars({ n }: { n: number }) {
  return (
    <div
      className="absolute left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full bg-white px-2 py-1 shadow-md ring-1 ring-stone-200"
      style={{ bottom: -20 }}
      aria-label={`${n} sao`}
    >
      {[1, 2, 3].map((i) => (
        <IconStar key={i} size={15} color={i <= n ? "#f59e0b" : "#d6d3d1"} />
      ))}
    </div>
  );
}

interface Group {
  world: number;
  items: StageState[];
}

export default function EnMapPage() {
  const [states, setStates] = useState<StageState[] | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [dueN, setDueN] = useState(0);
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
        // chưa đọc được dữ liệu trong máy: coi như chưa có tiến độ
      }
      let dueCount = 0;
      try {
        dueCount = await countDue();
      } catch {
        // chưa đọc được thẻ ôn trong máy
      }
      if (alive) {
        setDueN(dueCount);
        setStates(stageStates(stages, progress, dayKey(new Date())));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (states) document.getElementById("en-current")?.scrollIntoView({ block: "center" });
  }, [states]);

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
    return <p className="py-20 text-center text-sm text-stone-500">Đang dựng bản đồ...</p>;
  }

  const today = dayKey(new Date());
  const totalStars = states.reduce((a, s) => a + s.stars, 0);
  const due = states.filter((s) => s.recallDue);
  const recalledToday = states.filter((s) => s.prog?.recallOn === today).length;
  const learnedToday = states.some((s) => s.prog?.doneOn === today);
  const cur = states.find((s) => s.current);
  const normal = states.filter((s) => !s.stage.boss);
  const wordsTotal = normal.reduce((a, s) => a + s.stage.wordIds.length, 0);
  const wordsLearned = normal.filter((s) => s.stars > 0).reduce((a, s) => a + s.stage.wordIds.length, 0);
  const pct = wordsTotal > 0 ? Math.round((wordsLearned / wordsTotal) * 100) : 0;
  const st = getEnStatus();
  const srcText =
    st.source === "seed"
      ? `Đang dùng ${st.count} từ mẫu vì chưa đọc được bảng từ vựng: ${st.detail}`
      : `Từ vựng: ${st.count} từ${st.source === "cache" ? " (bản lưu trong máy)" : " từ Supabase"}.${
          st.detail ? ` Ghi chú: ${st.detail}.` : ""
        }${st.noVi > 0 ? ` ${st.noVi} từ chưa có nghĩa tiếng Việt, đang hiện định nghĩa tiếng Anh.` : ""}`;

  const card = "rounded-2xl border-2 border-b-4 border-stone-200 bg-white p-4";
  const task = "flex items-center justify-between gap-3 rounded-xl border-2 border-stone-200 px-3 py-2.5 text-sm";

  return (
    <main className="mx-auto w-full max-w-4xl pb-20 pt-2">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="mx-auto w-full max-w-[420px]">
          {groups.map((g, gi) => {
            const w = EN_WORLDS.find((x) => x.id === g.world);
            const t = themeOf(gi + 1);
            const done = g.items.filter((s) => s.stars > 0).length;
            const forced = g.items.some((s) => s.current) || (!cur && gi === groups.length - 1);
            const shown = open[g.world] ?? forced;
            return (
              <div key={`w${g.world}`} className="mb-6">
                <button
                  type="button"
                  onClick={() => setOpen({ ...open, [g.world]: !shown })}
                  aria-expanded={shown}
                  className="block w-full rounded-2xl px-4 py-3 text-left text-white"
                  style={{ background: t.bg, boxShadow: `0 5px 0 ${t.edge}` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-widest text-white/80">
                        Phần {gi + 1} · {w?.tag}
                      </p>
                      <h2 className="text-lg font-extrabold leading-tight">
                        {w?.emoji} {w?.name}
                      </h2>
                    </div>
                    <span className="rounded-xl bg-white/20 px-2.5 py-1 text-sm font-extrabold">
                      {done}/{g.items.length} {shown ? "▴" : "▾"}
                    </span>
                  </div>
                </button>

                <div className="pt-12" hidden={!shown}>
                  {shown && g.items.map((s) => {
                    const boss = s.stage.boss;
                    const size = boss ? BOSS : NODE;
                    const x = offsetOf(s.stage.n, boss);
                    const th = t;
                    const isDone = s.unlocked && s.stars > 0;
                    const kind = !s.unlocked ? "locked" : isDone ? "done" : "current";
                    const href = s.recallDue ? `/en/stage/${s.stage.id}?recall=1` : `/en/stage/${s.stage.id}`;
                    const faceStyle: CSSProperties | undefined =
                      kind === "current" ? ({ "--face": th.bg, "--edge": th.edge } as CSSProperties) : undefined;
                    const cls = `en-node en-node--${kind}`;
                    const icon =
                      kind === "locked" ? (
                        boss ? <IconTrophy /> : <IconLock />
                      ) : boss ? (
                        <IconTrophy />
                      ) : kind === "done" ? (
                        <IconCheck />
                      ) : (
                        <IconStar />
                      );
                    const off = x >= 0 ? -118 : 118;

                    return (
                      <div
                        key={s.stage.id}
                        id={s.current ? "en-current" : undefined}
                        className="relative flex justify-center"
                        style={{ marginBottom: 42, marginTop: s.current ? 40 : 0 }}
                      >
                        <div className="relative" style={{ transform: `translateX(${x}px)`, width: size, height: size }}>
                          {s.current && (
                            <div className="absolute left-1/2 z-10 -translate-x-1/2" style={{ bottom: size + 18 }}>
                              <Link href={`/en/stage/${s.stage.id}`} className="en-bubble en-bob" style={{ color: th.edge }}>
                                BẮT ĐẦU
                              </Link>
                            </div>
                          )}
                          {s.recallDue && (
                            <Link
                              href={href}
                              className="absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-md"
                              style={{ bottom: size + 12 }}
                            >
                              Ôn lại
                            </Link>
                          )}
                          {kind === "locked" && hint === s.stage.id && (
                            <div className="absolute left-1/2 z-20 -translate-x-1/2" style={{ bottom: size + 18 }}>
                              <div className="en-bubble text-stone-500" style={{ letterSpacing: 0, fontWeight: 700 }}>
                                Hoàn thành chặng trước để mở khóa
                              </div>
                            </div>
                          )}

                          {kind === "locked" ? (
                            <button
                              type="button"
                              onClick={() => showHint(s.stage.id)}
                              aria-label="Chặng đang khóa"
                              className={`${cls} ${hint === s.stage.id ? "en-shake" : ""}`}
                              style={{ width: size, height: size }}
                            >
                              {icon}
                            </button>
                          ) : (
                            <Link
                              href={kind === "current" ? `/en/stage/${s.stage.id}` : href}
                              aria-label={boss ? "Chặng boss" : `Chặng ${s.stage.n}`}
                              className={cls}
                              style={{ ...faceStyle, width: size, height: size }}
                            >
                              {kind === "current" && <span className="en-ring" />}
                              {icon}
                            </Link>
                          )}
                          {isDone && <SmallStars n={s.stars} />}
                        </div>

                        {s.current && (
                          <div
                            className="pointer-events-none absolute"
                            style={{ left: `calc(50% + ${off}px - 38px)`, top: "50%", marginTop: -38 }}
                          >
                            <div className="en-bob">
                              <Mascot />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        <aside className="space-y-4 max-lg:order-first lg:sticky lg:top-24 lg:self-start">
          <div className={card}>
            <h2 className="mb-3 text-base font-extrabold text-stone-800">Việc hôm nay</h2>
            <div className="space-y-2">
              {due.length + recalledToday > 0 && (
                <Link href={due[0] ? `/en/stage/${due[0].stage.id}?recall=1` : "/en"} className={task}>
                  <span className="font-bold text-stone-700">
                    {due.length === 0 ? "✅" : "⬜"} Ôn lại bài hôm trước, không gợi ý
                  </span>
                  <span className="text-xs font-bold text-stone-400">
                    {recalledToday}/{recalledToday + due.length}
                  </span>
                </Link>
              )}
              <Link href={cur ? `/en/stage/${cur.stage.id}` : "/en"} className={task}>
                <span className="font-bold text-stone-700">
                  {learnedToday ? "✅" : "⬜"} Học {STAGE_SIZE} từ mới và dùng ngay trong câu
                </span>
                <span className="text-xs font-bold text-stone-400">{learnedToday ? "1/1" : "0/1"}</span>
              </Link>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-stone-500">
              3 sao của mỗi bài: hoàn thành, dùng được trong câu, nhớ lại được vào hôm sau.
            </p>
          </div>

          <div className={card}>
            <h2 className="mb-3 text-base font-extrabold text-stone-800">Tiến độ</h2>
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-bold text-stone-700">
                {wordsLearned}/{wordsTotal} từ
              </span>
              <span className="font-extrabold text-amber-600">{totalStars} ⭐</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-stone-500">{srcText}</p>
          </div>

          <div className={card}>
            <h2 className="mb-3 text-base font-extrabold text-stone-800">Luyện tập</h2>
            <div className="grid grid-cols-2 gap-3">
              {TOOLS.map((t, k) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`relative flex items-center gap-2 rounded-xl border-2 border-b-4 border-stone-200 px-3 py-3 text-sm font-extrabold text-stone-700 ${
                    k === TOOLS.length - 1 && TOOLS.length % 2 === 1 ? "col-span-2" : ""
                  }`}
                >
                  <span className="text-xl">{t.emoji}</span>
                  {t.label}
                  {t.href === "/en/review" && dueN > 0 && (
                    <span className="absolute -right-1.5 -top-2 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
                      {dueN}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
