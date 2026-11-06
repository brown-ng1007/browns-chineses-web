// Phần thuần của các trò chơi tiếng Anh: không gọi mạng, không đọc ghi gì ngoài tham số.
import type { EnWord } from "./words";
import { shuffle } from "./quiz";

// Nghĩa ngắn để làm nút bấm. Chưa có nghĩa tiếng Việt thì cắt định nghĩa tiếng Anh cho gọn.
export function shortMeaning(w: EnWord): string {
  const m = (w.vi[0] ?? "").trim();
  if (w.hasVi !== false) return m;
  const cut = m.split(/;| \/ /)[0].trim();
  return cut.length > 64 ? cut.slice(0, 61).trimEnd() + "..." : cut;
}

// Từ chơi được trò xếp chữ và đoán chữ: một từ, chỉ có chữ cái, dài vừa phải
export function isPlayableWord(w: EnWord): boolean {
  return /^[A-Za-z]{4,10}$/.test(w.word);
}

// Chọn n từ khác nhau, không trùng nghĩa ngắn (để ghép cặp không gây nhầm)
export function pickDistinct(words: EnWord[], n: number): EnWord[] {
  const out: EnWord[] = [];
  const seen = new Set<string>();
  for (const w of shuffle(words)) {
    const key = shortMeaning(w).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= n) break;
  }
  return out;
}

// Bốn đáp án nghĩa cho một từ (1 đúng, 3 nhiễu cùng loại từ nếu có)
export function meaningOptions(w: EnWord, pool: EnWord[]): string[] {
  const right = shortMeaning(w);
  const diff = shuffle(pool.filter((p) => p.id !== w.id && shortMeaning(p) && shortMeaning(p) !== right));
  const same = diff.filter((p) => p.pos === w.pos);
  const sameSet = new Set(same);
  const picks = [...same, ...diff.filter((p) => !sameSet.has(p))];
  const wrong: string[] = [];
  for (const p of picks) {
    const t = shortMeaning(p);
    if (!wrong.includes(t)) wrong.push(t);
    if (wrong.length >= 3) break;
  }
  return shuffle([right, ...wrong]);
}

// Điểm sao cho một lượt chơi, theo số lỗi
export function starsByMistakes(mistakes: number, allowed: [number, number]): number {
  return mistakes <= allowed[0] ? 3 : mistakes <= allowed[1] ? 2 : 1;
}
