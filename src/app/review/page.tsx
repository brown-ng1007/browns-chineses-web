"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  db,
  type ReviewOutboxItem,
  type SnapshotItem,
  type SnapshotWord,
} from "@/lib/db";
import ViPractice, { type SavedViMeaning } from "@/components/ViPractice";
import type { SrsState, ViUserStatus } from "@/types/database.types";
import {
  scheduleCard,
  previewLabels,
  type CardMemory,
  type Rating,
} from "@/lib/srs";
import { refreshSettings } from "@/lib/settings";

const MAX_DUE = 100; // số thẻ đến hạn tối đa mỗi phiên
const PAGE = 100;
const MAX_PAGES = 20;
const NETWORK_ERROR = "Mất kết nối mạng.";

type SupabaseBrowser = ReturnType<typeof createClient>;

type ReviewWord = SnapshotWord;
type QueueItem = SnapshotItem;

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

type DbError = { code?: string; message?: string } | null;

// Lỗi do mất mạng (khác với lỗi quyền hay lỗi dữ liệu)
function isNetworkIssue(error: DbError): boolean {
  if (!error) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  return (
    !error.code && /fetch|network|load failed/i.test(error.message ?? "")
  );
}

function describeDbError(error: DbError): string {
  if (!error) return "Lỗi không rõ.";
  if (isNetworkIssue(error)) return NETWORK_ERROR;
  if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) {
    return "Chưa có quyền lưu lịch ôn vào cơ sở dữ liệu (cần báo Claude để bật quyền ghi).";
  }
  return "Chưa lưu được lúc này.";
}

function newOpId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const WORD_PAGE = 300;

// Lấy một lần mọi word_id đã có thẻ (thay cho việc hỏi lại sau mỗi trang từ).
// Trang đầu kèm tổng số dòng, các trang còn lại tải song song.
async function allCardWordIds(
  supabase: SupabaseBrowser
): Promise<Set<string>> {
  const out = new Set<string>();
  const first = await supabase
    .from("srs_cards")
    .select("word_id", { count: "exact" })
    .order("word_id", { ascending: true })
    .range(0, 999);
  for (const r of (first.data ?? []) as { word_id: string }[]) {
    out.add(r.word_id);
  }
  const total = first.count ?? 0;
  if (total > 1000) {
    const more = Math.min(19, Math.ceil(total / 1000) - 1);
    const rest = await Promise.all(
      Array.from({ length: more }, (_, i) =>
        supabase
          .from("srs_cards")
          .select("word_id")
          .order("word_id", { ascending: true })
          .range((i + 1) * 1000, (i + 1) * 1000 + 999)
      )
    );
    for (const res of rest) {
      for (const r of (res.data ?? []) as { word_id: string }[]) {
        out.add(r.word_id);
      }
    }
  }
  return out;
}

function wordsPage(
  supabase: SupabaseBrowser,
  level: number,
  page: number
) {
  return supabase
    .from("words")
    .select("id")
    .eq("hsk_new_level", level)
    .order("frequency_rank", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(page * WORD_PAGE, page * WORD_PAGE + WORD_PAGE - 1);
}

// Kho ứng viên từ mới. Tất cả truy vấn chạy song song, và chạy cùng lúc với
// việc tải thẻ đến hạn, nên không phải chờ nhau.
interface NewPool {
  viIds: string[]; // từ đã lưu nghĩa Việt gần đây
  have: Set<string>; // từ đã có thẻ
  pages: string[][]; // hai trang từ đầu của cấp (theo tần suất)
}

async function fetchNewPool(
  supabase: SupabaseBrowser,
  level: number
): Promise<NewPool> {
  const [viRes, have, p0, p1] = await Promise.all([
    supabase
      .from("vi_user")
      .select("word_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(PAGE),
    allCardWordIds(supabase),
    wordsPage(supabase, level, 0),
    wordsPage(supabase, level, 1),
  ]);
  const ids = (r: { data: unknown }) =>
    ((r.data ?? []) as { id: string }[]).map((x) => x.id);
  return {
    viIds: ((viRes.data ?? []) as { word_id: string }[]).map((r) => r.word_id),
    have,
    pages: [ids(p0), ids(p1)],
  };
}

// Chọn từ mới: ưu tiên từ đã lưu nghĩa Việt, rồi lấp bằng từ theo cấp HSK 3.0.
// Chỉ khi hai trang đầu đã có thẻ hết mới phải hỏi thêm trang sau.
async function pickNewWordIds(
  supabase: SupabaseBrowser,
  level: number,
  remaining: number,
  pool: NewPool
): Promise<string[]> {
  if (remaining <= 0) return [];
  const picked: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (picked.length >= remaining) return;
    if (pool.have.has(id) || seen.has(id)) return;
    seen.add(id);
    picked.push(id);
  };

  for (const id of pool.viIds) add(id);

  for (let p = 0; p < MAX_PAGES && picked.length < remaining; p++) {
    let ids: string[];
    if (p < pool.pages.length) {
      ids = pool.pages[p];
    } else {
      const res = await wordsPage(supabase, level, p);
      ids = ((res.data ?? []) as { id: string }[]).map((r) => r.id);
    }
    if (ids.length === 0) break;
    for (const id of ids) add(id);
    if (ids.length < WORD_PAGE) break;
  }

  return picked;
}

// Gửi một lần chấm lên máy chủ. Trả về chuỗi lỗi hoặc null nếu thành công.
// An toàn khi gửi lại nhiều lần:
// - srs_cards dùng upsert; nếu máy chủ đã có lần ôn MỚI HƠN thì không ghi đè lịch.
// - review_logs dùng id = op_id; trùng id (23505) coi như đã ghi xong.
async function persistOutboxItem(
  supabase: SupabaseBrowser,
  item: ReviewOutboxItem
): Promise<string | null> {
  try {
    const existing = await supabase
      .from("srs_cards")
      .select("id, last_review_at")
      .eq("user_id", item.user_id)
      .eq("word_id", item.word_id)
      .maybeSingle();
    if (existing.error) return describeDbError(existing.error);

    const row = existing.data as {
      id: string;
      last_review_at: string | null;
    } | null;

    let cardId: string | null = row?.id ?? null;
    const serverIsNewer =
      row?.last_review_at != null &&
      new Date(row.last_review_at).getTime() >
        new Date(item.reviewed_at).getTime();

    if (!serverIsNewer) {
      const cardRes = await supabase
        .from("srs_cards")
        .upsert(
          {
            user_id: item.user_id,
            word_id: item.word_id,
            state: item.state,
            stability: item.stability,
            difficulty: item.difficulty,
            due_at: item.due_at,
            last_review_at: item.last_review_at,
            reps: item.reps,
            lapses: item.lapses,
          },
          { onConflict: "user_id,word_id" }
        )
        .select("id")
        .single();
      if (cardRes.error || !cardRes.data) {
        return describeDbError(cardRes.error);
      }
      cardId = (cardRes.data as { id: string }).id;
    }

    if (!cardId) return "Chưa lưu được lúc này.";

    const logRes = await supabase.from("review_logs").insert({
      id: item.op_id,
      user_id: item.user_id,
      card_id: cardId,
      rating: item.rating,
      reviewed_at: item.reviewed_at,
      elapsed_seconds: item.elapsed_seconds,
    });
    if (logRes.error) {
      if (logRes.error.code === "23505") return null; // đã ghi từ trước
      return describeDbError(logRes.error);
    }
    return null;
  } catch {
    return NETWORK_ERROR;
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
  const [newPerDay, setNewPerDay] = useState<number>(10);

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [saveIssue, setSaveIssue] = useState<string | null>(null);
  const [offlineWaiting, setOfflineWaiting] = useState<boolean>(false);
  const [offlineMode, setOfflineMode] = useState<boolean>(false);
  const [snapshotTime, setSnapshotTime] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const shownAtRef = useRef<number>(Date.now());
  const userIdRef = useRef<string | null>(null);
  const workingRef = useRef<boolean>(false);
  const phaseRef = useRef<Phase>("loading");
  const loadIdRef = useRef<number>(0); // bỏ qua kết quả của lượt tải cũ

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const ensureUserId = useCallback(async (): Promise<string | null> => {
    if (userIdRef.current) return userIdRef.current;
    try {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id ?? null;
      if (id) {
        userIdRef.current = id;
        return id;
      }
    } catch {
      // Có thể đang mất mạng, thử lấy từ ảnh chụp phiên ôn gần nhất
    }
    try {
      const snap = await db.review_snapshot.get("latest");
      return snap?.user_id ?? null;
    } catch {
      return null;
    }
  }, [supabase]);

  // Gửi lần lượt các lần chấm đang chờ (theo thời gian). Gặp lỗi thì dừng,
  // lần chấm đó vẫn nằm trong hàng đợi trên máy.
  const flushOutbox = useCallback(async () => {
    if (workingRef.current) return;
    workingRef.current = true;
    try {
      const userId = await ensureUserId();
      if (!userId) return;
      for (;;) {
        const list = await db.review_outbox
          .where("user_id")
          .equals(userId)
          .sortBy("reviewed_at");
        setPendingCount(list.length);
        if (list.length === 0) {
          setSaveIssue(null);
          setOfflineWaiting(false);
          break;
        }
        const err = await persistOutboxItem(supabase, list[0]);
        if (err === NETWORK_ERROR) {
          setSaveIssue(null);
          setOfflineWaiting(true);
          break;
        }
        if (err) {
          setOfflineWaiting(false);
          setSaveIssue(err);
          break;
        }
        await db.review_outbox.delete(list[0].op_id);
      }
    } catch {
      setSaveIssue("Chưa lưu được lúc này.");
    } finally {
      workingRef.current = false;
    }
  }, [supabase, ensureUserId]);

  const loadQueue = useCallback(
    async (lv: number) => {
      const myId = ++loadIdRef.current;
      setErrorMsg(null);
      setOfflineMode(false);

      // Dùng ảnh chụp phiên ôn đã lưu trên máy (khi mất mạng)
      const applySnapshot = async (): Promise<boolean> => {
        try {
          const snap = await db.review_snapshot.get("latest");
          const uid = await ensureUserId();
          if (!snap || !uid || snap.user_id !== uid) return false;
          setViMap(snap.vi);
          setQueue(snap.items);
          setRevealed(false);
          setReviewedCount(0);
          setSnapshotTime(snap.saved_at);
          setOfflineMode(true);
          setPhase("idle");
          return true;
        } catch {
          return false;
        }
      };

      // Hiện NGAY các thẻ đã lưu trên máy trong hôm nay (nếu có), trong lúc
      // tải bản mới nhất từ mạng ở phía sau. Cùng cấp HSK và còn thẻ mới dùng.
      let usedCache = false;
      try {
        const snap = await db.review_snapshot.get("latest");
        const uid = await ensureUserId();
        if (
          snap &&
          uid &&
          snap.user_id === uid &&
          snap.level === lv &&
          snap.items.length > 0 &&
          new Date(snap.saved_at).toDateString() === new Date().toDateString()
        ) {
          setViMap(snap.vi);
          setQueue(snap.items);
          setRevealed(false);
          setReviewedCount(0);
          setSnapshotTime(snap.saved_at);
          setPhase("idle");
          setRefreshing(true);
          usedCache = true;
        }
      } catch {
        // Không đọc được bản lưu thì tải bình thường
      }
      if (!usedCache) setPhase("loading");

      // Lỗi khi tải: nếu đã có thẻ trên màn hình thì giữ nguyên, chỉ báo ngoại tuyến
      const fail = async (e: DbError, msg: string) => {
        if (loadIdRef.current !== myId) return;
        if (usedCache) {
          setOfflineMode(true);
          return;
        }
        if (isNetworkIssue(e) && (await applySnapshot())) return;
        setErrorMsg(msg);
        setPhase("error");
      };

      try {
        // Những lần chấm còn tồn trên máy lúc mở trang (đọc từ máy, rất nhanh)
        const uid0 = await ensureUserId();
        let pendingAtStart: ReviewOutboxItem[] = [];
        if (uid0) {
          try {
            pendingAtStart = await db.review_outbox
              .where("user_id")
              .equals(uid0)
              .toArray();
          } catch {
            pendingAtStart = [];
          }
        }
        // Chỉ chờ gửi xong khi thật sự có lần chấm tồn (để đếm thẻ mới hôm nay
        // cho đúng). Bình thường không có thì bỏ qua, đỡ mất một vòng mạng.
        if (pendingAtStart.length > 0) await flushOutbox();

        const nowIso = new Date().toISOString();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Một lượt song song: thẻ đến hạn, số thẻ mới hôm nay, cài đặt và kho từ mới
        const [dueRes, countRes, pool, settings] = await Promise.all([
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
          fetchNewPool(supabase, lv),
          refreshSettings().catch(() => null),
        ]);

        if (dueRes.error || countRes.error) {
          await fail(
            dueRes.error ?? countRes.error,
            "Chưa tải được thẻ ôn. Hãy thử lại sau ít giây."
          );
          return;
        }

        const dueCards = (dueRes.data ?? []) as RawCard[];
        const limit = settings?.newPerDay ?? 10; // lấy từ tab Cài đặt
        setNewPerDay(limit);
        const remainingNew = Math.max(0, limit - (countRes.count ?? 0));
        const newIds = await pickNewWordIds(supabase, lv, remainingNew, pool);

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
            await fail(
              wordsRes.error,
              "Chưa tải được nội dung từ vựng. Hãy thử lại sau ít giây."
            );
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

        let items: QueueItem[] = [];
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

        // Từ vừa chấm mà chưa gửi xong thì không đưa lại vào hàng đợi
        const uid = await ensureUserId();
        if (uid) {
          const pendingNow = await db.review_outbox
            .where("user_id")
            .equals(uid)
            .toArray();
          const pendingIds = new Set<string>([
            ...pendingAtStart.map((p) => p.word_id),
            ...pendingNow.map((p: ReviewOutboxItem) => p.word_id),
          ]);
          if (pendingIds.size > 0) {
            items = items.filter((i) => !pendingIds.has(i.word.id));
          }
          void db.review_snapshot
            .put({
              key: "latest",
              user_id: uid,
              saved_at: new Date().toISOString(),
              level: lv,
              items,
              vi: nextViMap,
            })
            .catch(() => undefined);
        }

        // Bạn đã bấm "Bắt đầu ôn" bằng thẻ lưu sẵn thì không đổi hàng đợi giữa chừng
        if (loadIdRef.current !== myId) return;
        if (phaseRef.current === "reviewing") return;

        setViMap(nextViMap);
        setQueue(items);
        setRevealed(false);
        setReviewedCount(0);
        setOfflineMode(false);
        setPhase("idle");
      } catch {
        if (loadIdRef.current !== myId) return;
        if (usedCache) {
          setOfflineMode(true);
          return;
        }
        if (await applySnapshot()) return;
        setErrorMsg("Không thể kết nối mạng và chưa có thẻ nào lưu sẵn trên máy.");
        setPhase("error");
      } finally {
        if (loadIdRef.current === myId) setRefreshing(false);
      }
    },
    [supabase, flushOutbox, ensureUserId]
  );

  useEffect(() => {
    void loadQueue(level);
  }, [level, loadQueue]);

  // Có mạng lại thì tự gửi những lần chấm còn tồn
  useEffect(() => {
    const onOnline = () => {
      void flushOutbox();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushOutbox]);

  function handleStart() {
    shownAtRef.current = Date.now();
    setRevealed(false);
    setPhase("reviewing");
  }

  // Lưu lần chấm vào hàng đợi trên máy rồi gửi nền
  async function saveRating(
    wordId: string,
    memory: CardMemory,
    rating: Rating,
    reviewedAt: string,
    elapsedSeconds: number,
    nextQueue: QueueItem[]
  ) {
    const userId = await ensureUserId();
    if (!userId) {
      setSaveIssue(
        "Phiên đăng nhập đã hết hạn. Hãy tải lại trang hoặc đăng nhập lại."
      );
      return;
    }

    const item: ReviewOutboxItem = {
      op_id: newOpId(),
      user_id: userId,
      word_id: wordId,
      state: memory.state,
      stability: memory.stability,
      difficulty: memory.difficulty,
      due_at: memory.due_at,
      last_review_at: memory.last_review_at,
      reps: memory.reps,
      lapses: memory.lapses,
      rating,
      reviewed_at: reviewedAt,
      elapsed_seconds: elapsedSeconds,
    };

    try {
      await db.review_outbox.put(item);
    } catch {
      // Trình duyệt chặn IndexedDB: gửi thẳng một lần
      const err = await persistOutboxItem(supabase, item);
      if (err) {
        setSaveIssue(
          err === NETWORK_ERROR
            ? "Mất kết nối mạng và trình duyệt không cho lưu tạm trên máy."
            : err
        );
      }
      return;
    }

    void db.review_snapshot
      .put({
        key: "latest",
        user_id: userId,
        saved_at: new Date().toISOString(),
        level,
        items: nextQueue,
        vi: viMap,
      })
      .catch(() => undefined);

    setPendingCount(
      await db.review_outbox.where("user_id").equals(userId).count()
    );
    void flushOutbox();
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

    // Thẻ còn đang học (Quên/Khó) thì xếp lại cuối phiên để ôn ngay trong hôm nay
    const rest = queue.slice(1);
    const nextQueue: QueueItem[] =
      result.state === "learning" || result.state === "relearning"
        ? [...rest, { word: current.word, card: memory }]
        : rest;

    const elapsed = Math.max(
      0,
      Math.round((Date.now() - shownAtRef.current) / 1000)
    );

    setQueue(nextQueue);
    setReviewedCount((n) => n + 1);
    setRevealed(false);
    shownAtRef.current = Date.now();
    if (nextQueue.length === 0) setPhase("done");

    void saveRating(
      current.word.id,
      memory,
      rating,
      now.toISOString(),
      elapsed,
      nextQueue
    );
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

  const saveBanner =
    saveIssue || pendingCount > 0 ? (
      <div
        className={`rounded-xl border px-3.5 py-2.5 text-sm ${
          saveIssue
            ? "bg-red-50 border-red-200 text-red-700"
            : offlineWaiting
              ? "bg-amber-50 border-amber-200 text-amber-800"
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
              onClick={() => void flushOutbox()}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Thử lưu lại
            </button>
          </div>
        ) : offlineWaiting ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Đang ngoại tuyến. {pendingCount} lần chấm đã lưu trên máy, sẽ tự
              gửi khi có mạng.
            </span>
            <button
              type="button"
              onClick={() => void flushOutbox()}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Thử gửi lại
            </button>
          </div>
        ) : (
          <span>Đang lưu {pendingCount} lần chấm...</span>
        )}
      </div>
    ) : null;

  const offlineBanner = offlineMode ? (
    <div className="rounded-xl border bg-amber-50 border-amber-200 px-3.5 py-2.5 text-sm text-amber-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          Đang dùng thẻ đã lưu trên máy
          {snapshotTime
            ? ` (lưu lúc ${new Date(snapshotTime).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })})`
            : ""}
          . Có mạng thì bấm &ldquo;Kết nối lại&rdquo; để lấy thẻ mới nhất.
        </span>
        <button
          type="button"
          onClick={() => void loadQueue(level)}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
        >
          Kết nối lại
        </button>
      </div>
    </div>
  ) : null;

  return (
    <main className="space-y-4 pb-8">
      <section className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Ôn tập</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Tự nhớ nghĩa rồi bấm &ldquo;Hiện đáp án&rdquo;, sau đó chấm mức nhớ của
          bạn. Thẻ sẽ quay lại đúng lúc sắp quên.
        </p>
      </section>

      {offlineBanner}
      {saveBanner}

      {phase === "loading" && (
        <div
          className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-4"
          aria-busy="true"
          aria-label="Đang chuẩn bị thẻ ôn"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="h-[84px] rounded-2xl bg-rose-100/60 animate-pulse" />
            <div className="h-[84px] rounded-2xl bg-emerald-100/60 animate-pulse" />
          </div>
          <div className="h-4 w-2/3 rounded-md bg-stone-200/60 animate-pulse" />
          <div className="h-[52px] rounded-2xl bg-rose-200/60 animate-pulse" />
        </div>
      )}

      {phase === "error" && (
        <div className="rounded-3xl bg-red-50/90 backdrop-blur-xl border border-red-200 p-5 space-y-3">
          <p className="text-sm text-red-700">{errorMsg}</p>
          <button
            type="button"
            onClick={() => void loadQueue(level)}
            className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20"
          >
            Thử lại
          </button>
        </div>
      )}

      {phase === "idle" && (
        <section className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-indigo-50/80 border border-indigo-200/70 p-4 text-center">
              <div className="text-3xl font-bold text-blue-700">{dueCount}</div>
              <div className="text-xs text-blue-700 mt-1">Thẻ đến hạn ôn</div>
            </div>
            <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200/70 p-4 text-center">
              <div className="text-3xl font-bold text-emerald-700">
                {newCount}
              </div>
              <div className="text-xs text-emerald-700 mt-1">
                Thẻ mới hôm nay (tối đa {newPerDay})
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
                  className={`px-3.5 py-2 rounded-2xl text-sm font-medium transition ${
                    level === lv
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  HSK {lv}
                </button>
              ))}
            </div>
          </div>

          {refreshing && (
            <p className="flex items-center gap-2 text-xs font-medium text-rose-500">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" />
              Đang cập nhật thẻ mới nhất...
            </p>
          )}

          {queue.length > 0 ? (
            <button
              type="button"
              onClick={handleStart}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200"
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
        <section className="p-5 sm:p-7 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Còn {queue.length} thẻ</span>
            <span
              className={`px-2 py-0.5 rounded-md font-medium ${
                current.card === null
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-indigo-50 text-indigo-700"
              }`}
            >
              {current.card === null ? "Thẻ mới" : "Ôn lại"}
            </span>
          </div>

          <div className="text-center space-y-1.5 py-4">
            <div className="font-hanzi text-6xl font-bold text-slate-900">
              {current.word.hanzi_simp}
            </div>
            {current.word.hanzi_trad &&
              current.word.hanzi_trad !== current.word.hanzi_simp && (
                <div className="text-sm text-slate-400">
                  ({current.word.hanzi_trad})
                </div>
              )}
            <div className="text-xl font-medium text-indigo-600">
              {current.word.pinyin}
            </div>
          </div>

          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-base font-semibold text-white shadow-md shadow-slate-900/20 hover:bg-slate-700 transition-all duration-200"
            >
              Hiện đáp án
            </button>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50/80 border border-slate-200/70 p-4 space-y-3">
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
                    className={`rounded-2xl border px-2 py-3 text-center transition-all duration-200 hover:-translate-y-0.5 ${r.className}`}
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
        <section className="p-6 rounded-3xl bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 text-center space-y-3">
          <div className="text-4xl">🎉</div>
          <h2 className="text-xl font-bold text-slate-900">Xong phiên ôn!</h2>
          <p className="text-sm text-slate-600">
            Bạn đã chấm {reviewedCount} lượt. Thẻ sẽ quay lại đúng lúc cần ôn.
          </p>
          <button
            type="button"
            disabled={pendingCount > 0}
            onClick={() => void loadQueue(level)}
            className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all duration-200"
          >
            {pendingCount > 0
              ? offlineWaiting
                ? "Chờ có mạng để lưu..."
                : "Đang lưu..."
              : "Xem thẻ còn lại"}
          </button>
        </section>
      )}
    </main>
  );
}
