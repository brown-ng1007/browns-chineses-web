// Hàm thuần cho bản đồ chặng tiếng Anh: không gọi mạng, không đọc ghi gì ngoài tham số.
import type { EnWord } from "./words";

export const STAGE_SIZE = 6; // số từ mới mỗi chặng thường
export const BOSS_QUESTIONS = 10; // số câu của chặng boss

export interface Stage {
  id: string;
  index: number; // thứ tự trên cả bản đồ, bắt đầu từ 0
  world: number;
  n: number; // chặng thứ mấy trong thế giới (1..total)
  total: number; // số chặng của thế giới, tính cả boss
  boss: boolean;
  wordIds: string[];
}

export function buildStages(words: EnWord[]): Stage[] {
  const worlds = Array.from(new Set(words.map((w) => w.world))).sort((a, b) => a - b);
  const out: Stage[] = [];
  for (const world of worlds) {
    const ws = words.filter((w) => w.world === world);
    const chunks: EnWord[][] = [];
    for (let i = 0; i < ws.length; i += STAGE_SIZE) chunks.push(ws.slice(i, i + STAGE_SIZE));
    const total = chunks.length + 1;
    chunks.forEach((c, k) =>
      out.push({
        id: `w${world}-s${k + 1}`,
        index: out.length,
        world,
        n: k + 1,
        total,
        boss: false,
        wordIds: c.map((x) => x.id),
      })
    );
    out.push({
      id: `w${world}-boss`,
      index: out.length,
      world,
      n: total,
      total,
      boss: true,
      wordIds: ws.map((x) => x.id),
    });
  }
  return out;
}

export function starsFor(correct: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const r = correct / total;
  if (r >= 0.95) return 3;
  if (r >= 0.8) return 2;
  if (r >= 0.6) return 1;
  return 0;
}

export interface StageState {
  stage: Stage;
  stars: number;
  unlocked: boolean;
  current: boolean;
}

// Mở chặng khi chặng liền trước đã có ít nhất 1 sao
export function stageStates(stages: Stage[], progress: Record<string, number>): StageState[] {
  let currentSet = false;
  return stages.map((s, i) => {
    const stars = progress[s.id] ?? 0;
    const unlocked = i === 0 || (progress[stages[i - 1].id] ?? 0) >= 1;
    const current = unlocked && stars === 0 && !currentSet;
    if (current) currentSet = true;
    return { stage: s, stars, unlocked, current };
  });
}
