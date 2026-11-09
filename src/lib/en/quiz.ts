// Tạo câu hỏi và chấm đáp án. Sáu dạng bài, chia hai nhóm:
//  Nhận biết: mcq (chọn nghĩa), forward (dịch sang Việt)
//  Dùng được: cloze (điền từ vào câu), reverse (dịch sang Anh),
//             build (sắp xếp câu), own (tự đặt câu có từ đó)
import type { EnWord } from "./words";
import { BOSS_QUESTIONS } from "./map";
import { loadSettings } from "@/lib/settings";

export type QType = "mcq" | "cloze" | "forward" | "reverse" | "build" | "own";
// A nhận biết, B dùng trong câu, C tự đặt câu, R nhớ lại hôm sau, X chặng boss
export type Part = "A" | "B" | "C" | "R" | "X";
export type Mode = "day" | "recall" | "boss";

export interface Question {
  type: QType;
  part: Part;
  word: EnWord;
  options?: string[]; // mcq
  tiles?: string[]; // build: các từ đã xáo trộn
  strict?: boolean; // không gợi ý (bài nhớ lại)
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

// Chỉ che khi từ xuất hiện nguyên vẹn (không nằm giữa một từ khác)
export function blankExample(w: EnWord): string | null {
  if (!w.example) return null;
  const esc = w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("(^|[^A-Za-z])(" + esc + ")(?![A-Za-z])", "i");
  return re.test(w.example) ? w.example.replace(re, "$1_____") : null;
}

// Phần đầu của từ, để nhận ra các dạng như achieved, achieving
export function stemOf(word: string): string {
  const w = word.toLowerCase();
  return w.length > 5 ? w.slice(0, w.length - 2) : w.slice(0, Math.max(3, w.length - 1));
}

function make(type: QType, w: EnWord, pool: EnWord[], part: Part, strict = false): Question {
  if (type === "cloze" && !blankExample(w)) type = "reverse";
  // chưa có nghĩa tiếng Việt thì không hỏi dịch sang Việt, chuyển sang chọn định nghĩa
  if (type === "forward" && w.hasVi === false) type = "mcq";
  if (type === "mcq") {
    const diff = shuffle(pool.filter((p) => p.id !== w.id && p.vi[0] !== w.vi[0]));
    // ưu tiên đáp án nhiễu cùng loại từ cho khó hơn
    const others = [...diff.filter((p) => p.pos === w.pos), ...diff.filter((p) => p.pos !== w.pos)];
    const wrong = others.slice(0, 3).map((p) => p.vi[0]);
    return { type, part, word: w, options: shuffle([w.vi[0], ...wrong]) };
  }
  if (type === "build") {
    const tokens = w.example.split(" ").filter(Boolean);
    if (tokens.length < 3) return make("cloze", w, pool, part, strict);
    let tiles = shuffle(tokens);
    if (tiles.join(" ") === tokens.join(" ")) tiles = shuffle(tokens);
    return { type, part, word: w, tiles };
  }
  return { type, part, word: w, strict };
}

const BOSS_ORDER: QType[] = ["mcq", "cloze", "forward", "build", "reverse", "own"];

export function buildQuestions(stageWords: EnWord[], pool: EnWord[], mode: Mode): Question[] {
  if (mode === "boss") {
    return shuffle(stageWords)
      .slice(0, BOSS_QUESTIONS)
      .map((w, i) => make(BOSS_ORDER[i % BOSS_ORDER.length], w, pool, "X"));
  }
  if (mode === "recall") {
    return shuffle(
      stageWords.flatMap((w) => [
        make("reverse", w, pool, "R", true),
        make("cloze", w, pool, "R", true),
      ])
    );
  }
  const a = stageWords.map((w, i) => make(i % 2 === 0 ? "mcq" : "forward", w, pool, "A"));
  const b = shuffle([
    ...stageWords.map((w) => make("cloze", w, pool, "B")),
    ...stageWords.map((w) => make("build", w, pool, "B")),
  ]);
  const c = shuffle(stageWords)
    .slice(0, 2)
    .map((w) => make("own", w, pool, "C"));
  return [...a, ...b, ...c];
}

export function isCorrect(q: Question, input: string): boolean {
  const n = norm(input);
  if (!n) return false;
  if (q.type === "mcq") return input === q.word.vi[0];
  if (q.type === "forward") return q.word.vi.some((v) => norm(v) === n);
  if (q.type === "build") return n === norm(q.word.example);
  if (q.type === "own") {
    const stem = norm(stemOf(q.word.word));
    const tokens = n.split(" ");
    return tokens.length >= 4 && tokens.some((t) => t.startsWith(stem));
  }
  return norm(q.word.word) === n;
}

export function answerText(q: Question): string {
  if (q.type === "mcq") return q.word.vi[0];
  if (q.type === "forward") return q.word.vi.join(" / ");
  if (q.type === "build" || q.type === "own") return q.word.example;
  return q.word.word;
}

export function speak(text: string, rate?: number): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const s = loadSettings();
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));

    let chosen = s.enVoiceURI
      ? enVoices.find((v) => v.voiceURI === s.enVoiceURI)
      : undefined;

    if (!chosen && enVoices.length > 0) {
      const accentPool =
        s.enAccent && s.enAccent !== "ALL"
          ? enVoices.filter((v) => v.lang.replace("_", "-").startsWith(s.enAccent))
          : enVoices;
      const pool = accentPool.length > 0 ? accentPool : enVoices;
      chosen =
        pool.find((v) => v.name.includes("Natural") || v.name.includes("Google")) ??
        pool[0];
    }

    if (chosen) {
      u.voice = chosen;
      u.lang = chosen.lang;
    } else {
      u.lang = s.enAccent && s.enAccent !== "ALL" ? s.enAccent : "en-US";
    }

    const finalRate = rate ?? s.enTtsRate ?? 0.95;
    u.rate = Math.max(0.5, Math.min(1.3, finalRate));
    window.speechSynthesis.speak(u);
  } catch {
    // trình duyệt không hỗ trợ giọng đọc: bỏ qua
  }
}
