import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WORDS_PAGE_SIZE } from "@/lib/config";
import type { Word, WordMeaningEn, WordsResponse } from "@/types/database.types";

/**
 * GET /api/words?level=&version=new|old&cursor=
 * - Yêu cầu đăng nhập (kiểm tra phiên Supabase ở máy chủ).
 * - Lọc theo hsk_new_level hoặc hsk_old_level tương ứng.
 * - Sắp xếp ổn định: frequency_rank ASC NULLS LAST, id ASC.
 * - Phân trang theo cursor (dạng offset số nguyên >= 0), tối đa 50 từ mỗi trang.
 * - Trả về kiểu WordsResponse (kèm meanings_en sắp theo sort_order).
 * - Tuyệt đối KHÔNG đụng bảng vi_candidates.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Kiểm tra phiên từ cookie (không gọi mạng thêm). Bảng từ vựng vẫn do RLS bảo vệ:
  // Supabase tự xác minh token ở truy vấn bên dưới, token giả sẽ không đọc được gì.
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const versionParam = searchParams.get("version");
  const version: "new" | "old" = versionParam === "old" ? "old" : "new";

  const levelParam = searchParams.get("level");
  let level: number | undefined = undefined;
  if (levelParam !== null && levelParam.trim() !== "") {
    const parsedLevel = Number(levelParam);
    const maxLevel = version === "old" ? 6 : 9;
    if (
      !Number.isInteger(parsedLevel) ||
      parsedLevel < 1 ||
      parsedLevel > maxLevel
    ) {
      return NextResponse.json(
        { error: `Invalid level for version ${version}` },
        { status: 400 }
      );
    }
    level = parsedLevel;
  }

  const cursorParam = searchParams.get("cursor");
  let offset = 0;
  if (cursorParam !== null && cursorParam.trim() !== "") {
    const parsedCursor = Number(cursorParam);
    if (!Number.isInteger(parsedCursor) || parsedCursor < 0) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    offset = parsedCursor;
  }

  let query = supabase
    .from("words")
    .select(
      `
      id,
      hanzi_simp,
      hanzi_trad,
      pinyin,
      pinyin_numbered,
      pos,
      hsk_old_level,
      hsk_new_level,
      hsk_newest_level,
      frequency_rank,
      radical,
      created_at,
      updated_at,
      word_meanings_en (
        id,
        word_id,
        text,
        source_id,
        sort_order
      )
    `
    );

  if (level !== undefined) {
    const levelColumn = version === "old" ? "hsk_old_level" : "hsk_new_level";
    query = query.eq(levelColumn, level);
  }

  // Lấy dư 1 dòng để biết chính xác còn trang tiếp theo hay không
  const { data, error } = await query
    .order("frequency_rank", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(offset, offset + WORDS_PAGE_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > WORDS_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, WORDS_PAGE_SIZE) : rows;

  const words: Array<Word & { meanings_en: WordMeaningEn[] }> = pageRows.map(
    (row) => {
      const rawMeanings = Array.isArray(row.word_meanings_en)
        ? (row.word_meanings_en as WordMeaningEn[])
        : [];
      const sortedMeanings = [...rawMeanings].sort(
        (a, b) => a.sort_order - b.sort_order
      );

      return {
        id: row.id,
        hanzi_simp: row.hanzi_simp,
        hanzi_trad: row.hanzi_trad,
        pinyin: row.pinyin,
        pinyin_numbered: row.pinyin_numbered,
        pos: row.pos,
        hsk_old_level: row.hsk_old_level,
        hsk_new_level: row.hsk_new_level,
        hsk_newest_level: row.hsk_newest_level,
        frequency_rank: row.frequency_rank,
        radical: row.radical,
        created_at: row.created_at,
        updated_at: row.updated_at,
        meanings_en: sortedMeanings,
      };
    }
  );

  const response: WordsResponse = {
    words,
    next_cursor: hasMore ? String(offset + WORDS_PAGE_SIZE) : null,
  };

  // Dữ liệu từ vựng gần như không đổi: cho trình duyệt nhớ để lần mở sau hiện ngay
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "private, max-age=300, stale-while-revalidate=86400",
    },
  });
}