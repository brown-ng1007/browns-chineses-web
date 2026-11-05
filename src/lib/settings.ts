export interface AppSettings {
  newPerDay: number; // số thẻ mới mỗi ngày
  ttsRate: number; // tốc độ đọc (0.5 - 1.2)
  voiceURI: string | null; // giọng đọc đã chọn
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
