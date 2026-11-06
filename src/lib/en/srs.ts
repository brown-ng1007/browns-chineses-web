// Lịch ôn thẻ tiếng Anh. Hàm thuần, không đọc ghi gì ngoài tham số.
// Bốn mức tự chấm: 0 quên, 1 khó, 2 được, 3 dễ.
export type Rating = 0 | 1 | 2 | 3;

export interface EnCard {
  word_id: string;
  due_at: string; // ISO UTC
  interval: number; // số ngày
  ease: number;
  reps: number;
  lapses: number;
  created_at: string;
  last_at?: string;
}

const DAY = 24 * 60 * 60 * 1000;

export function newCard(wordId: string, now: Date, dueInDays = 1): EnCard {
  return {
    word_id: wordId,
    due_at: new Date(now.getTime() + dueInDays * DAY).toISOString(),
    interval: dueInDays,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    created_at: now.toISOString(),
  };
}

export function schedule(c: EnCard, r: Rating, now: Date): EnCard {
  let { interval, ease, reps, lapses } = c;
  if (r === 0) {
    lapses += 1;
    reps = 0;
    ease = Math.max(1.3, ease - 0.2);
    interval = 0;
  } else {
    if (r === 1) {
      interval = reps === 0 ? 1 : Math.max(1, interval * 1.2);
      ease = Math.max(1.3, ease - 0.15);
    } else if (r === 2) {
      interval = reps === 0 ? 1 : reps === 1 ? 3 : interval * ease;
    } else {
      interval = reps === 0 ? 3 : reps === 1 ? 6 : interval * ease * 1.3;
      ease += 0.1;
    }
    interval = Math.round(interval * 10) / 10;
    reps += 1;
  }
  const due = r === 0 ? now.getTime() + 10 * 60 * 1000 : now.getTime() + Math.round(interval * DAY);
  return { ...c, due_at: new Date(due).toISOString(), interval, ease, reps, lapses, last_at: now.toISOString() };
}

// Nhãn khoảng cách đến lần ôn kế tiếp, để hiện trên nút chấm
export function previewLabel(c: EnCard, r: Rating, now: Date): string {
  if (r === 0) return "10 phút";
  const days = (new Date(schedule(c, r, now).due_at).getTime() - now.getTime()) / DAY;
  if (days < 30) return `${Math.max(1, Math.round(days))} ngày`;
  return `${Math.round(days / 30)} tháng`;
}
