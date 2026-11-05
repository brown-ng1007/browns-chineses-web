"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { WordsResponse } from "@/types/database.types";

// Tập viết bằng Pointer Events (Apple Pencil, ngón tay, chuột).
// Bản đầu: không chấm điểm nét, không lưu nét.

interface Pt {
  x: number; // tọa độ chuẩn hóa 0..1 để giữ nguyên khi đổi kích thước
  y: number;
  p: number; // áp lực 0..1
}
type Stroke = Pt[];

interface WordInfo {
  hanzi: string;
  pinyin: string;
  meaning: string;
}

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;
const FONT_STACK =
  '"Kaiti SC","STKaiti","KaiTi","PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
const INK = "#0f172a";
const MIN_DIST = 0.0012;

function extractChars(text: string): string[] {
  return Array.from(text.match(CJK_RE) ?? []);
}

function widthFor(p: number, size: number): number {
  return size * (0.008 + 0.022 * p);
}

function mid(a: Pt, b: Pt, size: number): { x: number; y: number } {
  return { x: ((a.x + b.x) / 2) * size, y: ((a.y + b.y) / 2) * size };
}

function styleInk(ctx: CanvasRenderingContext2D) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
}

// Vẽ đoạn kết thúc tại điểm thứ i (làm mượt bằng đường cong bậc hai qua trung điểm)
function drawSegment(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  i: number,
  size: number
) {
  styleInk(ctx);
  const cur = stroke[i];
  const prev = stroke[i - 1];
  ctx.lineWidth = widthFor((cur.p + prev.p) / 2, size);
  ctx.beginPath();
  if (i === 1) {
    const m = mid(prev, cur, size);
    ctx.moveTo(prev.x * size, prev.y * size);
    ctx.lineTo(m.x, m.y);
  } else {
    const before = stroke[i - 2];
    const m0 = mid(before, prev, size);
    const m1 = mid(prev, cur, size);
    ctx.moveTo(m0.x, m0.y);
    ctx.quadraticCurveTo(prev.x * size, prev.y * size, m1.x, m1.y);
  }
  ctx.stroke();
}

// Đoạn cuối: từ trung điểm đến điểm cuối cùng
function drawTail(ctx: CanvasRenderingContext2D, stroke: Stroke, size: number) {
  const n = stroke.length;
  if (n < 2) return;
  styleInk(ctx);
  const last = stroke[n - 1];
  const m = mid(stroke[n - 2], last, size);
  ctx.lineWidth = widthFor(last.p, size);
  ctx.beginPath();
  ctx.moveTo(m.x, m.y);
  ctx.lineTo(last.x * size, last.y * size);
  ctx.stroke();
}

function drawDot(ctx: CanvasRenderingContext2D, pt: Pt, size: number) {
  styleInk(ctx);
  ctx.beginPath();
  ctx.arc(pt.x * size, pt.y * size, widthFor(pt.p, size) / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, size: number) {
  if (stroke.length === 0) return;
  if (stroke.length === 1) {
    drawDot(ctx, stroke[0], size);
    return;
  }
  for (let i = 1; i < stroke.length; i++) drawSegment(ctx, stroke, i, size);
  drawTail(ctx, stroke, size);
}

function setupCanvas(
  canvas: HTMLCanvasElement,
  size: number
): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// Ô điền tự (田字格) và chữ mẫu mờ
function drawGuide(
  ctx: CanvasRenderingContext2D,
  size: number,
  ch: string,
  showGhost: boolean
) {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "#fda4af";
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);

  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.moveTo(0, 0);
  ctx.lineTo(size, size);
  ctx.moveTo(size, 0);
  ctx.lineTo(0, size);
  ctx.stroke();
  ctx.setLineDash([]);

  if (showGhost && ch) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.13)";
    ctx.font = `${Math.round(size * 0.78)}px ${FONT_STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, size / 2, size / 2 + size * 0.03);
  }
}

export default function WritePage() {
  const [chars, setChars] = useState<string[]>(["永"]);
  const [idx, setIdx] = useState<number>(0);
  const [wordInfo, setWordInfo] = useState<WordInfo | null>(null);
  const [showGhost, setShowGhost] = useState<boolean>(true);
  const [penOnly, setPenOnly] = useState<boolean>(false);
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const [size, setSize] = useState<number>(0);
  const [manualText, setManualText] = useState<string>("");
  const [loadingWord, setLoadingWord] = useState<boolean>(false);
  const [wordError, setWordError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLCanvasElement | null>(null);
  const inkRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const penSeenRef = useRef<boolean>(false);

  const ch = chars[idx] ?? "";

  // Đo kích thước ô viết theo bề rộng khung
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize(Math.floor(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Vẽ lưới và chữ mẫu
  useEffect(() => {
    const canvas = guideRef.current;
    if (!canvas || size === 0) return;
    const ctx = setupCanvas(canvas, size);
    if (ctx) drawGuide(ctx, size, ch, showGhost);
  }, [size, ch, showGhost]);

  // Vẽ lại toàn bộ nét viết
  const redrawInk = useCallback(() => {
    const canvas = inkRef.current;
    if (!canvas || size === 0) return;
    const ctx = setupCanvas(canvas, size);
    if (!ctx) return;
    for (const s of strokesRef.current) drawStroke(ctx, s, size);
  }, [size]);

  useEffect(() => {
    redrawInk();
  }, [redrawInk]);

  function resetStrokes() {
    strokesRef.current = [];
    currentRef.current = null;
    activePointerRef.current = null;
    setStrokeCount(0);
    redrawInk();
  }

  function undoStroke() {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    redrawInk();
  }

  function goToChar(next: number) {
    if (next < 0 || next >= chars.length) return;
    strokesRef.current = [];
    currentRef.current = null;
    activePointerRef.current = null;
    setStrokeCount(0);
    setIdx(next);
    // Ô viết được xóa ngay; lưới/chữ mẫu tự vẽ lại theo chữ mới
    const canvas = inkRef.current;
    if (canvas && size > 0) setupCanvas(canvas, size);
  }

  function applyManual() {
    const list = extractChars(manualText);
    if (list.length === 0) {
      setWordError("Hãy nhập ít nhất một chữ Hán.");
      return;
    }
    setWordError(null);
    setWordInfo(null);
    setChars(list);
    goToChar(0);
    setIdx(0);
  }

  async function pickRandomWord(level: number) {
    setLoadingWord(true);
    setWordError(null);
    try {
      const tryFetch = async (cursor: string | null) => {
        const params = new URLSearchParams({ version: "new", level: String(level) });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/words?${params.toString()}`);
        if (!res.ok) throw new Error("http");
        return (await res.json()) as WordsResponse;
      };

      let data = await tryFetch(String(50 * Math.floor(Math.random() * 3)));
      if (data.words.length === 0) data = await tryFetch(null);
      if (data.words.length === 0) throw new Error("empty");

      const w = data.words[Math.floor(Math.random() * data.words.length)];
      const list = extractChars(w.hanzi_simp);
      if (list.length === 0) throw new Error("nochar");

      setWordInfo({
        hanzi: w.hanzi_simp,
        pinyin: w.pinyin,
        meaning: w.meanings_en[0]?.text ?? "",
      });
      setChars(list);
      goToChar(0);
      setIdx(0);
    } catch {
      setWordError(
        "Chưa lấy được từ ngẫu nhiên. Cần có mạng; bạn vẫn có thể tự nhập chữ Hán ở ô bên dưới."
      );
    } finally {
      setLoadingWord(false);
    }
  }

  function acceptPointer(e: ReactPointerEvent<HTMLCanvasElement>): boolean {
    if (e.pointerType === "pen") {
      penSeenRef.current = true;
      return true;
    }
    if (e.pointerType === "touch" && (penOnly || penSeenRef.current)) {
      return false; // bỏ qua lòng bàn tay / ngón tay
    }
    return true;
  }

  function toPoint(ev: PointerEvent, canvas: HTMLCanvasElement): Pt {
    const rect = canvas.getBoundingClientRect();
    const raw = ev.pressure > 0 ? ev.pressure : 0.5;
    return {
      x: (ev.clientX - rect.left) / rect.width,
      y: (ev.clientY - rect.top) / rect.height,
      p: Math.min(1, Math.max(0.05, raw)),
    };
  }

  function handleDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!acceptPointer(e)) return;
    if (activePointerRef.current !== null) return;
    const canvas = e.currentTarget;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Bỏ qua nếu trình duyệt không hỗ trợ
    }
    activePointerRef.current = e.pointerId;
    const pt = toPoint(e.nativeEvent, canvas);
    currentRef.current = [pt];
    const ctx = canvas.getContext("2d");
    if (ctx) drawDot(ctx, pt, size);
    e.preventDefault();
  }

  function handleMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointerRef.current) return;
    const stroke = currentRef.current;
    if (!stroke) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const native = e.nativeEvent as PointerEvent & {
      getCoalescedEvents?: () => PointerEvent[];
    };
    const coalesced =
      typeof native.getCoalescedEvents === "function"
        ? native.getCoalescedEvents()
        : [];
    const events = coalesced.length > 0 ? coalesced : [native];

    for (const ev of events) {
      const pt = toPoint(ev, canvas);
      const last = stroke[stroke.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) < MIN_DIST) continue;
      stroke.push(pt);
      drawSegment(ctx, stroke, stroke.length - 1, size);
    }
    e.preventDefault();
  }

  function finishStroke(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointerRef.current) return;
    const stroke = currentRef.current;
    const ctx = e.currentTarget.getContext("2d");
    if (stroke && ctx) drawTail(ctx, stroke, size);
    if (stroke && stroke.length > 0) {
      strokesRef.current = [...strokesRef.current, stroke];
      setStrokeCount(strokesRef.current.length);
    }
    currentRef.current = null;
    activePointerRef.current = null;
  }

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Tập viết</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Viết vào ô bằng Apple Pencil, ngón tay hoặc chuột. Bản này chưa chấm
          điểm nét và chưa lưu bài viết.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_1fr] items-start">
        <section className="rounded-2xl bg-white p-3 sm:p-4 shadow-xs border border-slate-200">
          <div
            ref={wrapRef}
            className="relative w-full max-w-[560px] aspect-square mx-auto"
          >
            <canvas
              ref={guideRef}
              className="absolute inset-0 h-full w-full pointer-events-none rounded-lg"
            />
            <canvas
              ref={inkRef}
              className="absolute inset-0 h-full w-full rounded-lg select-none"
              style={{ touchAction: "none", WebkitTouchCallout: "none" }}
              onPointerDown={handleDown}
              onPointerMove={handleMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">
                Chữ {chars.length > 0 ? idx + 1 : 0}/{chars.length}
              </div>
              <div className="text-3xl font-bold text-slate-900">{ch}</div>
              {wordInfo && (
                <div className="text-sm text-slate-600">
                  {wordInfo.hanzi} · {wordInfo.pinyin}
                  {wordInfo.meaning ? ` · ${wordInfo.meaning}` : ""}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => goToChar(idx - 1)}
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                ← Trước
              </button>
              <button
                type="button"
                disabled={idx >= chars.length - 1}
                onClick={() => goToChar(idx + 1)}
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                Sau →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={strokeCount === 0}
              onClick={undoStroke}
              className="rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              Hoàn tác nét
            </button>
            <button
              type="button"
              disabled={strokeCount === 0}
              onClick={resetStrokes}
              className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
            >
              Xóa hết / Làm lại
            </button>
          </div>

          <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
            <span>Hiện chữ mẫu mờ</span>
            <input
              type="checkbox"
              checked={showGhost}
              onChange={(e) => setShowGhost(e.target.checked)}
              className="h-6 w-6 accent-blue-600"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
            <span>Chỉ nhận Apple Pencil (bỏ qua ngón tay)</span>
            <input
              type="checkbox"
              checked={penOnly}
              onChange={(e) => setPenOnly(e.target.checked)}
              className="h-6 w-6 accent-blue-600"
            />
          </label>
          <p className="text-xs text-slate-500">
            Sau lần đầu bút chạm vào ô, lòng bàn tay và ngón tay tự được bỏ qua.
          </p>

          <div className="space-y-2 pt-1 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-600">
              Lấy từ ngẫu nhiên theo cấp HSK 3.0:
            </p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((lv) => (
                <button
                  key={lv}
                  type="button"
                  disabled={loadingWord}
                  onClick={() => void pickRandomWord(lv)}
                  className="rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  HSK {lv}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">
              Hoặc tự nhập chữ Hán muốn tập:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Ví dụ: 你好"
                className="flex-1 min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={applyManual}
                className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Dùng chữ này
              </button>
            </div>
          </div>

          {wordError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {wordError}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
