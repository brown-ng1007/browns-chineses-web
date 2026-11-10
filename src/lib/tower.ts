// Hàm thuần cho Tháp Dưa Hấu: không gọi mạng, không đọc ghi gì ngoài tham số.

export const MILESTONE_SIZE = 25; // số từ mỗi mốc
export const REVIEW_TARGET = 20; // lượt chấm thẻ mỗi ngày
export const LISTEN_TARGET = 1; // lượt Nghe mỗi ngày
export const SPEAK_TARGET = 5; // lần đọc Nói mỗi ngày

// Ngưỡng sao cũ vẫn dùng ở một số thống kê phụ trợ.
const STAR_THRESHOLDS = [0.25, 0.5, 0.8];

// Mỗi cành có 16 checkpoint dưa hấu, chia nhỏ theo số từ đã thuộc.
export const FRUITS_PER_BRANCH = 16;
// Mỗi cành có 16 checkpoint: 8 quả trên cành chính và 8 quả trên cành phụ.
// Tám ngưỡng nền cũ vẫn được giữ nguyên; mỗi ngưỡng có thêm một mốc trung gian.
export const FRUIT_CAPS = [20, 40, 80, 120, 160, 200, 250, 300];

export function fruitTargetsFor(total: number): number[] {
  const base = FRUIT_CAPS.map((cap, i) =>
    Math.max(1, Math.min(Math.ceil(total * ((i + 1) / FRUIT_CAPS.length)), cap))
  );
  const targets: number[] = [];
  base.forEach((target, index) => {
    const previous = index === 0 ? 0 : base[index - 1];
    // Mỗi cặp gồm một mục tiêu nhỏ ở giữa và ngưỡng gốc; ngưỡng cũ không bị thay đổi.
    targets.push(Math.max(1, Math.ceil((previous + target) / 2)));
    targets.push(target);
  });
  return targets;
}

export interface FruitMicroLesson {
  title: string;
  description: string;
  href: string;
  minutes: number;
}

// Mỗi quả đại diện một bài luyện nhỏ khác nhau, dùng các công cụ học đã có sẵn.
export const FRUIT_MICRO_LESSONS: readonly FruitMicroLesson[] = [
  { title: "Gieo hạt · Học 5 từ mới", description: "Chọn một nhóm từ nhỏ và thêm vào bộ thẻ đang học.", href: "/vocab", minutes: 5 },
  { title: "Tưới cây · Ôn 5 thẻ", description: "Củng cố những từ đã gặp để chuyển dần sang trạng thái đã thuộc.", href: "/review", minutes: 5 },
  { title: "Lắng nghe · Nhận diện từ", description: "Nghe âm tiếng Trung rồi chọn từ tương ứng.", href: "/listen", minutes: 5 },
  { title: "Cất tiếng · Đọc thành tiếng", description: "Luyện phát âm từng từ, chú ý âm đầu và thanh điệu.", href: "/speak", minutes: 5 },
  { title: "Nét chữ · Viết 3 chữ Hán", description: "Quan sát thứ tự nét và tự viết lại một nhóm chữ ngắn.", href: "/write", minutes: 6 },
  { title: "Gắn nghĩa · Ôn từ theo cặp", description: "Nhắc lại mặt chữ, pinyin và nghĩa của các từ đã lưu.", href: "/review", minutes: 5 },
  { title: "Từ theo chủ đề · Mở rộng vốn từ", description: "Tìm thêm từ cùng chủ đề để dễ liên kết và ghi nhớ.", href: "/vocab", minutes: 6 },
  { title: "Ôn đúng lúc · Củng cố từ khó", description: "Ưu tiên thẻ đến hạn để giảm quên và giữ nhịp SRS.", href: "/review", minutes: 5 },
  { title: "Nghe phân biệt · Chọn âm đúng", description: "Nghe kỹ và phân biệt những từ có âm gần nhau.", href: "/listen", minutes: 5 },
  { title: "Thanh điệu · Phát âm theo mẫu", description: "Đọc theo mẫu và chú ý đường đi của bốn thanh điệu.", href: "/speak", minutes: 5 },
  { title: "Viết từ ghép · Nhớ mặt chữ", description: "Luyện viết một vài chữ trong từ ghép đã học.", href: "/write", minutes: 7 },
  { title: "Nghe rồi nhắc · Luyện phản xạ", description: "Nghe từ/cụm từ và nhắc lại ngay sau khi nhận diện.", href: "/listen", minutes: 5 },
  { title: "Cụm từ · Kết hợp từ mới", description: "Mở rộng từ đơn thành cụm từ quen thuộc.", href: "/vocab", minutes: 6 },
  { title: "Ôn tổng hợp · Nhớ lại từ cũ", description: "Ôn các thẻ đến hạn trước khi chuyển sang nhóm mới.", href: "/review", minutes: 6 },
  { title: "Nghe nhanh · Kiểm tra tai", description: "Làm một lượt nghe ngắn để tự kiểm tra khả năng nhận diện.", href: "/listen", minutes: 5 },
  { title: "Bài tổng kết · Chạm checkpoint", description: "Ôn lại nhóm từ vừa tích lũy trước khi đi tới quả tiếp theo.", href: "/review", minutes: 7 },
];

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
  stars: number; // số quả đã đạt (0..FRUITS_PER_BRANCH)
  targets: number[]; // số từ đã thuộc cần để từng checkpoint dưa hấu chín
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
    const targets = fruitTargetsFor(total);
    // Tầng chưa có từ nào thì chưa có quả chín
    const stars = total > 0 ? targets.filter((t) => l >= t).length : 0;
    const prevStars = i > 0 ? out[i - 1].stars : FRUITS_PER_BRANCH;
    out.push({
      level: i + 1,
      total,
      cards: cards[i] ?? 0,
      learned: l,
      pct,
      stars,
      targets,
      // Mở khi là tầng 1, hoặc tầng dưới đã có sao, hoặc đã học từ ở tầng này rồi
      unlocked: i === 0 || prevStars >= 1 || (cards[i] ?? 0) > 0,
      milestonesDone: Math.floor(l / MILESTONE_SIZE),
      milestonesTotal: Math.ceil(total / MILESTONE_SIZE),
    });
  }
  return out;
}

// Tầng đang leo: tầng đã mở đầu tiên chưa hoàn thành đủ 16 checkpoint
export function currentFloorLevel(floors: FloorStat[]): number {
  const f = floors.find((x) => x.unlocked && x.stars < FRUITS_PER_BRANCH);
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

/* =====================================================================
   Chia HSK 7 thành 3 tầng (7, 8, 9) và chia nhỏ mỗi quả thành các chặng ngày
   ===================================================================== */

// HSK 3.0 cấp 7 có ~5.700 từ, quá lớn cho một tầng nên chia 3 phần đều nhau
// theo thứ tự tần suất (cột rank trong bảng words, từ thường gặp xếp trước).
// Nếu tên cột khác, đổi SPLIT_COLUMN. Cột không có thì tự chia theo id.
export const SPLIT_LEVEL = 7;
export const SPLIT_PARTS = 3;
export const SPLIT_COLUMN = "rank";

export function splitSizes(n: number, parts: number = SPLIT_PARTS): number[] {
  const base = Math.floor(n / parts);
  const extra = n % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

// Từ cuối cùng (tính cả nó) của tầng 7 và tầng 8; phần còn lại thuộc tầng 9
export interface SplitBoundary {
  rank: number | null;
  id: string;
}

function cmpWord(ar: number | null, aid: string, br: number | null, bid: string): number {
  const x = ar ?? Infinity;
  const y = br ?? Infinity;
  if (x !== y) return x < y ? -1 : 1;
  return aid < bid ? -1 : aid > bid ? 1 : 0;
}

/** Từ thuộc tầng nào (1-9). Cấp 1-6 là tầng 1-6; cấp 7 chia theo mốc; cấp khác trả 0. */
export function floorOfWord(
  level: number,
  rank: number | null,
  id: string,
  bounds: SplitBoundary[]
): number {
  if (level >= 1 && level < SPLIT_LEVEL) return level;
  if (level !== SPLIT_LEVEL) return 0;
  for (let i = 0; i < bounds.length; i++) {
    if (cmpWord(rank, id, bounds[i].rank, bounds[i].id) <= 0) return SPLIT_LEVEL + i;
  }
  return SPLIT_LEVEL + bounds.length;
}

/* ---------- Chặng ngày ---------- */
// Một chặng = số từ mới mỗi ngày (newPerDay trong Cài đặt). Mỗi quả dưa được
// chia thành các chặng liên tiếp; xong chặng nào là xong mục tiêu của ngày đó.

export interface FruitPlan {
  k: number; // chỉ số quả, từ 0 đến FRUITS_PER_BRANCH - 1
  target: number; // số từ đã thuộc để quả chín
  prev: number; // mốc của quả trước (0 nếu là quả đầu)
  need: number; // còn thiếu bao nhiêu từ
  days: number; // còn ước chừng bao nhiêu ngày
  stageTotal: number; // quả này có bao nhiêu chặng
  stageNow: number; // đang ở chặng thứ mấy (1..stageTotal)
  stageGoal: number; // mốc số từ đã thuộc để xong chặng hôm nay
  stageLeft: number; // còn bao nhiêu từ để xong chặng hôm nay
  ripe: boolean;
}

export function fruitPlan(f: FloorStat, k: number, pace: number): FruitPlan {
  const p = Math.max(1, Math.round(pace));
  const target = f.targets[k];
  const prev = k > 0 ? f.targets[k - 1] : 0;
  const span = Math.max(1, target - prev);
  const stageTotal = Math.max(1, Math.ceil(span / p));
  const ripe = f.learned >= target;
  const stageNow = ripe
    ? stageTotal
    : Math.min(stageTotal, Math.floor(Math.max(0, f.learned - prev) / p) + 1);
  const stageGoal = ripe ? target : Math.min(target, prev + stageNow * p);
  const need = Math.max(0, target - f.learned);
  return {
    k,
    target,
    prev,
    need,
    days: Math.ceil(need / p),
    stageTotal,
    stageNow,
    stageGoal,
    stageLeft: Math.max(0, stageGoal - f.learned),
    ripe,
  };
}

export interface StageChip {
  idx: number; // 1..stageTotal
  state: "done" | "now" | "todo";
  fill: number; // 0-1, chỉ dùng cho chặng đang làm
}

export function stageChips(f: FloorStat, k: number, pace: number): StageChip[] {
  const p = Math.max(1, Math.round(pace));
  const plan = fruitPlan(f, k, p);
  const out: StageChip[] = [];
  for (let i = 1; i <= plan.stageTotal; i++) {
    const start = plan.prev + (i - 1) * p;
    const end = Math.min(plan.target, plan.prev + i * p);
    if (f.learned >= end) out.push({ idx: i, state: "done", fill: 1 });
    else if (!plan.ripe && i === plan.stageNow) {
      const size = Math.max(1, end - start);
      out.push({ idx: i, state: "now", fill: Math.max(0, Math.min(1, (f.learned - start) / size)) });
    } else out.push({ idx: i, state: "todo", fill: 0 });
  }
  return out;
}
