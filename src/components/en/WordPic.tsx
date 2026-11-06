"use client";

import { useState } from "react";
import type { EnWord } from "@/lib/en/words";

// Hình minh họa của từ: ưu tiên ảnh, chưa có ảnh thì dùng biểu tượng ngữ cảnh, không có gì thì không hiện.
export default function WordPic({ w, small = false }: { w: Pick<EnWord, "word" | "image" | "emoji">; small?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (w.image && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={w.image}
        alt={w.word}
        loading="lazy"
        onError={() => setBroken(true)}
        className={
          small
            ? "h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-stone-200"
            : "h-44 w-full rounded-2xl object-cover ring-1 ring-stone-200"
        }
      />
    );
  }
  if (w.emoji) {
    return (
      <div
        className={
          small
            ? "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-3xl"
            : "flex h-36 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 text-7xl"
        }
        role="img"
        aria-label={w.word}
      >
        {w.emoji}
      </div>
    );
  }
  return null;
}
