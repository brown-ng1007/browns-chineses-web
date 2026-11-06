// Đọc ghi dữ liệu luyện tập tiếng Anh trong máy (Dexie): thẻ ôn, nhật ký, từ để nghe và nói.
import { db, type EnLog } from "@/lib/db";
import { dayKey } from "@/lib/tower";
import { newCard, type EnCard } from "@/lib/en/srs";
import { loadEnWords } from "@/lib/en/vocab";
import type { EnWord } from "@/lib/en/words";

// Thêm các từ vào thẻ ôn (từ đã có thẻ thì giữ nguyên). Thẻ mới đến hạn sau một ngày.
export async function addCards(ids: string[]): Promise<number> {
  const have = await db.en_cards.bulkGet(ids);
  const now = new Date();
  const fresh = ids.filter((_, i) => !have[i]).map((id) => newCard(id, now, 1));
  if (fresh.length > 0) await db.en_cards.bulkPut(fresh);
  return fresh.length;
}

export async function allCards(): Promise<EnCard[]> {
  return db.en_cards.toArray();
}

export async function dueCards(now = new Date(), limit = 30): Promise<EnCard[]> {
  const rows = await db.en_cards.where("due_at").belowOrEqual(now.toISOString()).sortBy("due_at");
  return rows.slice(0, limit);
}

export async function countDue(now = new Date()): Promise<number> {
  return db.en_cards.where("due_at").belowOrEqual(now.toISOString()).count();
}

export async function saveCard(c: EnCard): Promise<void> {
  await db.en_cards.put(c);
}

export async function logActivity(kind: EnLog["kind"], ok: number, total: number): Promise<void> {
  await db.en_logs.add({ day: dayKey(new Date()), kind, ok, total, at: new Date().toISOString() });
}

export async function readLogs(): Promise<EnLog[]> {
  return db.en_logs.toArray();
}

// Từ để nghe và nói: ưu tiên các từ đã học (có thẻ); chưa đủ thì dùng những từ đầu tiên trên bản đồ
export function practiceWords(pool: EnWord[], learned: Set<string>, fallback = 60): EnWord[] {
  const mine = pool.filter((w) => learned.has(w.id));
  return mine.length >= 8 ? mine : pool.slice(0, fallback);
}

export async function loadPractice(): Promise<{ pool: EnWord[]; words: EnWord[]; learned: Set<string> }> {
  const pool = await loadEnWords();
  let learned = new Set<string>();
  try {
    learned = new Set((await allCards()).map((c) => c.word_id));
  } catch {
    // chưa đọc được dữ liệu trong máy: coi như chưa học từ nào
  }
  return { pool, words: practiceWords(pool, learned), learned };
}
