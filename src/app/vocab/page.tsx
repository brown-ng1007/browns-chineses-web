"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type {
  Word,
  WordMeaningEn,
  WordsResponse,
  ViUserStatus,
} from "@/types/database.types";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import ViPractice, { type SavedViMeaning } from "@/components/ViPractice";

type WordWithMeanings = Word & { meanings_en: WordMeaningEn[] };

interface ViUserRowPick {
  word_id: string;
  text: string;
  status: ViUserStatus;
}

const PAGE_SIZE = 50;

// Đọc danh sách từ đã lưu trên máy (dùng khi mất mạng).
// Chỉ có những từ bạn đã từng tải khi có mạng.
async function loadWordsFromDexie(
  version: "new" | "old",
  level: number | null,
  cursor: string | null
): Promise<WordsResponse | null> {
  try {
    const offset = cursor !== null ? Number(cursor) : 0;
    if (!Number.isInteger(offset) || offset < 0) return null;

    const levelKey = version === "old" ? "hsk_old_level" : "hsk_new_level";
    const all: Word[] =
      level !== null
        ? await db.words.where(levelKey).equals(level).toArray()
        : await db.words.toArray();

    if (all.length === 0) return null;

    all.sort((a, b) => {
      const ra = a.frequency_rank ?? Number.MAX_SAFE_INTEGER;
      const rb = b.frequency_rank ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    const pageWords = all.slice(offset, offset + PAGE_SIZE);
    if (pageWords.length === 0) {
      return offset > 0 ? { words: [], next_cursor: null } : null;
    }

    const ids = pageWords.map((w) => w.id);
    const meaningRows = await db.word_meanings_en
      .where("word_id")
      .anyOf(ids)
      .toArray();

    const byWord = new Map<string, WordMeaningEn[]>();
    for (const m of meaningRows) {
      const list = byWord.get(m.word_id);
      if (list) {
        list.push(m);
      } else {
        byWord.set(m.word_id, [m]);
      }
    }

    return {
      words: pageWords.map((w) => ({
        ...w,
        meanings_en: (byWord.get(w.id) ?? []).sort(
          (a, b) => a.sort_order - b.sort_order
        ),
      })),
      next_cursor:
        offset + PAGE_SIZE < all.length ? String(offset + PAGE_SIZE) : null,
    };
  } catch {
    return null;
  }
}

export default function VocabPage() {
  const [version, setVersion] = useState<"new" | "old">("new");
  const [level, setLevel] = useState<number | null>(1);
  const [words, setWords] = useState<WordWithMeanings[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [offlineData, setOfflineData] = useState<boolean>(false);
  const [savedViMap, setSavedViMap] = useState<Record<string, SavedViMeaning>>(
    {}
  );
  // Công tắc gộp cách đọc trùng chữ (chỉ ảnh hưởng hiển thị, mặc định tắt)
  const [mergeReadings, setMergeReadings] = useState<boolean>(false);

  // Đánh số mỗi lần tải để bỏ qua kết quả nghĩa đã lưu của lần tải cũ
  const requestIdRef = useRef<number>(0);

  const levels =
    version === "new" ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6];

  // Tải ngầm nghĩa tiếng Việt đã lưu (không chặn việc hiện danh sách từ)
  const loadSavedMeanings = useCallback(
    async (wordIds: string[], append: boolean, requestId: number) => {
      if (wordIds.length === 0) {
        if (!append && requestId === requestIdRef.current) {
          setSavedViMap({});
        }
        return;
      }
      try {
        const supabase = createClient();
        const { data: viRows } = await supabase
          .from("vi_user")
          .select("word_id, text, status")
          .in("word_id", wordIds)
          .is("deleted_at", null);

        if (requestId !== requestIdRef.current) return;

        const typedRows = (viRows ?? []) as ViUserRowPick[];
        const fetchedMap: Record<string, SavedViMeaning> = {};
        for (const row of typedRows) {
          fetchedMap[row.word_id] = {
            text: row.text,
            status: row.status,
          };
        }

        setSavedViMap((prev) =>
          append ? { ...prev, ...fetchedMap } : fetchedMap
        );
      } catch {
        // Bỏ qua nếu không tải được nghĩa đã lưu
      }
    },
    []
  );

  // Lưu đệm vào Dexie (IndexedDB) để dùng ngoại tuyến, không dùng localStorage
  const cacheWords = useCallback(async (data: WordsResponse) => {
    try {
      const plainWords: Word[] = data.words.map(({ meanings_en, ...w }) => {
        void meanings_en;
        return w;
      });
      const allMeanings: WordMeaningEn[] = data.words.flatMap(
        (w) => w.meanings_en
      );
      await db.transaction("rw", db.words, db.word_meanings_en, async () => {
        if (plainWords.length > 0) {
          await db.words.bulkPut(plainWords);
        }
        if (allMeanings.length > 0) {
          await db.word_meanings_en.bulkPut(allMeanings);
        }
      });
    } catch {
      // Bỏ qua nếu trình duyệt chặn IndexedDB ở chế độ ẩn danh
    }
  }, []);

  const fetchWords = useCallback(
    async (cursorToLoad: string | null, append: boolean) => {
      const requestId = ++requestIdRef.current;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setErrorMsg(null);

      try {
        const params = new URLSearchParams();
        params.set("version", version);
        if (level !== null) {
          params.set("level", String(level));
        }
        if (cursorToLoad) {
          params.set("cursor", cursorToLoad);
        }

        let res: Response | null = null;
        try {
          res = await fetch(`/api/words?${params.toString()}`);
        } catch {
          res = null; // mất mạng
        }

        let data: WordsResponse;
        let fromCache = false;

        if (res === null) {
          const cached = await loadWordsFromDexie(version, level, cursorToLoad);
          if (!cached) {
            throw new Error(
              "Không có mạng và chưa có từ nào lưu sẵn trên máy. Hãy mở trang này một lần khi có mạng."
            );
          }
          data = cached;
          fromCache = true;
        } else {
          if (!res.ok) {
            throw new Error(`Lỗi tải từ vựng (mã ${res.status})`);
          }
          data = (await res.json()) as WordsResponse;
        }

        setOfflineData(fromCache);

        // Hiện danh sách từ ngay lập tức
        setWords((prev) => (append ? [...prev, ...data.words] : data.words));
        setNextCursor(data.next_cursor);
        setLoading(false);
        setLoadingMore(false);

        // Việc phụ chạy ngầm, không chờ (bỏ qua khi đang xem bản lưu trên máy)
        if (!fromCache) {
          void loadSavedMeanings(
            data.words.map((w) => w.id),
            append,
            requestId
          );
          void cacheWords(data);
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Không thể tải danh sách từ vựng."
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [version, level, loadSavedMeanings, cacheWords]
  );

  useEffect(() => {
    fetchWords(null, false);
  }, [fetchWords]);

  function handleVersionChange(newVersion: "new" | "old") {
    setVersion(newVersion);
    if (newVersion === "old" && level !== null && level > 6) {
      setLevel(1);
    }
  }

  function handleViSaved(wordId: string, text: string, status: ViUserStatus) {
    setSavedViMap((prev) => ({
      ...prev,
      [wordId]: { text, status },
    }));
  }

  // Gom các thẻ cùng chữ Hán giản thể (giữ nguyên thứ tự xuất hiện đầu tiên).
  // Chỉ dùng để hiển thị, không đổi dữ liệu.
  const groups = useMemo<WordWithMeanings[][]>(() => {
    const map = new Map<string, WordWithMeanings[]>();
    for (const w of words) {
      const existing = map.get(w.hanzi_simp);
      if (existing) {
        existing.push(w);
      } else {
        map.set(w.hanzi_simp, [w]);
      }
    }
    return Array.from(map.values());
  }, [words]);

  const mergedGroupCount = groups.filter((g) => g.length > 1).length;

  function renderHskBadges(word: WordWithMeanings) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {word.hsk_new_level !== null && (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50/90 text-blue-700 border border-blue-200/70">
            HSK 3.0 • {word.hsk_new_level}
          </span>
        )}
        {word.hsk_old_level !== null && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
            2.0 • {word.hsk_old_level}
          </span>
        )}
      </div>
    );
  }

  // Thẻ một từ (cách hiển thị gốc)
  function renderWordCard(word: WordWithMeanings) {
    return (
      <article
        key={word.id}
        className="group rounded-3xl bg-white/90 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_28px_rgb(15,23,42,0.04)] hover:shadow-[0_14px_36px_rgb(37,99,235,0.08)] border border-white/90 hover:border-blue-200/80 transition-all duration-200 flex flex-col justify-between gap-3"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="font-hanzi text-3xl sm:text-4xl font-bold text-slate-900 tracking-wide">
                {word.hanzi_simp}
              </span>
              {word.hanzi_trad && word.hanzi_trad !== word.hanzi_simp && (
                <span className="font-hanzi text-base text-slate-400">
                  ({word.hanzi_trad})
                </span>
              )}
              <span className="text-sm sm:text-base font-semibold text-blue-600 bg-blue-50/80 px-2.5 py-0.5 rounded-lg border border-blue-100">
                {word.pinyin}
              </span>
            </div>
            {renderHskBadges(word)}
          </div>

          <ul className="mt-3.5 space-y-1.5 text-sm text-slate-700">
            {word.meanings_en.map((m) => (
              <li key={m.id} className="flex items-start gap-2 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                <span>{m.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-2 border-t border-slate-100/90">
          <ViPractice
            wordId={word.id}
            savedMeaning={savedViMap[word.id] ?? null}
            onSaved={handleViSaved}
          />
        </div>
      </article>
    );
  }

  // Thẻ gộp: một chữ Hán, nhiều cách đọc. Mỗi cách đọc có khu luyện nghĩa riêng
  // (mỗi lần vẫn chỉ chấm đúng một word_id).
  function renderGroupCard(group: WordWithMeanings[]) {
    const first = group[0];
    const trad =
      group.find((w) => w.hanzi_trad && w.hanzi_trad !== w.hanzi_simp)
        ?.hanzi_trad ?? null;

    return (
      <article
        key={`group-${first.hanzi_simp}`}
        className="rounded-3xl bg-white/90 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_28px_rgb(15,23,42,0.04)] border border-amber-200/70 flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
          <div className="flex items-baseline gap-2.5">
            <span className="font-hanzi text-3xl sm:text-4xl font-bold text-slate-900 tracking-wide">
              {first.hanzi_simp}
            </span>
            {trad && (
              <span className="font-hanzi text-base text-slate-400">
                ({trad})
              </span>
            )}
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
            {group.length} cách đọc
          </span>
        </div>

        {group.map((word, idx) => (
          <div
            key={word.id}
            className={
              idx > 0
                ? "pt-3.5 border-t border-dashed border-slate-200/90"
                : ""
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-semibold text-blue-600 bg-blue-50/80 px-2.5 py-0.5 rounded-lg border border-blue-100">
                {word.pinyin}
              </span>
              {renderHskBadges(word)}
            </div>

            <ul className="mt-2.5 space-y-1.5 text-sm text-slate-700">
              {word.meanings_en.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start gap-2 leading-relaxed"
                >
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span>{m.text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-2">
              <ViPractice
                wordId={word.id}
                savedMeaning={savedViMap[word.id] ?? null}
                onSaved={handleViSaved}
              />
            </div>
          </div>
        ))}
      </article>
    );
  }

  return (
    <main className="space-y-6 pb-8">
      <section className="rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              <span>Từ điển &amp; Nghĩa Việt</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Từ vựng HSK
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Tra cứu chữ Hán giản thể, Pinyin, nghĩa tiếng Anh và tự luyện nghĩa
              tiếng Việt.
            </p>
          </div>

          <div className="inline-flex rounded-2xl bg-slate-100/90 p-1.5 self-start border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleVersionChange("new")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                version === "new"
                  ? "bg-white text-blue-600 shadow-xs ring-1 ring-slate-900/5"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              HSK 3.0 (Mới)
            </button>
            <button
              type="button"
              onClick={() => handleVersionChange("old")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                version === "old"
                  ? "bg-white text-blue-600 shadow-xs ring-1 ring-slate-900/5"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              HSK 2.0 (Cũ)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setLevel(null)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              level === null
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/25"
                : "bg-slate-100/80 text-slate-700 hover:bg-slate-200/70"
            }`}
          >
            Tất cả
          </button>
          {levels.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevel(lv)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                level === lv
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/25"
                  : "bg-slate-100/80 text-slate-700 hover:bg-slate-200/70"
              }`}
            >
              HSK {lv}
            </button>
          ))}
        </div>

        {/* Công tắc gộp cách đọc trùng chữ */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200/60">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              Gộp cách đọc trùng chữ
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {mergeReadings
                ? mergedGroupCount > 0
                  ? `Đang gộp: ${mergedGroupCount} chữ có nhiều cách đọc trong danh sách đã tải.`
                  : "Chưa có chữ nào trong danh sách đã tải có nhiều cách đọc."
                : "Tắt: mỗi cách đọc hiện thành một thẻ riêng (ví dụ 的: de, dī, dí, dì)."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={mergeReadings}
            aria-label="Gộp cách đọc trùng chữ"
            onClick={() => setMergeReadings((prev) => !prev)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${
              mergeReadings
                ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                mergeReadings ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {offlineData && (
        <div className="rounded-2xl bg-amber-50/90 backdrop-blur-md border border-amber-200/80 p-4 text-sm text-amber-900 shadow-xs">
          Đang xem từ vựng đã lưu trên máy (ngoại tuyến). Chỉ có những từ bạn
          từng tải khi có mạng. Nghĩa Việt đã lưu và chấm nghĩa cần có mạng.
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl bg-rose-50/90 backdrop-blur-md border border-rose-200/80 p-4 text-sm text-rose-700 shadow-xs">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl bg-white/80 backdrop-blur-md p-10 text-center text-slate-500 border border-white/90 shadow-xs">
          Đang tải danh sách từ vựng...
        </div>
      ) : words.length === 0 ? (
        <div className="rounded-3xl bg-white/80 backdrop-blur-md p-10 text-center text-slate-500 border border-white/90 shadow-xs">
          Không tìm thấy từ vựng nào ở bộ lọc này.
        </div>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {mergeReadings
            ? groups.map((group) =>
                group.length === 1
                  ? renderWordCard(group[0])
                  : renderGroupCard(group)
              )
            : words.map((word) => renderWordCard(word))}
        </section>
      )}

      {nextCursor !== null && !loading && (
        <div className="flex justify-center pt-3 pb-6">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => fetchWords(nextCursor, true)}
            className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 transition-all"
          >
            {loadingMore ? "Đang tải thêm..." : "Tải thêm 50 từ"}
          </button>
        </div>
      )}
    </main>
  );
}