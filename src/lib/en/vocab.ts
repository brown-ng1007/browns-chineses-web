// Đọc bộ từ vựng tiếng Anh từ bảng english_vocabulary trên Supabase.
// Có bản lưu trong máy (Dexie) để mở nhanh và dùng khi mất mạng.
// Nếu không đọc được gì, rơi về bộ từ mẫu trong code để app vẫn chạy.
import { db, type EnVocabCache } from "@/lib/db";
import { EN_WORLDS, SEED_WORDS, wordsFromRows, type EnWord, type RawVocabRow } from "@/lib/en/words";

export type EnSource = "supabase" | "cache" | "seed";
export interface EnStatus {
  source: EnSource;
  count: number; // số từ đang dùng
  noVi: number; // số từ chưa có nghĩa tiếng Việt
  detail: string; // lý do, khi phải dùng bộ từ mẫu hoặc bản lưu cũ
}

const CACHE_KEY = "vocab-v2";
const CACHE_MS = 7 * 24 * 60 * 60 * 1000; // dùng bản lưu tối đa 7 ngày rồi tải lại
const PAGE = 1000;
const COLS = "*"; // lấy mọi cột, kể cả cột ảnh minh họa khi đã thêm
const SEED_WORLD_LIST = [...EN_WORLDS];

let status: EnStatus = { source: "seed", count: SEED_WORDS.length, noVi: 0, detail: "" };
let loading: Promise<EnWord[]> | null = null;

export function getEnStatus(): EnStatus {
  return status;
}

function applyRows(rows: RawVocabRow[], source: EnSource, detail: string): EnWord[] {
  const { words, worlds, noVi } = wordsFromRows(rows);
  if (words.length === 0) return applySeed("Bảng từ vựng không có dòng hợp lệ");
  EN_WORLDS.length = 0;
  EN_WORLDS.push(...worlds);
  status = { source, count: words.length, noVi, detail };
  return words;
}

function applySeed(detail: string): EnWord[] {
  EN_WORLDS.length = 0;
  EN_WORLDS.push(...SEED_WORLD_LIST);
  status = { source: "seed", count: SEED_WORDS.length, noVi: 0, detail };
  return SEED_WORDS;
}

async function fetchAll(): Promise<RawVocabRow[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("thiếu biến môi trường Supabase trên trình duyệt");
  const headers: Record<string, string> = { apikey: key, Prefer: "count=exact" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  const out: RawVocabRow[] = [];
  let total: number | null = null;
  for (let from = 0; from < 50000; from += PAGE) {
    const res = await fetch(
      `${base}/rest/v1/english_vocabulary?select=${COLS}&order=id.asc&limit=${PAGE}&offset=${from}`,
      { headers }
    );
    if (!res.ok) throw new Error(`Supabase trả về mã ${res.status}`);
    const m = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "");
    if (m) total = Number(m[1]);
    const part = (await res.json()) as RawVocabRow[];
    out.push(...part);
    if (part.length === 0) break;
    if (total !== null ? out.length >= total : part.length < PAGE) break;
  }
  return out;
}

async function doLoad(): Promise<EnWord[]> {
  let cached: EnVocabCache | undefined;
  try {
    cached = await db.en_cache.get(CACHE_KEY);
  } catch {
    // chưa đọc được bản lưu trong máy
  }
  const cachedRows = cached && Array.isArray(cached.rows) ? (cached.rows as RawVocabRow[]) : [];
  const fresh = !!cached && Date.now() - Date.parse(cached.saved_at) < CACHE_MS;
  if (cachedRows.length > 0 && fresh) return applyRows(cachedRows, "cache", "");

  let detail = "";
  try {
    const rows = await fetchAll();
    if (rows.length > 0) {
      try {
        await db.en_cache.put({ key: CACHE_KEY, saved_at: new Date().toISOString(), rows });
      } catch {
        // không lưu được trong máy: vẫn dùng bình thường
      }
      return applyRows(rows, "supabase", "");
    }
    detail = "bảng english_vocabulary trả về 0 dòng (kiểm tra quyền đọc)";
  } catch (e) {
    detail = e instanceof Error ? e.message : String(e);
  }
  if (cachedRows.length > 0) return applyRows(cachedRows, "cache", `không kết nối được (${detail}), đang dùng bản lưu cũ`);
  return applySeed(detail);
}

export function loadEnWords(): Promise<EnWord[]> {
  if (!loading) {
    loading = doLoad().then((w) => {
      if (status.source === "seed") loading = null; // lần sau thử đọc lại
      return w;
    });
  }
  return loading;
}
