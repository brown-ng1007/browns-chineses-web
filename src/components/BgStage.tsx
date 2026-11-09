"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const HANZI = [
  { c: "西", left: "6%", top: "58%", size: 120, dur: 22, delay: 0, rot: -8 },
  { c: "瓜", left: "84%", top: "22%", size: 150, dur: 26, delay: -6, rot: 6 },
];

const EN_MARKS = [
  {
    main: "Aa",
    sub: "/ˈɪŋ.ɡlɪʃ/",
    tag: "OXFORD · CEFR B1–B2",
    left: "3.5%",
    top: "52%",
    size: 118,
    dur: 24,
    delay: 0,
    rot: -6,
  },
  {
    main: "IELTS",
    sub: "TOEIC 635 → 5.0+",
    tag: "LEXICON & FLUENCY",
    left: "80%",
    top: "20%",
    size: 86,
    dur: 28,
    delay: -5,
    rot: 5,
  },
];

export default function BgStage() {
  const pathname = usePathname();
  const [lastLang, setLastLang] = useState<"en" | "zh">("zh");

  useEffect(() => {
    if (pathname === "/en" || pathname.startsWith("/en/")) {
      setLastLang("en");
      try {
        sessionStorage.setItem("melon_last_lang", "en");
      } catch {}
    } else if (pathname !== "/settings") {
      setLastLang("zh");
      try {
        sessionStorage.setItem("melon_last_lang", "zh");
      } catch {}
    } else {
      try {
        const saved = sessionStorage.getItem("melon_last_lang");
        if (saved === "en" || saved === "zh") setLastLang(saved);
      } catch {}
    }
  }, [pathname]);

  const isEn =
    pathname === "/en" ||
    pathname.startsWith("/en/") ||
    (pathname === "/settings" && lastLang === "en");

  if (isEn) {
    return (
      <div className="bg-stage bg-stage--en" aria-hidden="true">
        <div className="bg-blob b1" />
        <div className="bg-blob b2" />
        <div className="bg-blob b3" />
        <div className="bg-en-grid" />

        {EN_MARKS.map((m) => (
          <div
            key={m.main}
            className="bg-en-mark"
            style={
              {
                left: m.left,
                top: m.top,
                "--dur": `${m.dur}s`,
                "--delay": `${m.delay}s`,
                "--rot": `${m.rot}deg`,
              } as React.CSSProperties
            }
          >
            <span className="bg-en-main" style={{ fontSize: m.size }}>
              {m.main}
            </span>
            <span className="bg-en-ipa">{m.sub}</span>
            <span className="bg-en-tag">{m.tag}</span>
          </div>
        ))}

        <svg
          className="bg-en-compass"
          viewBox="0 0 120 120"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <circle cx="60" cy="60" r="52" strokeDasharray="4 4" />
          <circle cx="60" cy="60" r="38" />
          <path d="M60 8 L60 112 M8 60 L112 60" strokeOpacity="0.5" />
          <polygon points="60,22 68,52 98,60 68,68 60,98 52,68 22,60 52,52" />
        </svg>
      </div>
    );
  }

  return (
    <div className="bg-stage" aria-hidden="true">
      <div className="bg-blob b1" />
      <div className="bg-blob b2" />
      <div className="bg-blob b3" />
      {HANZI.map((f) => (
        <span
          key={f.c}
          className="bg-hanzi"
          style={
            {
              left: f.left,
              top: f.top,
              fontSize: f.size,
              "--dur": `${f.dur}s`,
              "--delay": `${f.delay}s`,
              "--rot": `${f.rot}deg`,
            } as React.CSSProperties
          }
        >
          {f.c}
        </span>
      ))}
    </div>
  );
}
