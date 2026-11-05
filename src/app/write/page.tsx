"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { createClient } from "@/lib/supabase/client";

interface PracticeChar {
  hanzi: string;
  pinyin: string;
  meaning: string;
}

interface RawRow {
  hanzi_simp: string;
  pinyin: string;
  word_meanings_en: { text: string; sort_order: number }[] | null;
}

type Status = "loading" | "ready" | "nodata";

const MAX_CHARS = 30;
const DEMO_ROUNDS = 3;
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function WritePage() {
  const supabase = useMemo(() => createClient(), []);

  const [level, setLevel] = useState<number>(1);
  const [source, setSource] = useState<"level" | "custom">("level");
  const [list, setList] = useState<PracticeChar[]>([]);
  const [index, setIndex] = useState<number>(0);
  const [listLoading, setListLoading] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);

  const [showHint, setShowHint] = useState<boolean>(true);
  const [easy, setEasy] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>("");

  const [size, setSize] = useState<number>(0);
  const [attempt, setAttempt] = useState<number>(0);
  const [status, setStatus] = useState<Status>("loading");
  const [mistakes, setMistakes] = useState<number>(0);
  const [completed, setCompleted] = useState<boolean>(false);
  const [results, setResults] = useState<Record<string, number>>({});

  const [demoRound, setDemoRound] = useState<number>(0);
  const [turnMsg, setTurnMsg] = useState<boolean>(false);
  const [autoDemo, setAutoDemo] = useState<boolean>(true);

  const autoDemoRef = useRef<boolean>(true);
  const forceDemoRef = useRef<boolean>(false);
  const skipRef = useRef<(() => void) | null>(null);
  const lastListRef = useRef<PracticeChar[] | null>(null);
  const lastIndexRef = useRef<number>(-1);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const showHintRef = useRef<boolean>(true);

  const current = list[index] ?? null;

  // Nhớ lựa chọn "tự mô phỏng" (chỉ là cài đặt giao diện)
  useEffect(() => {
    try {
      if (localStorage.getItem("write.autoDemo") === "0") {
        autoDemoRef.current = false;
        setAutoDemo(false);
      }
    } catch {
      // bỏ qua
    }
  }, []);

  function toggleAutoDemo(v: boolean) {
    setAutoDemo(v);
    autoDemoRef.current = v;
    try {
      localStorage.setItem("write.autoDemo", v ? "1" : "0");
    } catch {
      // bỏ qua
    }
  }

  // Đo bề rộng bảng viết (vuông, tối đa 460px)
  useEffect(() => {
    function measure() {
      const w = wrapRef.current?.clientWidth ?? 0;
      if (w > 0) setSize(Math.floor(Math.min(w, 460)));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Tải danh sách chữ đơn theo cấp HSK 3.0
  const loadLevelList = useCallback(
    async (lv: number) => {
      setListLoading(true);
      setListError(null);
      try {
        const res = await supabase
          .from("words")
          .select("hanzi_simp, pinyin, word_meanings_en(text, sort_order)")
          .eq("hsk_new_level", lv)
          .like("hanzi_simp", "_")
          .order("frequency_rank", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true })
          .limit(200);
        if (res.error) {
          setListError("Chưa tải được danh sách chữ. Hãy thử lại sau ít giây.");
          setListLoading(false);
          return;
        }
        const rows = (res.data ?? []) as unknown as RawRow[];
        const map = new Map<string, PracticeChar>();
        for (const r of rows) {
          if (!CJK.test(r.hanzi_simp)) continue;
          const meanings = [...(r.word_meanings_en ?? [])]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((m) => m.text);
          const existing = map.get(r.hanzi_simp);
          if (existing) {
            if (!existing.pinyin.split(" / ").includes(r.pinyin)) {
              existing.pinyin += " / " + r.pinyin;
            }
          } else {
            map.set(r.hanzi_simp, {
              hanzi: r.hanzi_simp,
              pinyin: r.pinyin,
              meaning: (meanings[0] ?? "").slice(0, 80),
            });
          }
        }
        const items = Array.from(map.values()).slice(0, MAX_CHARS);
        setList(items);
        setIndex(0);
        setResults({});
        setSource("level");
        if (items.length === 0) {
          setListError("Cấp này chưa có chữ đơn để luyện viết.");
        }
      } catch {
        setListError("Không thể kết nối mạng để tải danh sách chữ.");
      } finally {
        setListLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void loadLevelList(1);
  }, [loadLevelList]);

  // Tạo bảng viết Hanzi Writer cho chữ hiện tại và bật chế độ kiểm tra từng nét
  useEffect(() => {
    const el = boardRef.current;
    const target = list[index];
    if (!el || !target || size === 0) return;

    let cancelled = false;
    el.innerHTML = "";
    setStatus("loading");
    setMistakes(0);
    setCompleted(false);
    setDemoRound(0);
    setTurnMsg(false);

    const writer = HanziWriter.create(el, target.hanzi, {
      width: size,
      height: size,
      padding: 12,
      showCharacter: false,
      showOutline: showHintRef.current,
      strokeColor: "#2b1a1f",
      outlineColor: "#f0b4c0",
      highlightColor: "#16a34a",
      drawingColor: "#2b1a1f",
      drawingWidth: 8,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 150,
      showHintAfterMisses: 3,
      highlightOnComplete: true,
      leniency: easy ? 1.6 : 1,
      onLoadCharDataSuccess: () => {
        if (!cancelled) setStatus("ready");
      },
      onLoadCharDataError: () => {
        if (!cancelled) {
          setStatus("nodata");
          setDemoRound(0);
        }
      },
    });
    writerRef.current = writer;

    // Chữ mới (hoặc bấm "Xem lại") thì mô phỏng 3 lần trước, rồi mới đến lượt người dùng viết
    const doDemo =
      forceDemoRef.current ||
      (autoDemoRef.current &&
        (lastListRef.current !== list || lastIndexRef.current !== index));
    lastListRef.current = list;
    lastIndexRef.current = index;
    forceDemoRef.current = false;

    const timers: number[] = [];
    let phase: "demo" | "quiz" = doDemo ? "demo" : "quiz";

    const startQuiz = (fromDemo: boolean) => {
      if (cancelled) return;
      phase = "quiz";
      skipRef.current = null;
      setDemoRound(0);
      writer.quiz({
        leniency: easy ? 1.6 : 1,
        onMistake: () => {
          if (!cancelled) setMistakes((m) => m + 1);
        },
        onComplete: (summary: { totalMistakes: number }) => {
          if (cancelled) return;
          setCompleted(true);
          setResults((prev) => ({
            ...prev,
            [target.hanzi]: summary.totalMistakes,
          }));
        },
      });
      if (fromDemo) {
        setTurnMsg(true);
        timers.push(window.setTimeout(() => setTurnMsg(false), 3500));
      }
    };

    const runRound = (round: number) => {
      if (cancelled || phase !== "demo") return;
      setDemoRound(round);
      void writer.animateCharacter({
        onComplete: (res?: { canceled?: boolean }) => {
          if (cancelled || phase !== "demo" || res?.canceled) return;
          if (round < DEMO_ROUNDS) {
            timers.push(window.setTimeout(() => runRound(round + 1), 900));
          } else {
            timers.push(window.setTimeout(() => startQuiz(true), 800));
          }
        },
      });
    };

    if (doDemo) {
      skipRef.current = () => {
        if (phase !== "demo") return;
        timers.forEach((t) => window.clearTimeout(t));
        startQuiz(true);
      };
      runRound(1);
    } else {
      startQuiz(false);
    }

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      skipRef.current = null;
      try {
        writer.cancelQuiz();
      } catch {
        // bỏ qua
      }
      el.innerHTML = "";
      writerRef.current = null;
    };
  }, [list, index, size, attempt, easy]);

  // Bật/tắt nét mờ gợi ý mà không làm mất tiến độ đang viết
  useEffect(() => {
    showHintRef.current = showHint;
    const w = writerRef.current;
    if (!w) return;
    if (showHint) w.showOutline();
    else w.hideOutline();
  }, [showHint]);

  function handleRetry() {
    setAttempt((a) => a + 1);
  }

  // "Xem lại": dựng lại bảng và mô phỏng 3 lần, rồi trả về chế độ tự viết
  function handleDemo() {
    forceDemoRef.current = true;
    setAttempt((a) => a + 1);
  }

  function handleUseCustom() {
    const chars = Array.from(new Set(Array.from(customText))).filter((c) =>
      CJK.test(c)
    );
    if (chars.length === 0) return;
    setList(
      chars.slice(0, MAX_CHARS).map((c) => ({ hanzi: c, pinyin: "", meaning: "" }))
    );
    setIndex(0);
    setResults({});
    setSource("custom");
    setListError(null);
  }

  function handleShuffle() {
    setList((prev) => shuffled(prev));
    setIndex(0);
    setResults({});
  }

  const doneCount = Object.keys(results).length;

  return (
    <main className="space-y-4 pb-8">
      <section className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Tập viết</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Xem mô phỏng 3 lần rồi tự viết theo. App kiểm tra ngay sau mỗi nét:
          nét đúng thì giữ lại, nét sai thì báo lỗi, sai 3 lần sẽ nhấp nháy gợi ý.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="p-4 sm:p-5 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-3">
          <div ref={wrapRef} className="w-full flex justify-center">
            {size > 0 && (
              <div
                className="relative rounded-3xl border-2 border-rose-300/80 bg-white/90 overflow-hidden shadow-[0_8px_30px_rgb(244,63,94,0.10)]"
                style={{ width: size, height: size, touchAction: "none" }}
              >
                <svg
                  className="absolute inset-0 pointer-events-none"
                  width={size}
                  height={size}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <g stroke="#fda4af" strokeWidth="0.4" strokeDasharray="2 2">
                    <line x1="50" y1="0" x2="50" y2="100" />
                    <line x1="0" y1="50" x2="100" y2="50" />
                    <line x1="0" y1="0" x2="100" y2="100" />
                    <line x1="100" y1="0" x2="0" y2="100" />
                  </g>
                </svg>
                <div
                  ref={boardRef}
                  className="relative"
                  style={{ width: size, height: size, touchAction: "none" }}
                />
                {demoRound > 0 && (
                  <div
                    role="presentation"
                    onPointerDown={() => skipRef.current?.()}
                    className="absolute inset-0 z-10 cursor-pointer"
                    style={{ touchAction: "none" }}
                  />
                )}
              </div>
            )}
          </div>

          {status === "nodata" && (
            <div className="rounded-2xl bg-amber-50/90 border border-amber-200 px-3.5 py-2.5 text-sm text-amber-800">
              Chưa có dữ liệu nét cho chữ này (hoặc chưa tải được dữ liệu, cần có
              mạng). Bấm &ldquo;Sau&rdquo; để sang chữ khác.
            </div>
          )}

          {demoRound > 0 && (
            <div className="flex flex-col items-center gap-1.5 anim-fade-in">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: DEMO_ROUNDS }).map((_, k) => (
                  <span
                    key={k}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      k < demoRound ? "bg-rose-500" : "bg-rose-200"
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-slate-600 text-center">
                Đang mô phỏng lần {demoRound}/{DEMO_ROUNDS}. Chạm vào khung để
                bỏ qua và viết luôn.
              </p>
            </div>
          )}

          {demoRound === 0 && status === "ready" && !completed && (
            <div className="space-y-1 text-center">
              {turnMsg && (
                <p className="anim-pop text-sm font-bold text-emerald-700">
                  Đến lượt bạn rồi, viết theo nét mẫu nhé!
                </p>
              )}
              <p className="text-sm text-slate-600">
                Số lần sai nét: <b className="text-slate-900">{mistakes}</b>
              </p>
            </div>
          )}

          {completed && (
            <div
              className={`rounded-2xl border px-4 py-3 text-center space-y-2 ${
                mistakes === 0
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-indigo-50/90 border-indigo-200"
              }`}
            >
              <p
                className={`text-base font-bold ${
                  mistakes === 0 ? "text-emerald-700" : "text-indigo-700"
                }`}
              >
                {mistakes === 0
                  ? "Chuẩn! Viết đúng hết, không sai nét nào."
                  : `Hoàn thành, sai ${mistakes} lần. Viết lại để đạt 0 lỗi nhé.`}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-xl bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Viết lại
                </button>
                {index < list.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setIndex((i) => i + 1)}
                    className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20"
                  >
                    Chữ tiếp theo →
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="p-4 sm:p-5 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-4">
          {listLoading ? (
            <p className="text-sm text-slate-500">Đang tải danh sách chữ...</p>
          ) : current ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  Chữ {index + 1}/{list.length} · đã xong {doneCount}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => i - 1)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                  >
                    ← Trước
                  </button>
                  <button
                    type="button"
                    disabled={index >= list.length - 1}
                    onClick={() => setIndex((i) => i + 1)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                  >
                    Sau →
                  </button>
                </div>
              </div>
              <div className="font-hanzi text-4xl font-bold text-slate-900">
                {current.hanzi}
              </div>
              {current.pinyin && (
                <div className="text-lg font-medium text-indigo-600">
                  {current.pinyin}
                </div>
              )}
              {current.meaning && (
                <div className="text-sm text-slate-600">{current.meaning}</div>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-700">
              {listError ?? "Chưa có chữ để luyện."}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDemo}
              disabled={!current || status !== "ready" || demoRound > 0}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 disabled:opacity-50"
            >
              Xem lại 3 lần
            </button>
            <button
              type="button"
              onClick={handleRetry}
              disabled={!current}
              className="rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              Xóa / Viết lại
            </button>
          </div>

          <div className="space-y-2 text-sm text-slate-700">
            <label className="flex items-center justify-between gap-3">
              <span>Hiện chữ mẫu mờ</span>
              <input
                type="checkbox"
                checked={showHint}
                onChange={(e) => setShowHint(e.target.checked)}
                className="h-5 w-5 accent-rose-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Tự mô phỏng 3 lần khi sang chữ mới</span>
              <input
                type="checkbox"
                checked={autoDemo}
                onChange={(e) => toggleAutoDemo(e.target.checked)}
                className="h-5 w-5 accent-rose-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Chấm dễ tính (cho phép nét lệch hơn)</span>
              <input
                type="checkbox"
                checked={easy}
                onChange={(e) => setEasy(e.target.checked)}
                className="h-5 w-5 accent-rose-500"
              />
            </label>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-xs font-medium text-slate-600">
              Lấy chữ đơn theo cấp HSK 3.0 (tối đa {MAX_CHARS} chữ, theo độ phổ
              biến):
            </p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => {
                    setLevel(lv);
                    void loadLevelList(lv);
                  }}
                  className={`px-3 py-1.5 rounded-2xl text-sm font-medium transition ${
                    source === "level" && level === lv
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20"
                      : "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                  }`}
                >
                  HSK {lv}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleShuffle}
              disabled={list.length < 2}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
            >
              Xáo trộn thứ tự
            </button>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-xs font-medium text-slate-600">
              Hoặc tự nhập chữ Hán muốn tập (nhiều chữ cũng được):
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Ví dụ: 你好吗"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleUseCustom}
                className="shrink-0 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20"
              >
                Dùng chữ này
              </button>
            </div>
          </div>

          {list.length > 0 && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="text-xs font-medium text-slate-600">
                Tiến độ (xanh: 0 lỗi, vàng: có sai nét):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((c, i) => {
                  const r = results[c.hanzi];
                  const tone =
                    r === undefined
                      ? "bg-slate-50 text-slate-700 border-slate-200"
                      : r === 0
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-amber-100 text-amber-800 border-amber-300";
                  return (
                    <button
                      key={c.hanzi}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={`h-9 w-9 rounded-lg border text-lg font-semibold ${tone} ${
                        i === index ? "ring-2 ring-rose-500" : ""
                      }`}
                    >
                      {c.hanzi}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
