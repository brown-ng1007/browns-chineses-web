import { createClient } from "@/lib/supabase/client";

export interface AppSettings {
  newPerDay: number; // số thẻ mới mỗi ngày
  ttsRate: number; // tốc độ đọc (0.5 - 1.2)
  voiceURI: string | null; // giọng đọc đã chọn (khác nhau giữa các máy)
  listenLevel: number; // cấp HSK cho Nghe / Nói
}

export const DEFAULT_SETTINGS: AppSettings = {
  newPerDay: 10,
  ttsRate: 0.9,
  voiceURI: null,
  listenLevel: 1,
};

const KEY = "browns_chinenes_settings_v1";

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // bỏ qua nếu trình duyệt chặn lưu trữ
  }
}

/* ---------- Đồng bộ giữa các máy qua profiles.settings.app ---------- */
/* Giọng đọc (voiceURI) mỗi máy một khác nên không đồng bộ. */

type SyncShape = Pick<AppSettings, "newPerDay" | "ttsRate" | "listenLevel">;

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function fetchServerSettings(): Promise<Partial<SyncShape> | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("settings")
    .eq("user_id", uid)
    .maybeSingle();
  if (error || !data) return null;
  const app = (data.settings as Record<string, unknown> | null)?.app;
  return app && typeof app === "object" ? (app as Partial<SyncShape>) : null;
}

async function pushServerSettings(s: AppSettings): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  const supabase = createClient();
  const existing = await supabase
    .from("profiles")
    .select("settings")
    .eq("user_id", uid)
    .maybeSingle();
  const old =
    (existing.data?.settings as Record<string, unknown> | null) ?? {};
  const app: SyncShape = {
    newPerDay: s.newPerDay,
    ttsRate: s.ttsRate,
    listenLevel: s.listenLevel,
  };
  await supabase
    .from("profiles")
    .upsert({ user_id: uid, settings: { ...old, app } }, { onConflict: "user_id" });
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Gửi cài đặt lên máy chủ sau 0,8 giây không đổi nữa. Lỗi thì bỏ qua, bản trong máy vẫn còn. */
export function pushSettingsDebounced(s: AppSettings): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushServerSettings(s).catch(() => undefined);
  }, 800);
}

/** Lấy cài đặt mới nhất: ưu tiên máy chủ (chờ tối đa 1,5 giây), không được thì dùng bản trong máy. */
export async function refreshSettings(timeoutMs = 1500): Promise<AppSettings> {
  const local = loadSettings();
  try {
    const server = await Promise.race([
      fetchServerSettings(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (server) {
      const merged = { ...local, ...server };
      saveSettings(merged);
      return merged;
    }
  } catch {
    // mất mạng: dùng bản trong máy
  }
  return local;
}
