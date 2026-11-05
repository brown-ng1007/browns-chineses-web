import Dexie, { type Table } from "dexie";
import type {
  Word,
  WordMeaningEn,
  Profile,
  ViUser,
  ViUserStatus,
  ViAttempt,
  SrsCard,
  SrsState,
  ReviewLog,
  LessonProgress,
  WritingSession,
  SkillLog,
} from "@/types/database.types";
import type { CardMemory, Rating } from "@/lib/srs";

/**
 * Cơ sở dữ liệu ngoại tuyến (IndexedDB qua Dexie) cho trình duyệt.
 * Khớp hợp đồng database.types.ts. Không dùng localStorage cho dữ liệu học.
 * Tuyệt đối không chứa vi_candidates.
 */

/** Từ trong hàng đợi ôn (đủ để ôn khi mất mạng). */
export interface SnapshotWord {
  id: string;
  hanzi_simp: string;
  hanzi_trad: string | null;
  pinyin: string;
  meanings: string[];
}

export interface SnapshotItem {
  word: SnapshotWord;
  card: CardMemory | null; // null = thẻ mới
}

/** Ảnh chụp hàng đợi ôn gần nhất, để mở lại khi mất mạng. */
export interface ReviewSnapshot {
  key: string; // luôn là "latest"
  user_id: string;
  saved_at: string;
  level: number;
  items: SnapshotItem[];
  vi: Record<string, { text: string; status: ViUserStatus }>;
}

/**
 * Một lần chấm ôn tập đang chờ gửi lên máy chủ.
 * op_id cũng được dùng làm id của dòng review_logs, nên gửi lại nhiều lần
 * không tạo dòng trùng.
 */
export interface ReviewOutboxItem {
  op_id: string;
  user_id: string;
  word_id: string;
  state: SrsState;
  stability: number;
  difficulty: number;
  due_at: string;
  last_review_at: string | null;
  reps: number;
  lapses: number;
  rating: Rating;
  reviewed_at: string;
  elapsed_seconds: number;
}

export class BrownsChinenesDB extends Dexie {
  words!: Table<Word, string>;
  word_meanings_en!: Table<WordMeaningEn, string>;
  profiles!: Table<Profile, string>;
  vi_user!: Table<ViUser, [string, string]>;
  vi_attempts!: Table<ViAttempt, string>;
  srs_cards!: Table<SrsCard, string>;
  review_logs!: Table<ReviewLog, string>;
  lesson_progress!: Table<LessonProgress, [string, string]>;
  writing_sessions!: Table<WritingSession, string>;
  skill_logs!: Table<SkillLog, string>;
  review_outbox!: Table<ReviewOutboxItem, string>;
  review_snapshot!: Table<ReviewSnapshot, string>;

  constructor() {
    super("browns_chinenes_db");

    this.version(1).stores({
      words:
        "id, hanzi_simp, pinyin_numbered, hsk_old_level, hsk_new_level, frequency_rank",
      word_meanings_en: "id, word_id, sort_order",
      profiles: "user_id, updated_at",
      vi_user: "[user_id+word_id], user_id, word_id, status, updated_at",
      vi_attempts: "id, user_id, word_id, updated_at",
      srs_cards:
        "id, [user_id+word_id], user_id, word_id, state, due_at, updated_at",
      review_logs: "id, user_id, card_id, reviewed_at, updated_at",
      lesson_progress:
        "[user_id+lesson_key], user_id, lesson_key, status, updated_at",
      writing_sessions: "id, user_id, word_id, mode, updated_at",
      skill_logs: "id, user_id, skill, logged_on, updated_at",
    });

    // Version 2: thêm hàng đợi ghi ôn tập và ảnh chụp phiên ôn (chỉ thêm bảng mới)
    this.version(2).stores({
      review_outbox: "op_id, user_id, word_id, reviewed_at",
      review_snapshot: "key",
    });
  }
}

export const db = new BrownsChinenesDB();
