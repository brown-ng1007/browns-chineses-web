/**
 * Brown's Chinenes - kiểu dữ liệu, khớp CƠ SỞ DỮ LIỆU THẬT (đã kiểm tra 05/11/2026)
 * và hợp đồng API v1.1.
 *
 * Quy ước:
 * - Mọi thời gian là chuỗi ISO 8601 (timestamptz) -> string.
 * - Cột "?" hoặc "| null" cho phép để trống trong cơ sở dữ liệu.
 * - Bảng người dùng có created_at, updated_at, deleted_at (xóa mềm).
 *   updated_at do trigger MÁY CHỦ đặt, trình duyệt không tự đặt.
 */

/* ===================== BẢNG THAM CHIẾU (chỉ đọc) ===================== */
/* Chỉ người đã đăng nhập (authenticated) được đọc. anon không đọc gì. */

export interface Source {
  id: string;
  name: string; // duy nhất
  url: string | null;
  license: string;
  version: string | null;
  imported_at: string;
}

export interface Word {
  id: string;
  hanzi_simp: string;
  hanzi_trad: string | null;
  pinyin: string; // có dấu, ví dụ "nǐ hǎo"
  pinyin_numbered: string; // chữ thường, cách nhau dấu cách, ü = u:, thanh nhẹ = 5
  pos: string | null;
  hsk_old_level: number | null; // 1-6 (HSK 2.0)
  hsk_new_level: number | null; // 1-9 (HSK 3.0 bản 2021)
  hsk_newest_level: number | null; // 1-9 (HSK 3.0 bản điều chỉnh mới)
  frequency_rank: number | null;
  radical: string | null;
  created_at: string;
  updated_at: string;
  // Duy nhất: (hanzi_simp, pinyin_numbered)
}

export interface WordMeaningEn {
  id: string;
  word_id: string;
  text: string;
  source_id: string;
  sort_order: number;
  // Duy nhất: (word_id, source_id, text)
}

export interface HanViet {
  id: string;
  hanzi: string;
  reading: string;
  source_id: string;
}

export interface ExampleSentence {
  id: string;
  word_id: string;
  hanzi: string;
  pinyin: string | null;
  meaning_en: string | null;
  meaning_vi: string | null;
  source_id: string;
  // Duy nhất: (word_id, hanzi, source_id)
}

/**
 * CHỈ MÁY CHỦ (service role) đọc được. TUYỆT ĐỐI không import vào code trình duyệt,
 * không truy vấn từ trình duyệt (sẽ bị từ chối).
 */
export interface ViCandidate {
  id: string;
  word_id: string;
  text: string;
  source_id: string;
  confidence: "high" | "medium" | "low";
  is_machine_translated: boolean;
  fetched_at: string;
}

/* ===================== BẢNG NGƯỜI DÙNG ===================== */
/* RLS: chỉ thấy dòng có user_id = auth.uid(). */

interface UserRowMeta {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Profile extends UserRowMeta {
  user_id: string;
  display_name: string | null;
  target_hsk_level: number | null;
  settings: Record<string, unknown>;
}

export type ViUserStatus = "own" | "accepted" | "merged";

export interface ViUser extends UserRowMeta {
  user_id: string; // khóa chính: (user_id, word_id)
  word_id: string;
  text: string;
  status: ViUserStatus;
}

export type ViVerdict = "correct" | "close" | "incorrect";

/** Người dùng chỉ ĐỌC. Máy chủ ghi sau khi chấm. */
export interface ViAttempt extends UserRowMeta {
  id: string;
  user_id: string;
  word_id: string;
  input_text: string;
  verdict: ViVerdict;
  score: number; // 0-100
  explanation: string | null;
  model: string | null;
}

export type SrsState = "new" | "learning" | "review" | "relearning";

export interface SrsCard extends UserRowMeta {
  id: string;
  user_id: string;
  word_id: string; // duy nhất: (user_id, word_id)
  state: SrsState;
  stability: number;
  difficulty: number;
  due_at: string;
  last_review_at: string | null;
  reps: number; // >= 0
  lapses: number; // >= 0
}

export interface ReviewLog extends UserRowMeta {
  id: string;
  user_id: string;
  card_id: string;
  rating: 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
  reviewed_at: string;
  elapsed_seconds: number | null; // >= 0
}

export interface LessonProgress extends UserRowMeta {
  user_id: string; // khóa chính: (user_id, lesson_key)
  lesson_key: string;
  status: string; // mặc định 'in_progress'
  score: number | null;
  completed_at: string | null;
}

export type WritingMode = "trace" | "guided" | "free";

export interface WritingSession extends UserRowMeta {
  id: string;
  user_id: string;
  word_id: string;
  mode: WritingMode;
  strokes: unknown[]; // jsonb, mặc định []
  duration_seconds: number | null; // >= 0
}

export type Skill = "listening" | "speaking" | "reading" | "writing";

export interface SkillLog extends UserRowMeta {
  id: string;
  user_id: string;
  skill: Skill;
  minutes: number; // numeric, PHẢI > 0 (không ghi 0 phút)
  accuracy: number | null; // 0-1
  logged_on: string; // date "YYYY-MM-DD", mặc định ngày UTC hôm nay
}

/* ===================== HỢP ĐỒNG API (máy chủ Next.js, cần đăng nhập) ===================== */

/** POST /api/vi/attempt */
export interface ViAttemptRequest {
  word_id: string;
  input_text: string;
}
export interface ViAttemptResponse {
  attempt_id: string;
  verdict: ViVerdict;
  score: number; // 0-100
  explanation: string; // tối đa 2 câu tiếng Việt
  candidates: string[]; // CHỈ trả về sau khi đã lưu lượt thử
  suggested_text: string | null;
}

/** POST /api/vi/confirm */
export type ViConfirmChoice = "keep_mine" | "accept_candidate" | "merge";
export interface ViConfirmRequest {
  word_id: string;
  choice: ViConfirmChoice;
  text: string;
}

/** GET /api/words?level=&version=new|old&cursor=  (KHÔNG kèm vi_candidates) */
export interface WordsQuery {
  level?: number;
  version?: "new" | "old";
  cursor?: string;
}
export interface WordsResponse {
  words: Array<Word & { meanings_en: WordMeaningEn[] }>;
  next_cursor: string | null;
}

/** POST /api/sync  (last-write-wins theo updated_at do máy chủ đặt) */
export interface SyncRequest {
  since: string | null;
  changes: {
    profiles?: Profile[];
    vi_user?: ViUser[];
    srs_cards?: SrsCard[];
    review_logs?: ReviewLog[];
    lesson_progress?: LessonProgress[];
    writing_sessions?: WritingSession[];
    skill_logs?: SkillLog[];
  };
}
export interface SyncResponse {
  server_time: string;
  changes: SyncRequest["changes"];
}