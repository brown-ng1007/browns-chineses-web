import Dexie, { type Table } from "dexie";
import type {
  Word,
  WordMeaningEn,
  Profile,
  ViUser,
  ViAttempt,
  SrsCard,
  ReviewLog,
  LessonProgress,
  WritingSession,
  SkillLog,
} from "@/types/database.types";

/**
 * Cơ sở dữ liệu ngoại tuyến (IndexedDB qua Dexie) cho trình duyệt.
 * Khớp hợp đồng database.types.ts. Không dùng localStorage cho dữ liệu học.
 * Tuyệt đối không chứa vi_candidates.
 */
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
  }
}

export const db = new BrownsChinenesDB();