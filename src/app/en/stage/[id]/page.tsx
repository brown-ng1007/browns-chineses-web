"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import "@/components/en/en.css";
import { db } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import { loadEnWords, type EnWord } from "@/lib/en/words";
import { buildStages, starsFor } from "@/lib/en/map";
import {
  answerText,
  blankExample,
  buildQuestions,
  isCorrect,
  speak,
  type Question,
} from "@/lib/en/quiz";

type Phase = "loading" | "missing" | "learn" | "quiz" | "result";
interface Feedback {
  ok: boolean;
  forced: boolean;
}

const TITLES: Record<Question["type"], string> = {
  mcq: "Chọn nghĩa đúng",
  cloze: "Điền từ còn thiếu",
  forward: "Dịch sang tiếng Việt",
  reverse: "Dịch sang tiếng Anh",
};

function hint(w: EnWord): string {
  return w.word[0] + " " + Array(Math.max(0, w.word.length - 1)).fill("_").join(" ");
}

export default function StagePage() {
  const { id } = useParams<{ id: string }>();
  const [pool, setPool] = useState<EnWord[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [learnIdx, setLearnIdx] = useState(0);
  const [qs, setQs] = useState<Question[]>([]);
  const [qi, setQi] = useState(0);
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [score, setScore] = useState(0);
  const [stars, setStars] = useState(0);

  const stages = useMemo(() => buildStages(pool), [pool]);
  const stage = stages.find((s) => s.id === id);
  const stageWords = useMemo(
    () =>
      stage
        ? stage.wordIds
            .map((wid) => pool.find((w) => w.id === wid))
            .filter((w): w is EnWord => !!w)
        : [],
    [stage, pool]
  );
  const nextStage = stage ? stages[stage.index + 1] : undefined;

  useEffect(() => {
    loadEnWords().then((w) => setPool(w));
  }, []);

  useEffect(() => {
    if (pool.length === 0) return;
    if (!stage) {
      setPhase("missing");
      return;
    }
    if (stage.boss) startQuiz();
    else setPhase("learn");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, id]);

  function startQuiz() {
    if (!stage) return;
    const ws = stage.wordIds
      .map((wid) => pool.find((w) => w.id === wid))
      .filter((w): w is EnWord => !!w);
    setQs(buildQuestions(ws, pool, stage.boss));
    setQi(0);
    setScore(0);
    setInput("");
    setPicked(null);
    setFb(null);
    setPhase("quiz");
  }

  function submit(value: string) {
    if (fb) return;
    const q = qs[qi];
    const ok = isCorrect(q, value);
    if (q.type === "mcq") setPicked(value);
    setFb({ ok, forced: false });
    if (ok) setScore((s) => s + 1);
  }

  function forceOk() {
    if (!fb || fb.ok) return;
    setFb({ ok: true, forced: true });
    setScore((s) => s + 1);
  }

  async function next() {
    if (qi + 1 < qs.length) {
      setQi(qi + 1);
      setInput("");
      setPicked(null);
      setFb(null);
      return;
    }
    const s = starsFor(score, qs.length);
    setStars(s);
    setPhase("result");
    if (!stage) return;
    try {
      const prev = await db.en_progress.get(stage.id);
      await db.en_progress.put({
        stage_id: stage.id,
        stars: Math.max(prev?.stars ?? 0, s),
        best_accuracy: Math.max(prev?.best_accuracy ?? 0, score / qs.length),
        plays: (prev?.plays ?? 0) + 1,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // không lưu được trong máy: kết quả vẫn hiện, nhưng chặng sau chưa mở
    }
  }

  const rate = typeof window === "undefined" ? 0.9 : loadSettings().ttsRate;

  if (phase === "loading") {
    return <p className="py-20 text-center text-sm text-stone-500">Đang tải chặng...</p>;
  }
  if (phase === "missing" || !stage) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-stone-600">Không tìm thấy chặng này.</p>
        <Link href="/en" className="mt-3 inline-block font-semibold text-orange-600">
          Về bản đồ
        </Link>
      </div>
    );
  }

  const shell = "mx-auto max-w-md space-y-4 pb-10";
  const card = "rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-orange-100";
  const btn =
    "w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-base font-bold text-white shadow-md disabled:opacity-40";

  /* ---------- Học từ ---------- */
  if (phase === "learn") {
    const w = stageWords[learnIdx];
    const last = learnIdx === stageWords.length - 1;
    return (
      <main className={shell}>
        <p className="text-center text-sm font-semibold text-orange-700">
          Học từ mới {learnIdx + 1}/{stageWords.length}
        </p>
        <div className={card}>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-bold text-stone-900">{w.word}</h1>
            <button
              type="button"
              onClick={() => speak(w.word, rate)}
              className="rounded-full bg-orange-100 px-3 py-2 text-lg"
              aria-label="Nghe phát âm"
            >
              🔊
            </button>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            {w.ipa} · {w.pos}
          </p>
          <p className="mt-4 text-xl font-semibold text-orange-700">{w.vi.join("; ")}</p>
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed">
            <p className="font-medium text-stone-800">{w.example}</p>
            <p className="mt-1 text-stone-500">{w.exampleVi}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={learnIdx === 0}
            onClick={() => setLearnIdx(learnIdx - 1)}
            className="w-1/3 rounded-2xl bg-white px-4 py-3 font-semibold text-stone-600 ring-1 ring-stone-200 disabled:opacity-40"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={() => (last ? startQuiz() : setLearnIdx(learnIdx + 1))}
            className={btn}
          >
            {last ? "Bắt đầu luyện tập" : "Từ tiếp theo"}
          </button>
        </div>
      </main>
    );
  }

  /* ---------- Kết quả ---------- */
  if (phase === "result") {
    const passed = stars >= 1;
    return (
      <main className={shell}>
        <div className={`${card} text-center`}>
          <p className="text-5xl">{passed ? "🎉" : "💪"}</p>
          <div className="mt-3 flex justify-center gap-1 text-3xl">
            {[1, 2, 3].map((i) => (
              <span key={i} className={i <= stars ? "" : "grayscale opacity-30"}>
                ⭐
              </span>
            ))}
          </div>
          <h1 className="mt-3 text-xl font-bold text-stone-900">
            Đúng {score}/{qs.length} câu
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {passed ? "Chặng này đã xong." : "Cần đúng từ 60% để qua chặng. Thử lại nhé."}
          </p>
        </div>
        {passed && nextStage && (
          <Link href={`/en/stage/${nextStage.id}`} className={`${btn} block text-center`}>
            Chặng tiếp theo
          </Link>
        )}
        <button
          type="button"
          onClick={startQuiz}
          className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-orange-700 ring-1 ring-orange-200"
        >
          Làm lại chặng này
        </button>
        <Link href="/en" className="block text-center text-sm font-semibold text-stone-500">
          Về bản đồ
        </Link>
      </main>
    );
  }

  /* ---------- Luyện tập ---------- */
  const q = qs[qi];
  if (!q) return null;
  const typed = q.type !== "mcq";
  return (
    <main className={shell}>
      <div>
        <div className="h-2.5 overflow-hidden rounded-full bg-orange-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
            style={{ width: `${(qi / qs.length) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-stone-500">
          {qi + 1}/{qs.length}
        </p>
      </div>

      <div className={`${card} ${fb && !fb.ok ? "en-shake" : ""}`}>
        <p className="text-sm font-semibold text-orange-700">{TITLES[q.type]}</p>

        {(q.type === "mcq" || q.type === "forward") && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-3xl font-bold text-stone-900">{q.word.word}</p>
              <p className="text-sm text-stone-500">{q.word.ipa}</p>
            </div>
            <button
              type="button"
              onClick={() => speak(q.word.word, rate)}
              className="rounded-full bg-orange-100 px-3 py-2 text-lg"
              aria-label="Nghe phát âm"
            >
              🔊
            </button>
          </div>
        )}
        {q.type === "cloze" && (
          <div className="mt-3">
            <p className="text-xl font-semibold leading-snug text-stone-900">{blankExample(q.word)}</p>
            <p className="mt-2 text-sm text-stone-500">{q.word.exampleVi}</p>
            <p className="mt-1 text-sm text-stone-400">Gợi ý: {q.word.vi[0]}</p>
          </div>
        )}
        {q.type === "reverse" && (
          <div className="mt-3">
            <p className="text-2xl font-bold text-stone-900">{q.word.vi.join("; ")}</p>
            <p className="mt-2 text-sm text-stone-400">
              Gợi ý: {hint(q.word)} ({q.word.word.length} chữ cái)
            </p>
          </div>
        )}

        {q.type === "mcq" && q.options && (
          <div className="mt-4 space-y-2">
            {q.options.map((o) => {
              const isAns = o === q.word.vi[0];
              let cls = "bg-white ring-1 ring-stone-200 text-stone-800";
              if (fb && isAns) cls = "bg-emerald-100 ring-2 ring-emerald-500 text-emerald-900";
              else if (fb && o === picked) cls = "bg-rose-100 ring-2 ring-rose-400 text-rose-900";
              return (
                <button
                  key={o}
                  type="button"
                  disabled={!!fb}
                  onClick={() => submit(o)}
                  className={`w-full rounded-2xl px-4 py-3 text-left font-medium ${cls}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        )}

        {typed && (
          <input
            autoFocus
            value={input}
            disabled={!!fb}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (fb) void next();
                else submit(input);
              }
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={q.type === "forward" ? "Nghĩa tiếng Việt" : "Từ tiếng Anh"}
            className="mt-4 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-lg outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
          />
        )}
      </div>

      {fb && (
        <div
          className={`rounded-2xl p-4 text-sm ${
            fb.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"
          }`}
        >
          <p className="font-bold">
            {fb.ok ? (fb.forced ? "Đã tính là đúng" : "Chính xác!") : "Chưa đúng"}
          </p>
          {!fb.ok && <p className="mt-1">Đáp án: {answerText(q)}</p>}
          <p className="mt-1 text-stone-600">
            {q.word.example} — {q.word.exampleVi}
          </p>
          {!fb.ok && q.type === "forward" && (
            <button type="button" onClick={forceOk} className="mt-2 font-semibold underline">
              Nghĩa của mình cũng đúng
            </button>
          )}
        </div>
      )}

      {fb ? (
        <button type="button" onClick={() => void next()} className={btn}>
          {qi + 1 < qs.length ? "Câu tiếp" : "Xem kết quả"}
        </button>
      ) : (
        typed && (
          <button type="button" disabled={!input.trim()} onClick={() => submit(input)} className={btn}>
            Kiểm tra
          </button>
        )
      )}
    </main>
  );
}
