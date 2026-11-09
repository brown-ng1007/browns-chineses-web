import React from 'react';

interface EnglishWatermarkBgProps {
  isEnglishMode?: boolean;
}

export const EnglishWatermarkBg: React.FC<EnglishWatermarkBgProps> = ({
  isEnglishMode = true,
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none select-none overflow-hidden z-0">
      {/* Bên trái: Aa (English) hoặc 西 (Chinese) */}
      <span
        className="absolute left-[4%] top-[54%] -translate-y-1/2 -rotate-6 font-serif font-bold text-teal-900/[0.045]"
        style={{ fontSize: isEnglishMode ? '168px' : '150px' }}
      >
        {isEnglishMode ? 'Aa' : '西'}
      </span>

      {/* Bên phải: Phiên âm IPA / CEFR (English) hoặc 瓜 (Chinese) */}
      <span
        className="absolute right-[3.5%] top-[28%] -translate-y-1/2 rotate-6 font-serif italic font-semibold text-teal-900/[0.045]"
        style={{ fontSize: isEnglishMode ? '92px' : '150px' }}
      >
        {isEnglishMode ? '/ˈɪŋ.ɡlɪʃ/' : '瓜'}
      </span>

      {/* Huy hiệu chìm góc dưới cho English Mode */}
      {isEnglishMode && (
        <span className="absolute left-[6%] bottom-[10%] font-serif text-4xl font-bold tracking-widest text-amber-900/[0.035]">
          TOEIC 635 → IELTS 5.0
        </span>
      )}
    </div>
  );
};
