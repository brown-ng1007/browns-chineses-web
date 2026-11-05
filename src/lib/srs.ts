import type { SrsState } from "@/types/database.types";

/**
 * Lịch ôn thẻ theo FSRS-4.5 (bản rút gọn, tự viết, không dùng thư viện).
 * - Hàm thuần: không gọi mạng, không đọc/ghi gì ngoài tham số.
 * - Mức nhớ (stability) tính theo ngày; độ khó (difficulty) từ 1 đến 10.
 * - Thẻ mới / đang học / học lại có bước ngắn tính bằng phút.
 */

export type Rating = 1 | 2 | 3 | 4; // 1 Quên, 2 Khó, 3 Được, 4 Dễ

export interface CardMemory {
  state: SrsState;
  stability: number;
  difficulty: number;
  due_at: string;
  last_review_at: string | null;
  reps: number;
  lapses: number;
}

export interface ScheduleResult extends CardMemory {
  last_review_at: string;
  dueInMs: number;
}

// Tham số mặc định của FSRS-4.5
const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const MAX_INTERVAL_DAYS = 365;
const MIN_STABILITY = 0.01;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const STEP_AGAIN_MS = 1 * MINUTE; // Quên khi đang học
const STEP_HARD_MS = 5 * MINUTE; // Khó khi đang học
const STEP_LAPSE_MS = 10 * MINUTE; // Quên khi đã thuộc (học lại)

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function initDifficulty(rating: number): number {
  return clamp(W[4] - (rating - 3) * W[5], 1, 10);
}

function nextDifficulty(d: number, rating: number): number {
  const next = d - W[6] * (rating - 3);
  const reverted = W[7] * initDifficulty(3) + (1 - W[7]) * next;
  return clamp(reverted, 1, 10);
}

function retrievability(elapsedDays: number, s: number): number {
  return Math.pow(1 + (FACTOR * elapsedDays) / s, DECAY);
}

function recallStability(
  d: number,
  s: number,
  r: number,
  rating: number
): number {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  const growth =
    Math.exp(W[8]) *
    (11 - d) *
    Math.pow(s, -W[9]) *
    (Math.exp(W[10] * (1 - r)) - 1) *
    hardPenalty *
    easyBonus;
  return s * (1 + growth);
}

function forgetStability(d: number, s: number, r: number): number {
  const next =
    W[11] *
    Math.pow(d, -W[12]) *
    (Math.pow(s + 1, W[13]) - 1) *
    Math.exp(W[14] * (1 - r));
  return Math.min(next, s);
}

function toDays(stability: number): number {
  return clamp(Math.round(stability), 1, MAX_INTERVAL_DAYS);
}

function elapsedDaysSince(lastReviewAt: string | null, now: Date): number {
  if (!lastReviewAt) return 0;
  const last = new Date(lastReviewAt).getTime();
  if (Number.isNaN(last)) return 0;
  return Math.max(0, (now.getTime() - last) / DAY);
}

function build(
  base: CardMemory | null,
  now: Date,
  state: SrsState,
  stability: number,
  difficulty: number,
  dueInMs: number,
  lapsesAdd: number
): ScheduleResult {
  return {
    state,
    stability: Math.max(MIN_STABILITY, stability),
    difficulty: clamp(difficulty, 1, 10),
    due_at: new Date(now.getTime() + dueInMs).toISOString(),
    last_review_at: now.toISOString(),
    reps: (base?.reps ?? 0) + 1,
    lapses: (base?.lapses ?? 0) + lapsesAdd,
    dueInMs,
  };
}

/** Ba mốc ôn lại cho thẻ đã thuộc, bảo đảm Khó < Được < Dễ. */
function reviewIntervals(
  card: CardMemory,
  now: Date
): Record<2 | 3 | 4, { stability: number; difficulty: number; days: number }> {
  const t = elapsedDaysSince(card.last_review_at, now);
  const s = Math.max(MIN_STABILITY, card.stability);
  const r = retrievability(t, s);

  const sHard = recallStability(card.difficulty, s, r, 2);
  const sGood = recallStability(card.difficulty, s, r, 3);
  const sEasy = recallStability(card.difficulty, s, r, 4);

  const hardDays = Math.min(toDays(sHard), MAX_INTERVAL_DAYS);
  const goodDays = Math.min(
    Math.max(toDays(sGood), hardDays + 1),
    MAX_INTERVAL_DAYS
  );
  const easyDays = Math.min(
    Math.max(toDays(sEasy), goodDays + 1),
    MAX_INTERVAL_DAYS
  );

  return {
    2: {
      stability: sHard,
      difficulty: nextDifficulty(card.difficulty, 2),
      days: hardDays,
    },
    3: {
      stability: sGood,
      difficulty: nextDifficulty(card.difficulty, 3),
      days: goodDays,
    },
    4: {
      stability: sEasy,
      difficulty: nextDifficulty(card.difficulty, 4),
      days: easyDays,
    },
  };
}

/** Tính trạng thái mới của thẻ sau khi người dùng chấm. card = null nghĩa là thẻ chưa có trong srs_cards. */
export function scheduleCard(
  card: CardMemory | null,
  rating: Rating,
  now: Date
): ScheduleResult {
  // Thẻ mới
  if (card === null || card.state === "new") {
    const s0 = W[rating - 1];
    const d0 = initDifficulty(rating);
    if (rating === 1) {
      return build(card, now, "learning", s0, d0, STEP_AGAIN_MS, 0);
    }
    if (rating === 2) {
      return build(card, now, "learning", s0, d0, STEP_HARD_MS, 0);
    }
    const goodDays = toDays(W[2]);
    const days = rating === 3 ? goodDays : Math.max(goodDays + 1, toDays(W[3]));
    return build(card, now, "review", Math.max(s0, days), d0, days * DAY, 0);
  }

  // Đang học hoặc học lại: bước ngắn, đủ điều kiện thì "tốt nghiệp" sang ôn dài hạn
  if (card.state === "learning" || card.state === "relearning") {
    if (rating === 1) {
      return build(
        card,
        now,
        card.state,
        card.stability,
        card.difficulty,
        STEP_AGAIN_MS,
        0
      );
    }
    if (rating === 2) {
      return build(
        card,
        now,
        card.state,
        card.stability,
        card.difficulty,
        STEP_HARD_MS,
        0
      );
    }
    const goodDays = toDays(card.stability);
    const days =
      rating === 3 ? goodDays : Math.max(goodDays + 1, Math.round(goodDays * 1.5));
    const d = nextDifficulty(card.difficulty, rating);
    return build(
      card,
      now,
      "review",
      Math.max(card.stability, days),
      d,
      days * DAY,
      0
    );
  }

  // Thẻ đã thuộc (review)
  if (rating === 1) {
    const t = elapsedDaysSince(card.last_review_at, now);
    const s = Math.max(MIN_STABILITY, card.stability);
    const r = retrievability(t, s);
    return build(
      card,
      now,
      "relearning",
      forgetStability(card.difficulty, s, r),
      nextDifficulty(card.difficulty, 1),
      STEP_LAPSE_MS,
      1
    );
  }

  const info = reviewIntervals(card, now)[rating];
  return build(
    card,
    now,
    "review",
    info.stability,
    info.difficulty,
    info.days * DAY,
    0
  );
}

/** Chữ hiển thị khoảng thời gian, ví dụ "10 phút", "4 ngày". */
export function formatInterval(ms: number): string {
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `${Math.max(1, minutes)} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.round(ms / DAY);
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return "1 năm";
}

/** Khoảng ôn lại hiện bên cạnh mỗi nút chấm. */
export function previewLabels(
  card: CardMemory | null,
  now: Date
): Record<Rating, string> {
  return {
    1: formatInterval(scheduleCard(card, 1, now).dueInMs),
    2: formatInterval(scheduleCard(card, 2, now).dueInMs),
    3: formatInterval(scheduleCard(card, 3, now).dueInMs),
    4: formatInterval(scheduleCard(card, 4, now).dueInMs),
  };
}
