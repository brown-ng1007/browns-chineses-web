// Hàm thuần cho bản đồ chặng tiếng Anh: không gọi mạng, không đọc ghi gì ngoài tham số.
import type { EnWord } from "./words";

export const STAGE_SIZE = 5; // số từ mới mỗi ngày (một chặng thường)
export const BOSS_QUESTIONS = 10; // số câu của chặng boss
export const PASS_RATIO = 0.6; // đạt để hoàn thành bài
export const USE_RATIO = 0.8; // đạt ở phần dùng từ trong câu, và ở bài nhớ lại

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
  // world 0 là các từ nền tảng (A1 đến A2): không đưa lên bản đồ, vẫn tra được ở trang Từ vựng
  const worlds = Array.from(new Set(words.map((w) => w.world)))
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
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

// Chặng thường có 3 sao, mỗi sao là một việc riêng:
//  1 sao: hoàn thành bài trong ngày
//  2 sao: dùng được từ trong câu (đạt từ 80% ở phần dùng từ)
//  3 sao: ngày hôm sau nhớ lại được mà không có gợi ý
export interface Prog {
  stars: number;
  doneOn?: string;
  used: boolean;
  recalled: boolean;
  recallOn?: string;
}

export function starCount(done: boolean, used: boolean, recalled: boolean): number {
  return (done ? 1 : 0) + (done && used ? 1 : 0) + (done && recalled ? 1 : 0);
}

// Chặng boss: sao theo tỉ lệ đúng
export function bossStars(correct: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const r = correct / total;
  if (r >= 0.95) return 3;
  if (r >= 0.8) return 2;
  if (r >= PASS_RATIO) return 1;
  return 0;
}

export interface StageState {
  stage: Stage;
  stars: number;
  unlocked: boolean;
  current: boolean;
  recallDue: boolean; // đã học từ hôm trước, chưa làm bài nhớ lại
  prog?: Prog;
}

// Mở chặng khi chặng liền trước đã có ít nhất 1 sao
export function stageStates(
  stages: Stage[],
  progress: Record<string, Prog>,
  today: string
): StageState[] {
  let currentSet = false;
  return stages.map((s, i) => {
    const prog = progress[s.id];
    const stars = prog?.stars ?? 0;
    const unlocked = i === 0 || (progress[stages[i - 1].id]?.stars ?? 0) >= 1;
    const current = unlocked && stars === 0 && !currentSet;
    if (current) currentSet = true;
    const recallDue =
      !s.boss && !!prog?.doneOn && prog.doneOn < today && !prog.recalled;
    return { stage: s, stars, unlocked, current, recallDue, prog };
  });
}
