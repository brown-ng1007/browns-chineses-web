"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ViPractice, { type SavedViMeaning } from "@/components/ViPractice";
import type { SrsState, ViUserStatus } from "@/types/database.types";
import {
  scheduleCard,
  previewLabels,
  type CardMemory,
  type Rating,
} from "@/lib/srs";

const NEW_PER_DAY = 10; // số thẻ mới tối đa mỗi ngày
const MAX_DUE = 100; // số thẻ đến hạn tối đa mỗi phiên
const PAGE = 100;
const MAX_PAGES = 20;

type SupabaseBrowser = ReturnType<typeof createClient>;

interface ReviewWord {
  id: string;
  hanzi_simp: string;
  hanzi_trad: string | null;
  pinyin: string;
  meanings: string[];
}

interface QueueItem {
  word: ReviewWord;
  card: CardMemory | null; // null = thẻ mới, chưa có trong srs_cards
}

interface RawCard {
  word_id: string;
  state: SrsState;
  stability: number | string;
  difficulty: number | string;
  due_at: string;
  last_review_at: string | null;
  reps: number;
  lapses: number;
}

interface RawWord {
  id: string;
  hanzi_simp: string;
  hanzi_trad: string | null;
  pinyin: string;
  word_meanings_en: { text: string; sort_order: number }[] | null;
}

interface SaveJob {
  wordId: string;
  memory: CardMemory;
  rating: Rating;
  reviewedAt: string;
  elapsedSeconds: number;
}

type Phase = "loading" | "error" | "idle" | "reviewing" | "done";

const CARD_COLUMNS =
  "word_id, state, stability, difficulty, due_at, last_review_at, reps, lapses";

const RATING_UI: { rating: Rating; label: string; className: string }[] = [
  {
    rating: 1,
    label: "Quên",
    className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
  },
  {
    rating: 2,
    label: "Khó",
    className: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
  },
  {
    rating: 3,
    label: "Được",
    className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  },
  {
    rating: 4,
    label: "Dễ",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  },
];

function describeDbError(
  error: { code?: string; message?: string } | null
): string {
  if (!error) return "Lỗi không rõ.";
  if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) {
    return "Chưa có quyền lưu lịch ôn vào cơ sở dữ liệu (cần báo Claude để bật quyền ghi).";
  }
  return "Chưa lưu được lúc này.";
}

async function existingCardWordIds(
  supabase: SupabaseBrowser,
  ids: string[]
): Promise<Set<string>> {
  const res = await supabase
    .from("srs_cards")
    .select("word_id")
    .in("word_id", ids);
  const rows = (res.data ?? []) as { word_id: string }[];
  return new Set(rows.map((r) => r.word_id));
}

// Chọn từ mới: ưu tiên từ đã lưu nghĩa Việt, rồi lấp bằng từ theo cấp HSK 3.0
async function pickNewWordIds(
  supabase: SupabaseBrowser,
  level: number,
  remaining: number
): Promise<string[]> {
  if (remaining <= 0) return [];
  const picked: string[] = [];

  const viRes = await supabase
    .from("vi_user")
    .select("word_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE);
  const viIds = ((viRes.data ?? []) as { word_id: string }[]).map(
    (r) => r.word_id
  );
  if (viIds.length > 0) {
    const have = await existingCardWordIds(supabase, viIds);
    for (const id of viIds) {
      if (picked.length >= remaining) break;
      if (!have.has(id) && !picked.includes(id)) picked.push(id);
    }
  }

  for (let p = 0; p < MAX_PAGES && picked.length < remaining; p++) {
    const res = await supabase
      .from("words")
      .select("id")
      .eq("hsk_new_level", level)
      .order("frequency_rank", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(p * PAGE, p * PAGE + PAGE - 1);
    const ids = ((res.data ?? []) as { id: string }[]).map((r) => r.id);
    if (ids.length === 0) break;
    const have = await existingCardWordIds(supabase, ids);
    for (const id of ids) {
      if (picked.length >= remaining) break;
      if (!have.has(id) && !picked.includes(id)) picked.push(id);
    }
    if (ids.length < PAGE) break;
  }

  return picked;
}

// Ghi một lần chấm: cập nhật srs_cards rồi ghi review_logs. Trả về chuỗi lỗi hoặc null.
async function persistJob(
  supabase: SupabaseBrowser,
  userId: string,
  job: SaveJob
): Promise<string | null> {
  try {
    const cardRes = await supabase
      .from("srs_cards")
      .upsert(
        {
          user_id: userId,
          word_id: job.wordId,
          state: job.memory.state,
          stability: job.memory.stability,
          difficulty: job.memory.difficulty,
          due_at: job.memory.due_at,
          last_review_at: job.memory.last_review_at,
          reps: job.memory.reps,
          lapses: job.memory.lapses,
        },
        { onConflict: "user_id,word_id" }
      )
      .select("id")
      .single();
    if (cardRes.error || !cardRes.data) {
      return describeDbError(cardRes.error);
    }
    const cardId = (cardRes.data as { id: string }).id;

    const logRes = await supabase.from("review_logs").insert({
      user_id: userId,
      card_id: cardId,
      rating: job.rating,
      reviewed_at: job.reviewedAt,
      elapsed_seconds: job.elapsedSeconds,
    });
    if (logRes.error) {
      return describeDbError(logRes.error);
    }
    return null;
  } catch {
    return "Mất kết nối mạng.";
  }
}

export default function ReviewPage() {
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [level, setLevel] = useState<number>(1);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [viMap, setViMap] = useState<Record<string, SavedViMeaning>>({});
  const [revealed, setRevealed] = useState<boolean>(false);
  const [reviewedCount, setReviewedCount] = useState<number>(0);

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [saveIssue, setSaveIssue] = useState<string | null>(null);

  const shownAtRef = useRef<number>(Date.now());
  const userIdRef = useRef<string | null>(null);
  const jobsRef = useRef<SaveJob[]>([]);
  const workingRef = useRef<boolean>(false);

  const ensureUserId = useCallback(async (): Promise<string | null> => {
    if (userIdRef.current) return userIdRef.current;
    try {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id ?? null;
      userIdRef.current = id;
      return id;
    } catch {
      return null;
    }
  }, [supabase]);

  // Ghi nền theo đúng thứ tự; gặp lỗi thì dừng để không ghi đè bản mới bằng bản cũ
  const runJobs = useCallback(async () => {
    if (workingRef.current) return;
    workingRef.current = true;
    setSaveIssue(null);
    try {
      while (jobsRef.current.length > 0) {
        const userId = await ensureUserId();
        if (!userId) {
          setSaveIssue("Phiên đăng nhập đã hết hạn. Hãy tải lại trang hoặc đăng nhập lại.");
          break;
        }
        const job = jobsRef.current[0];
        const err = await persistJob(supabase, userId, job);
        if (err) {
          setSaveIssue(err);
          break;
        }
        jobsRef.current.shift();
        setPendingCount(jobsRef.current.length);
      }
    } finally {
      workingRef.current = false;
    }
  }, [supabase, ensureUserId]);

  const loadQueue = useCallback(
    async (lv: number) => {
      setPhase("loading");
      setErrorMsg(null);
      try {
        const nowIso = new Date().toISOString();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [dueRes, countRes] = await Promise.all([
          supabase
            .from("srs_cards")
            .select(CARD_COLUMNS)
            .is("deleted_at", null)
            .lte("due_at", nowIso)
            .order("due_at", { ascending: true })
            .limit(MAX_DUE),
          supabase
            .from("srs_cards")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null)
            .gte("created_at", startOfDay.toISOString()),
        ]);

        if (dueRes.error || countRes.error) {
          setErrorMsg("Chưa tải được thẻ ôn. Hãy thử lại sau ít giây.");
          setPhase("error");
          return;
        }

        const dueCards = (dueRes.data ?? []) as RawCard[];
        const remainingNew = Math.max(0, NEW_PER_DAY - (countRes.count ?? 0));
        const newIds = await pickNewWordIds(supabase, lv, remainingNew);

        const allIds = Array.from(
          new Set([...dueCards.map((c) => c.word_id), ...newIds])
        );

        const wordMap = new Map<string, ReviewWord>();
        const nextViMap: Record<string, SavedViMeaning> = {};

        if (allIds.length > 0) {
          const [wordsRes, viRes] = await Promise.all([
            supabase
              .from("words")
              .select(
                "id, hanzi_simp, hanzi_trad, pinyin, word_meanings_en(text, sort_order)"
              )
              .in("id", allIds),
            supabase
              .from("vi_user")
              .select("word_id, text, status")
              .in("word_id", allIds)
              .is("deleted_at", null),
          ]);

          if (wordsRes.error) {
            setErrorMsg("Chưa tải được nội dung từ vựng. Hãy thử lại sau ít giây.");
            setPhase("error");
            return;
          }

          for (const w of (wordsRes.data ?? []) as unknown as RawWord[]) {
            const meanings = [...(w.word_meanings_en ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((m) => m.text);
            wordMap.set(w.id, {
              id: w.id,
              hanzi_simp: w.hanzi_simp,
              hanzi_trad: w.hanzi_trad,
              pinyin: w.pinyin,
              meanings,
            });
          }

          for (const row of (viRes.data ?? []) as {
            word_id: string;
            text: string;
            status: ViUserStatus;
          }[]) {
            nextViMap[row.word_id] = { text: row.text, status: row.status };
          }
        }

        const items: QueueItem[] = [];
        for (const c of dueCards) {
          const word = wordMap.get(c.word_id);
          if (!word) continue;
          items.push({
            word,
            card: {
              state: c.state,
              stability: Number(c.stability),
              difficulty: Number(c.difficulty),
              due_at: c.due_at,
              last_review_at: c.last_review_at,
              reps: c.reps,
              lapses: c.lapses,
            },
          });
        }
        for (const id of newIds) {
          const word = wordMap.get(id);
          if (word) items.push({ word, card: null });
        }

        setViMap(nextViMap);
        setQueue(items);
        setRevealed(false);
        setReviewedCount(0);
        setPhase("idle");
      } catch {
        setErrorMsg("Không thể kết nối mạng. Hãy thử lại khi có mạng.");
        setPhase("error");
      }
    },
    [supabase]
  );

  useEffect(() => {
    void loadQueue(level);
  }, [level, loadQueue]);

  function handleStart() {
    shownAtRef.current = Date.now();
    setRevealed(false);
    setPhase("reviewing");
  }

  function handleRate(rating: Rating) {
    const current = queue[0];
    if (!current) return;

    const now = new Date();
    const result = scheduleCard(current.card, rating, now);
    const memory: CardMemory = {
      state: result.state,
      stability: result.stability,
      difficulty: result.difficulty,
      due_at: result.due_at,
      last_review_at: result.last_review_at,
      reps: result.reps,
      lapses: result.lapses,
    };

    jobsRef.current.push({
      wordId: current.word.id,
      memory,
      rating,
      reviewedAt: now.toISOString(),
      elapsedSeconds: Math.max(
        0,
        Math.round((Date.now() - shownAtRef.current) / 1000)
      ),
    });
    setPendingCount(jobsRef.current.length);
    void runJobs();

    // Thẻ còn đang học (Quên/Khó) thì xếp lại cuối phiên để ôn ngay trong hôm nay
    const rest = queue.slice(1);
    const nextQueue =
      result.state === "learning" || result.state === "relearning"
        ? [...rest, { word: current.word, card: memory }]
        : rest;

    setQueue(nextQueue);
    setReviewedCount((n) => n + 1);
    setRevealed(false);
    shownAtRef.current = Date.now();
    if (nextQueue.length === 0) setPhase("done");
  }

  function handleViSaved(wordId: string, text: string, status: ViUserStatus) {
    setViMap((prev) => ({ ...prev, [wordId]: { text, status } }));
  }

  const current = queue[0] ?? null;
  const labels = useMemo(
    () => (current ? previewLabels(current.card, new Date()) : null),
    [current]
  );
  const dueCount = queue.filter((q) => q.card !== null).length;
  const newCount = queue.length - dueCount;

  const saveBanner = (pendingCount > 0 || saveIssue) && (
    <div
      className={`rounded-xl border px-3.5 py-2.5 text-sm ${
        saveIssue
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-slate-50 border-slate-200 text-slate-600"
      }`}
    >
      {saveIssue ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {saveIssue} Còn {pendingCount} lần chấm chưa lưu.
          </span>
          <button
            type="button"
            onClick={() => void runJobs()}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Thử lưu lại
          </button>
        </div>
      ) : (
        <span>Đang lưu {pendingCount} lần chấm...</span>
      )}
    </div>
  );

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Ôn tập</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Tự nhớ nghĩa rồi bấm &ldquo;Hiện đáp án&rdquo;, sau đó chấm mức nhớ của
          bạn. Thẻ sẽ quay lại đúng lúc sắp quên.
        </p>
      </section>

      {saveBanner}

      {phase === "loading" && (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500 border border-slate-200">
          Đang chuẩn bị thẻ ôn...
        </div>
      )}

      {phase === "error" && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-5 space-y-3">
          <p className="text-sm text-red-700">{errorMsg}</p>
          <button
            type="button"
            onClick={() => void loadQueue(level)}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {phase === "idle" && (
        <section className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-slate-200 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
              <div className="text-3xl font-bold text-blue-700">{dueCount}</div>
              <div className="text-xs text-blue-700 mt-1">Thẻ đến hạn ôn</div>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <div className="text-3xl font-bold text-emerald-700">
                {newCount}
              </div>
              <div className="text-xs text-emerald-700 mt-1">
                Thẻ mới hôm nay (tối đa {NEW_PER_DAY})
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">
              Thẻ mới lấy từ HSK 3.0 cấp (ưu tiên từ bạn đã lưu nghĩa Việt):
            </p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevel(lv)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                    level === lv
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  HSK {lv}
                </button>
              ))}
            </div>
          </div>

          {queue.length > 0 ? (
            <button
              type="button"
              onClick={handleStart}
              className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition"
            >
              Bắt đầu ôn ({queue.length} thẻ)
            </button>
          ) : (
            <p className="text-sm text-slate-600">
              Hôm nay không còn thẻ nào cần ôn. Bạn có thể đổi cấp HSK ở trên để
              lấy từ mới, hoặc quay lại sau.
            </p>
          )}
        </section>
      )}

      {phase === "reviewing" && current && (
        <section className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-slate-200 space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Còn {queue.length} thẻ</span>
            <span
              className={`px-2 py-0.5 rounded-md font-medium ${
                current.card === null
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              {current.card === null ? "Thẻ mới" : "Ôn lại"}
            </span>
          </div>

          <div className="text-center space-y-1.5 py-4">
            <div className="text-6xl font-bold text-slate-900">
              {current.word.hanzi_simp}
            </div>
            {current.word.hanzi_trad &&
              current.word.hanzi_trad !== current.word.hanzi_simp && (
                <div className="text-sm text-slate-400">
                  ({current.word.hanzi_trad})
                </div>
              )}
            <div className="text-xl font-medium text-blue-600">
              {current.word.pinyin}
            </div>
          </div>

          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="w-full rounded-xl bg-slate-900 px-5 py-4 text-base font-semibold text-white hover:bg-slate-700 transition"
            >
              Hiện đáp án
            </button>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                {viMap[current.word.id] ? (
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Nghĩa Việt bạn đã lưu:
                    </div>
                    <p className="text-lg font-semibold text-slate-900 break-words">
                      {viMap[current.word.id].text}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Bạn chưa lưu nghĩa Việt cho từ này. Có thể tự nhập ở khung
                    bên dưới.
                  </p>
                )}
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Nghĩa tiếng Anh:
                  </div>
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-700 list-disc list-inside">
                    {current.word.meanings.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {RATING_UI.map((r) => (
                  <button
                    key={r.rating}
                    type="button"
                    onClick={() => handleRate(r.rating)}
                    className={`rounded-xl border px-2 py-3 text-center transition ${r.className}`}
                  >
                    <div className="text-base font-semibold">{r.label}</div>
                    <div className="text-xs opacity-80">
                      {labels ? labels[r.rating] : ""}
                    </div>
                  </button>
                ))}
              </div>

              <ViPractice
                key={current.word.id}
                wordId={current.word.id}
                savedMeaning={null}
                onSaved={handleViSaved}
              />
            </div>
          )}
        </section>
      )}

      {phase === "done" && (
        <section className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200 text-center space-y-3">
          <div className="text-4xl">🎉</div>
          <h2 className="text-xl font-bold text-slate-900">Xong phiên ôn!</h2>
          <p className="text-sm text-slate-600">
            Bạn đã chấm {reviewedCount} lượt. Thẻ sẽ quay lại đúng lúc cần ôn.
          </p>
          <button
            type="button"
            disabled={pendingCount > 0}
            onClick={() => void loadQueue(level)}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {pendingCount > 0 ? "Đang lưu..." : "Xem thẻ còn lại"}
          </button>
        </section>
      )}
    </main>
  );
}
