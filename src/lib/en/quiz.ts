// Tạo câu hỏi và chấm đáp án cho 4 dạng bài: chọn đáp án, điền từ, dịch xuôi, dịch ngược.
import type { EnWord } from "./words";
import { BOSS_QUESTIONS } from "./map";

export type QType = "mcq" | "cloze" | "forward" | "reverse";
const ORDER: QType[] = ["mcq", "cloze", "forward", "reverse"];

export interface Question {
  type: QType;
  word: EnWord;
  options?: string[]; // chỉ dùng cho mcq
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function blankExample(w: EnWord): string | null {
  const re = new RegExp(w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return re.test(w.example) ? w.example.replace(re, "_____") : null;
}

function make(type: QType, w: EnWord, pool: EnWord[]): Question {
  if (type === "cloze" && !blankExample(w)) return { type: "reverse", word: w };
  if (type === "mcq") {
    const others = shuffle(pool.filter((p) => p.id !== w.id && p.vi[0] !== w.vi[0]));
    const wrong = others.slice(0, 3).map((p) => p.vi[0]);
    return { type, word: w, options: shuffle([w.vi[0], ...wrong]) };
  }
  return { type, word: w };
}

export function buildQuestions(
  stageWords: EnWord[],
  pool: EnWord[],
  boss: boolean
): Question[] {
  if (boss) {
    return shuffle(stageWords)
      .slice(0, BOSS_QUESTIONS)
      .map((w, i) => make(ORDER[i % 4], w, pool));
  }
  const qs: Question[] = [];
  stageWords.forEach((w, i) => {
    qs.push(make(ORDER[i % 4], w, pool));
    qs.push(make(ORDER[(i + 2) % 4], w, pool));
  });
  return shuffle(qs);
}

export function isCorrect(q: Question, input: string): boolean {
  const n = norm(input);
  if (!n) return false;
  if (q.type === "mcq") return input === q.word.vi[0];
  if (q.type === "forward") return q.word.vi.some((v) => norm(v) === n);
  return norm(q.word.word) === n;
}

export function answerText(q: Question): string {
  if (q.type === "mcq") return q.word.vi[0];
  if (q.type === "forward") return q.word.vi.join(" / ");
  return q.word.word;
}

export function speak(text: string, rate = 0.9): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = Math.min(1, rate);
    window.speechSynthesis.speak(u);
  } catch {
    // trình duyệt không hỗ trợ giọng đọc: bỏ qua
  }
}
