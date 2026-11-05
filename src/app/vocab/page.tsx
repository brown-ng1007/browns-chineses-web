"use client";

import { useEffect, useState, useCallback } from "react";
import type { Word, WordMeaningEn, WordsResponse } from "@/types/database.types";
import { db } from "@/lib/db";

type WordWithMeanings = Word & { meanings_en: WordMeaningEn[] };

export default function VocabPage() {
  const [version, setVersion] = useState<"new" | "old">("new");
  const [level, setLevel] = useState<number | null>(1);
  const [words, setWords] = useState<WordWithMeanings[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const levels = version === "new" ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6];

  const fetchWords = useCallback(
    async (cursorToLoad: string | null, append: boolean) => {
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

        const res = await fetch(`/api/words?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Lỗi tải từ vựng (mã ${res.status})`);
        }

        const data: WordsResponse = await res.json();

        setWords((prev) => (append ? [...prev, ...data.words] : data.words));
        setNextCursor(data.next_cursor);

        // Lưu đệm vào Dexie (IndexedDB) để dùng ngoại tuyến, không dùng localStorage
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
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Không thể tải danh sách từ vựng."
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [version, level]
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

  return (
    <main className="space-y-6">
      <section className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Từ vựng HSK</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Tra cứu chữ Hán giản thể, Pinyin và nghĩa tiếng Anh.
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 self-start">
            <button
              type="button"
              onClick={() => handleVersionChange("new")}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                version === "new"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              HSK 3.0 (Mới)
            </button>
            <button
              type="button"
              onClick={() => handleVersionChange("old")}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                version === "old"
                  ? "bg-white text-slate-900 shadow-xs"
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
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition ${
              level === null
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Tất cả
          </button>
          {levels.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevel(lv)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                level === lv
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              HSK {lv}
            </button>
          ))}
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500 border border-slate-200">
          Đang tải danh sách từ vựng...
        </div>
      ) : words.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500 border border-slate-200">
          Không tìm thấy từ vựng nào ở bộ lọc này.
        </div>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {words.map((word) => (
            <article
              key={word.id}
              className="rounded-2xl bg-white p-4 sm:p-5 shadow-xs border border-slate-200 flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                      {word.hanzi_simp}
                    </span>
                    {word.hanzi_trad && word.hanzi_trad !== word.hanzi_simp && (
                      <span className="text-sm text-slate-400">
                        ({word.hanzi_trad})
                      </span>
                    )}
                    <span className="text-base font-medium text-blue-600">
                      {word.pinyin}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {word.hsk_new_level !== null && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        HSK 3.0: {word.hsk_new_level}
                      </span>
                    )}
                    {word.hsk_old_level !== null && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        2.0: {word.hsk_old_level}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="mt-2.5 space-y-1 text-sm text-slate-700 list-disc list-inside">
                  {word.meanings_en.map((m) => (
                    <li key={m.id}>{m.text}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>
      )}

      {nextCursor !== null && !loading && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => fetchWords(nextCursor, true)}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loadingMore ? "Đang tải thêm..." : "Tải thêm 50 từ"}
          </button>
        </div>
      )}
    </main>
  );
}