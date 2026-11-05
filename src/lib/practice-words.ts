import { db } from "@/lib/db";

export interface PracticeWord {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
}

type Loose = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Đọc từ đã lưu ngoại tuyến (Dexie) theo cấp HSK. Cần mở tab Từ vựng ít nhất một lần để có dữ liệu. */
export async function loadPracticeWords(
  level: number,
  max = 300
): Promise<PracticeWord[]> {
  const rows = (await db.words
    .where("hsk_new_level")
    .equals(level)
    .limit(max)
    .toArray()) as unknown as Loose[];

  if (rows.length === 0) return [];

  const ids = rows.map((r) => str(r.id));
  const meaningRows = (await db.word_meanings_en
    .where("word_id")
    .anyOf(ids)
    .toArray()) as unknown as Loose[];

  const firstMeaning = new Map<string, { order: number; text: string }>();
  for (const m of meaningRows) {
    const wid = str(m.word_id);
    const text =
      str(m.meaning_en) || str(m.meaning) || str(m.text) || str(m.gloss);
    const order = typeof m.sort_order === "number" ? m.sort_order : 999;
    if (!text) continue;
    const cur = firstMeaning.get(wid);
    if (!cur || order < cur.order) firstMeaning.set(wid, { order, text });
  }

  return rows
    .map((r) => ({
      id: str(r.id),
      hanzi: str(r.hanzi_simp),
      pinyin:
        str(r.pinyin) || str(r.pinyin_display) || str(r.pinyin_numbered),
      meaning: firstMeaning.get(str(r.id))?.text ?? "",
    }))
    .filter((w) => w.hanzi.length > 0);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Đọc to bằng giọng của trình duyệt. */
export function speak(
  text: string,
  opts: { rate: number; voiceURI: string | null }
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = opts.rate;
  const voices = window.speechSynthesis.getVoices();
  const chosen =
    (opts.voiceURI && voices.find((v) => v.voiceURI === opts.voiceURI)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("zh"));
  if (chosen) u.voice = chosen;
  window.speechSynthesis.speak(u);
}
