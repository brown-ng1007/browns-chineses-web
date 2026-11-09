import React, { useEffect, useState } from 'react';
import {
  EnglishVoiceConfig,
  getSavedVoiceConfig,
  saveVoiceConfig,
  speakEnglish,
  resetEnglishProgress,
} from '../utils/englishSettings';

interface EnglishSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetSuccess?: () => void;
  supabaseClient?: any;
  userId?: string;
}

export const EnglishSettingsModal: React.FC<EnglishSettingsModalProps> = ({
  isOpen,
  onClose,
  onResetSuccess,
  supabaseClient,
  userId,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [config, setConfig] = useState<EnglishVoiceConfig>(getSavedVoiceConfig());
  const [confirmResetStep, setConfirmResetStep] = useState<'IDLE' | 'CONFIRM_UNIT' | 'CONFIRM_ALL'>('IDLE');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const allVoices = window.speechSynthesis.getVoices();
      const englishVoices = allVoices
        .filter((v) => v.lang.toLowerCase().startsWith('en'))
        .sort((a, b) => {
          const aScore = a.name.includes('Natural') || a.name.includes('Google') ? 1 : 0;
          const bScore = b.name.includes('Natural') || b.name.includes('Google') ? 1 : 0;
          return bScore - aScore;
        });

      setVoices(englishVoices);

      if (!config.voiceURI && englishVoices.length > 0) {
        const defaultConfig = { ...config, voiceURI: englishVoices[0].voiceURI };
        setConfig(defaultConfig);
        saveVoiceConfig(defaultConfig);
      }
    };

    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const filteredVoices = voices.filter((v) => {
    if (config.accentFilter === 'ALL') return true;
    return v.lang.replace('_', '-').startsWith(config.accentFilter);
  });

  const handleConfigChange = (partial: Partial<EnglishVoiceConfig>) => {
    const updated = { ...config, ...partial };
    setConfig(updated);
    saveVoiceConfig(updated);
  };

  const handleReset = async (mode: 'UNIT_ONLY' | 'ALL_ENGLISH') => {
    setIsResetting(true);
    try {
      await resetEnglishProgress({ mode, supabaseClient, userId });
      setConfirmResetStep('IDLE');
      if (onResetSuccess) {
        onResetSuccess();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Lỗi khi xóa tiến độ:', error);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">⚙ Cài đặt Tiếng Anh</h2>
            <p className="text-xs text-slate-500">Tùy chỉnh giọng đọc phát âm & quản lý dữ liệu học tập</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* Chọn giọng đọc */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              🔊 Giọng đọc Tiếng Anh (Text-to-Speech)
            </label>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'en-US', label: '🇺🇸 Anh - Mỹ' },
                { id: 'en-GB', label: '🇬🇧 Anh - Anh' },
                { id: 'en-AU', label: '🇦🇺 Anh - Úc' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleConfigChange({ accentFilter: tab.id as any })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    config.accentFilter === tab.id
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={config.voiceURI}
              onChange={(e) => handleConfigChange({ voiceURI: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 focus:border-teal-600 focus:bg-white focus:outline-none"
            >
              {filteredVoices.length === 0 ? (
                <option value="">Mặc định hệ thống (en-US)</option>
              ) : (
                filteredVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang}) {v.name.includes('Natural') ? '⭐ Tự nhiên' : ''}
                  </option>
                ))
              )}
            </select>

            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Tốc độ đọc:</span>
                  <span className="font-semibold text-teal-700">{config.rate}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.3"
                  step="0.05"
                  value={config.rate}
                  onChange={(e) => handleConfigChange({ rate: parseFloat(e.target.value) })}
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  speakEnglish('Practice makes perfect. Welcome to Melon Language!')
                }
                className="shrink-0 rounded-xl bg-teal-50 border border-teal-200 px-4 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition"
              >
                ▶ Nghe thử
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Xóa tiến độ */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-rose-800">🗑 Quản lý & Xóa tiến độ</h3>
              <p className="text-xs text-rose-600/90 mt-0.5">
                Đặt lại các chặng học, điểm XP và trạng thái từ vựng Tiếng Anh về ban đầu.
              </p>
            </div>

            {confirmResetStep === 'IDLE' ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmResetStep('CONFIRM_UNIT')}
                  className="rounded-lg bg-white border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                >
                  Đặt lại Unit hiện tại
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetStep('CONFIRM_ALL')}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-sm"
                >
                  Xóa toàn bộ tiến độ Tiếng Anh
                </button>
              </div>
            ) : (
              <div className="rounded-lg bg-white p-3 border border-rose-200 space-y-2.5">
                <p className="text-xs font-medium text-slate-700">
                  ⚠️ Bạn có chắc chắn muốn{' '}
                  <b>
                    {confirmResetStep === 'CONFIRM_ALL'
                      ? 'xóa toàn bộ tiến độ Tiếng Anh (XP, chặng học, lịch sử ôn tập)'
                      : 'đặt lại tiến độ của Unit hiện tại về 0'}
                  </b>
                  ? Hành động này không thể hoàn tác.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={() =>
                      handleReset(confirmResetStep === 'CONFIRM_ALL' ? 'ALL_ENGLISH' : 'UNIT_ONLY')
                    }
                    className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {isResetting ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetStep('IDLE')}
                    className="rounded-lg bg-slate-100 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition"
          >
            Đóng & Lưu
          </button>
        </div>
      </div>
    </div>
  );
};
