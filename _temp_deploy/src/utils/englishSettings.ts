export interface EnglishVoiceConfig {
  voiceURI: string;
  rate: number;
  pitch: number;
  accentFilter: 'ALL' | 'en-US' | 'en-GB' | 'en-AU';
}

const VOICE_STORAGE_KEY = 'melon_en_voice_config';

export const getSavedVoiceConfig = (): EnglishVoiceConfig => {
  if (typeof window === 'undefined') {
    return { voiceURI: '', rate: 1.0, pitch: 1.0, accentFilter: 'ALL' };
  }
  try {
    const saved = localStorage.getItem(VOICE_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load voice config:', e);
  }
  return { voiceURI: '', rate: 1.0, pitch: 1.0, accentFilter: 'ALL' };
};

export const saveVoiceConfig = (config: EnglishVoiceConfig): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(config));
};

export const speakEnglish = (text: string, customRate?: number): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const config = getSavedVoiceConfig();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();

  let selectedVoice = voices.find((v) => v.voiceURI === config.voiceURI);

  if (!selectedVoice) {
    const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    selectedVoice =
      enVoices.find((v) => v.name.includes('Natural') || v.name.includes('Google US English')) ||
      enVoices.find((v) => v.lang === 'en-US') ||
      enVoices[0];
  }

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }

  utterance.rate = customRate ?? config.rate ?? 1.0;
  utterance.pitch = config.pitch ?? 1.0;
  window.speechSynthesis.speak(utterance);
};

export const resetEnglishProgress = async (options?: {
  mode?: 'UNIT_ONLY' | 'ALL_ENGLISH';
  supabaseClient?: any;
  userId?: string;
  tableName?: string;
}): Promise<void> => {
  const mode = options?.mode ?? 'ALL_ENGLISH';
  const keysToKeep = [VOICE_STORAGE_KEY, 'supabase.auth.token'];

  if (typeof window !== 'undefined') {
    if (mode === 'UNIT_ONLY') {
      localStorage.removeItem('melon_current_unit_progress');
    } else {
      Object.keys(localStorage).forEach((key) => {
        const lower = key.toLowerCase();
        const isProgressKey =
          lower.includes('english') ||
          lower.includes('en_') ||
          lower.includes('progress') ||
          lower.includes('xp') ||
          lower.includes('unit') ||
          lower.includes('vocab') ||
          lower.includes('streak');

        if (isProgressKey && !keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  if (mode === 'ALL_ENGLISH' && options?.supabaseClient && options?.userId) {
    const table = options.tableName || 'user_english_progress';
    await options.supabaseClient.from(table).delete().eq('user_id', options.userId);
  }
};
