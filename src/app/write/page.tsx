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

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const showHintRef = useRef<boolean>(true);

  const current = list[index] ?? null;

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

    const writer = HanziWriter.create(el, target.hanzi, {
      width: size,
      height: size,
      padding: 12,
      showCharacter: false,
      showOutline: showHintRef.current,
      strokeColor: "#0f172a",
      outlineColor: "#cbd5e1",
      highlightColor: "#2563eb",
      drawingColor: "#0f172a",
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
        if (!cancelled) setStatus("nodata");
      },
    });
    writerRef.current = writer;

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

    return () => {
      cancelled = true;
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

  function handleDemo() {
    const w = writerRef.current;
    if (!w) return;
    try {
      w.cancelQuiz();
    } catch {
      // bỏ qua
    }
    void w.animateCharacter({
      onComplete: () => setAttempt((a) => a + 1),
    });
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
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Tập viết</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Viết từng nét theo đúng thứ tự và hướng. App kiểm tra ngay sau mỗi nét:
          nét đúng thì giữ lại, nét sai thì báo lỗi, sai 3 lần sẽ nhấp nháy gợi ý.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl bg-white p-4 sm:p-5 shadow-xs border border-slate-200 space-y-3">
          <div ref={wrapRef} className="w-full flex justify-center">
            {size > 0 && (
              <div
                className="relative rounded-xl border-2 border-rose-300 bg-white overflow-hidden"
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
              </div>
            )}
          </div>

          {status === "nodata" && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-sm text-amber-800">
              Chưa có dữ liệu nét cho chữ này (hoặc chưa tải được dữ liệu, cần có
              mạng). Bấm &ldquo;Sau&rdquo; để sang chữ khác.
            </div>
          )}

          {status === "ready" && !completed && (
            <p className="text-sm text-slate-600 text-center">
              Số lần sai nét: <b className="text-slate-900">{mistakes}</b>
            </p>
          )}

          {completed && (
            <div
              className={`rounded-xl border px-4 py-3 text-center space-y-2 ${
                mistakes === 0
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <p
                className={`text-base font-bold ${
                  mistakes === 0 ? "text-emerald-700" : "text-blue-700"
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
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Chữ tiếp theo →
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 sm:p-5 shadow-xs border border-slate-200 space-y-4">
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
              <div className="text-4xl font-bold text-slate-900">
                {current.hanzi}
              </div>
              {current.pinyin && (
                <div className="text-lg font-medium text-blue-600">
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
              disabled={!current || status !== "ready"}
              className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Xem nét mẫu
            </button>
            <button
              type="button"
              onClick={handleRetry}
              disabled={!current}
              className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
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
                className="h-5 w-5"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Chấm dễ tính (cho phép nét lệch hơn)</span>
              <input
                type="checkbox"
                checked={easy}
                onChange={(e) => setEasy(e.target.checked)}
                className="h-5 w-5"
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
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
                    source === "level" && level === lv
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
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
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleUseCustom}
                className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
                        i === index ? "ring-2 ring-blue-500" : ""
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
