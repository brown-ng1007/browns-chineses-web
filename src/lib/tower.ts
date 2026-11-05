// Hàm thuần cho Tháp Dưa Hấu: không gọi mạng, không đọc ghi gì ngoài tham số.

export const MILESTONE_SIZE = 25; // số từ mỗi mốc
export const REVIEW_TARGET = 20; // lượt chấm thẻ mỗi ngày
export const LISTEN_TARGET = 1; // lượt Nghe mỗi ngày
export const SPEAK_TARGET = 5; // lần đọc Nói mỗi ngày

// Ngưỡng sao theo % từ đã thuộc của cả tầng (tạm, chỉnh được)
const STAR_THRESHOLDS = [0.25, 0.5, 0.8];

export interface FloorDef {
  level: number;
  name: string;
  grad: string; // lớp Tailwind, viết nguyên chuỗi để Tailwind nhận ra
}

// Từ hạt giống ở đáy tháp đến dưa chín ở đỉnh
export const FLOORS: FloorDef[] = [
  { level: 1, name: "Hạt giống", grad: "from-emerald-600 to-green-500" },
  { level: 2, name: "Nảy mầm", grad: "from-green-500 to-lime-500" },
  { level: 3, name: "Dây non", grad: "from-lime-500 to-lime-400" },
  { level: 4, name: "Dây leo", grad: "from-lime-400 to-yellow-400" },
  { level: 5, name: "Nụ hoa", grad: "from-yellow-400 to-orange-400" },
  { level: 6, name: "Hoa nở", grad: "from-orange-400 to-rose-400" },
  { level: 7, name: "Quả xanh", grad: "from-rose-400 to-rose-500" },
  { level: 8, name: "Quả to", grad: "from-rose-500 to-red-500" },
  { level: 9, name: "Dưa chín", grad: "from-red-500 to-pink-500" },
];

export interface FloorStat {
  level: number;
  total: number; // số từ của tầng (HSK 3.0)
  cards: number; // số từ đã có thẻ
  learned: number; // số từ đã thuộc (thẻ ở trạng thái "review")
  pct: number; // 0-1
  stars: 0 | 1 | 2 | 3;
  unlocked: boolean;
  milestonesDone: number;
  milestonesTotal: number;
}

export function starsFor(pct: number): 0 | 1 | 2 | 3 {
  let s = 0;
  for (const t of STAR_THRESHOLDS) if (pct >= t) s++;
  return s as 0 | 1 | 2 | 3;
}

export function buildFloors(
  totals: number[],
  cards: number[],
  learned: number[]
): FloorStat[] {
  const out: FloorStat[] = [];
  for (let i = 0; i < FLOORS.length; i++) {
    const total = totals[i] ?? 0;
    const l = learned[i] ?? 0;
    const pct = total > 0 ? Math.min(1, l / total) : 0;
    const stars = starsFor(pct);
    const prevStars = i > 0 ? out[i - 1].stars : 3;
    out.push({
      level: i + 1,
      total,
      cards: cards[i] ?? 0,
      learned: l,
      pct,
      stars,
      // Mở khi là tầng 1, hoặc tầng dưới đã có sao, hoặc đã học từ ở tầng này rồi
      unlocked: i === 0 || prevStars >= 1 || (cards[i] ?? 0) > 0,
      milestonesDone: Math.floor(l / MILESTONE_SIZE),
      milestonesTotal: Math.ceil(total / MILESTONE_SIZE),
    });
  }
  return out;
}

// Tầng đang leo: tầng đã mở đầu tiên chưa đủ 3 sao
export function currentFloorLevel(floors: FloorStat[]): number {
  const f = floors.find((x) => x.unlocked && x.stars < 3);
  return f ? f.level : FLOORS.length;
}

export function dayStarsFromDone(done: number): 0 | 1 | 2 | 3 {
  if (done >= 4) return 3;
  if (done === 3) return 2;
  if (done === 2) return 1;
  return 0;
}

// Ngày theo giờ máy người dùng, dạng YYYY-MM-DD
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Chuỗi ngày liên tiếp. Hôm nay chưa học thì chuỗi chưa bị đứt, tính từ hôm qua.
export function calcStreak(active: Set<string>, today: Date): number {
  let cursor = today;
  if (!active.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let n = 0;
  while (active.has(dayKey(cursor)) && n < 3650) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function weekStrip(active: Set<string>, today: Date) {
  const out: { key: string; label: string; active: boolean; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = dayKey(d);
    out.push({
      key,
      label: DAY_LABELS[d.getDay()],
      active: active.has(key),
      isToday: i === 0,
    });
  }
  return out;
}
