"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { refreshSettings, type AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { logSkill } from "@/lib/skill-log";
import {
  loadPracticeWords,
  shuffle,
  speak,
  type PracticeWord,
} from "@/lib/practice-words";

const card =
  "rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90";

interface Question {
  answer: PracticeWord;
  options: PracticeWord[];
}

function buildQuestions(words: PracticeWord[], count: number): Question[] {
  const picked = shuffle(words).slice(0, count);
  return picked.map((answer) => {
    const others = shuffle(words.filter((w) => w.id !== answer.id)).slice(0, 3);
    return { answer, options: shuffle([answer, ...others]) };
  });
}

export default function ListenPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [words, setWords] = useState<PracticeWord[] | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    refreshSettings()
      .then((s) => {
        setSettings(s);
        return loadPracticeWords(s.listenLevel);
      })
      .then(setWords)
      .catch(() => setWords([]));
  }, []);

  function start(list: PracticeWord[]) {
    setQuestions(buildQuestions(list, Math.min(10, list.length)));
    setIndex(0);
    setPicked(null);
    setScore(0);
    startedAt.current = Date.now();
  }

  useEffect(() => {
    if (words && words.length >= 4) start(words);
  }, [words]);

  const q = questions[index];
  const finished = questions.length > 0 && index >= questions.length;

  useEffect(() => {
    if (q) speak(q.answer.hanzi, { rate: settings.ttsRate, voiceURI: settings.voiceURI });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Hết lượt thì ghi vào tab Kỹ năng (một lần mỗi lượt)
  useEffect(() => {
    if (finished) {
      void logSkill(
        "listening",
        (Date.now() - startedAt.current) / 60000,
        score / questions.length
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const progress = useMemo(
    () => (questions.length ? Math.round((index / questions.length) * 100) : 0),
    [index, questions.length]
  );

  function choose(id: string) {
    if (picked || !q) return;
    setPicked(id);
    if (id === q.answer.id) setScore((s) => s + 1);
  }

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  return (
    <main className="space-y-6 pb-8">
      <section className={card}>
        <div className="text-xs font-semibold uppercase tracking-wider text-sky-600">
          Luyện nghe • HSK {settings.listenLevel}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
          Nghe và chọn chữ
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Nghe phát âm rồi chọn đúng chữ Hán. Đổi cấp HSK và tốc độ trong Cài đặt.
        </p>
      </section>

      {words === null && (
        <section className={card}>
          <p className="text-sm text-slate-600">Đang tải từ vựng...</p>
        </section>
      )}

      {words !== null && words.length < 4 && (
        <section className={card}>
          <p className="text-sm text-slate-700">
            Chưa có đủ từ HSK {settings.listenLevel} trên thiết bị. Hãy mở tab Từ
            vựng một lần (khi có mạng) để tải từ về, rồi quay lại đây.
          </p>
        </section>
      )}

      {q && !finished && (
        <section className={`${card} space-y-5`}>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-slate-500">
            Câu {index + 1}/{questions.length} • Đúng {score}
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={() =>
                speak(q.answer.hanzi, {
                  rate: settings.ttsRate,
                  voiceURI: settings.voiceURI,
                })
              }
              className="rounded-2xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition"
            >
              🔊 Nghe lại
            </button>
            <button
              type="button"
              onClick={() =>
                speak(q.answer.hanzi, {
                  rate: Math.max(0.5, settings.ttsRate * 0.6),
                  voiceURI: settings.voiceURI,
                })
              }
              className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              🐢 Đọc chậm
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {q.options.map((o) => {
              const isAnswer = o.id === q.answer.id;
              const isPicked = o.id === picked;
              let cls =
                "border-slate-200 bg-white hover:border-sky-300 text-slate-900";
              if (picked) {
                if (isAnswer) cls = "border-emerald-400 bg-emerald-50 text-emerald-900";
                else if (isPicked) cls = "border-red-400 bg-red-50 text-red-900";
                else cls = "border-slate-200 bg-white text-slate-400";
              }
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={picked !== null}
                  onClick={() => choose(o.id)}
                  className={`font-hanzi rounded-2xl border-2 py-5 text-3xl font-bold transition ${cls}`}
                >
                  {o.hanzi}
                </button>
              );
            })}
          </div>

          {picked && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-1">
              <div>
                <span className="font-hanzi text-xl font-bold">{q.answer.hanzi}</span>{" "}
                <span className="text-slate-700">{q.answer.pinyin}</span>
              </div>
              {q.answer.meaning && (
                <div className="text-slate-600">{q.answer.meaning}</div>
              )}
              <button
                type="button"
                onClick={next}
                className="mt-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
              >
                {index + 1 === questions.length ? "Xem kết quả" : "Câu tiếp theo"}
              </button>
            </div>
          )}
        </section>
      )}

      {finished && words && (
        <section className={`${card} text-center space-y-4`}>
          <div className="text-4xl font-bold text-slate-900">
            {score}/{questions.length}
          </div>
          <p className="text-sm text-slate-600">
            {score === questions.length
              ? "Tuyệt vời, nghe đúng hết!"
              : "Luyện thêm một lượt để chắc tai hơn nhé."}
          </p>
          <button
            type="button"
            onClick={() => start(words)}
            className="rounded-2xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition"
          >
            Làm lượt mới
          </button>
        </section>
      )}
    </main>
  );
}
