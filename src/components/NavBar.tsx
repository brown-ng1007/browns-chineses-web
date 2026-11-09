"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/config";

/* Hệ thống Icon Vector sắc nét (thay thế hoàn toàn Emoji hệ thống) */
const ICONS = {
  home: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  path: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="14.5 9.5 9.5 11.5 7.5 16.5 12.5 14.5 14.5 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  vocab: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  review: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  write: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  games: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="6" width="20" height="12" rx="4" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h4m-2-2v4m7-1h.01M18 11h.01" />
    </svg>
  ),
  skills: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  english: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 000 18M12 3a14.5 14.5 0 010 18" />
    </svg>
  ),
  chinese: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const ZH_ITEMS = [
  { href: "/", label: "Trang chủ", icon: ICONS.home },
  { href: "/vocab", label: "Từ vựng", icon: ICONS.vocab },
  { href: "/review", label: "Ôn tập", icon: ICONS.review },
  { href: "/write", label: "Tập viết", icon: ICONS.write },
  { href: "/skills", label: "Kỹ năng", icon: ICONS.skills },
  { href: "/en", label: "Tiếng Anh", icon: ICONS.english },
  { href: "/settings", label: "Cài đặt", icon: ICONS.settings },
];

const EN_ITEMS = [
  { href: "/en", label: "Lộ trình", icon: ICONS.path },
  { href: "/en/vocab", label: "Từ vựng", icon: ICONS.vocab },
  { href: "/en/review", label: "Ôn tập", icon: ICONS.review },
  { href: "/en/games", label: "Trò chơi", icon: ICONS.games },
  { href: "/en/skills", label: "Kỹ năng", icon: ICONS.skills },
  { href: "/", label: "Tiếng Trung", icon: ICONS.chinese },
  { href: "/settings", label: "Cài đặt", icon: ICONS.settings },
];

export default function NavBar() {
  const pathname = usePathname();
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const NAV_ITEMS = isEn ? EN_ITEMS : ZH_ITEMS;
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  const isActiveHref = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/en") return pathname === "/en" || pathname.startsWith("/en/stage/");
    return pathname.startsWith(href);
  };
  const activeHref = NAV_ITEMS.find((i) => isActiveHref(i.href))?.href ?? null;

  const measure = () => {
    const el = activeHref ? itemRefs.current[activeHref] : null;
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
    else setInd(null);
  };

  useLayoutEffect(() => {
    measure();
    const el = activeHref ? itemRefs.current[activeHref] : null;
    el?.scrollIntoView({ inline: "center", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (pathname.startsWith("/login")) {
    return null;
  }

  if (isEn) {
    return (
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <Link href="/en" className="flex items-center gap-3 self-start sm:self-auto group">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0d6e57] to-[#095240] text-white shadow-[0_2px_0_#063b2d,0_4px_10px_rgba(13,110,87,0.2)] ring-1 ring-white/20">
              <svg className="w-5 h-5 text-[#fbbf24]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3L2 8l10 5 10-5-10-5z" fill="currentColor" fillOpacity="0.2" />
                <path d="M2 16l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-slate-900 tracking-tight leading-tight">
                  {APP_NAME}
                </span>
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0d6e57] border border-emerald-200/80">
                  English
                </span>
              </div>
              <span className="mt-0.5 text-[11px] font-semibold text-slate-500 tracking-wide">
                Lộ trình TOEIC 635 → IELTS 5.0
              </span>
            </div>
          </Link>

          <nav className="relative flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            {ind && (
              <span
                aria-hidden="true"
                className="absolute top-1 bottom-1 rounded-lg bg-[#0d6e57] shadow-[0_1px_2px_rgba(15,23,42,0.18)] transition-[left,width] duration-300 ease-out"
                style={{ left: ind.left, width: ind.width }}
              />
            )}
            {NAV_ITEMS.map((item) => {
              const isActive = isActiveHref(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(el) => {
                    itemRefs.current[item.href] = el;
                  }}
                  className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 ${
                    isActive
                      ? "text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
                  }`}
                >
                  <span className={isActive ? "text-[#fcd34d]" : "text-slate-500"}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3 pb-3">
      <div className="max-w-5xl mx-auto rounded-2xl bg-[#fffdf8]/90 backdrop-blur-xl border border-[#c99a2e]/40 shadow-[0_1px_0_0_#fff_inset,0_3px_0_0_#f2cf75,0_16px_30px_-12px_rgba(110,70,20,0.35)] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <Link
          href="/"
          className="logo-wrap flex items-center gap-2.5 group self-start sm:self-auto"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="logo-slice w-10 h-10 rounded-xl ring-1 ring-[#c99a2e]/60 shadow-sm shadow-emerald-900/30" />
          <div className="flex flex-col">
            <span className="text-base font-bold text-[#064436] tracking-tight leading-tight">
              {APP_NAME}
            </span>
            <span className="text-[11px] font-medium text-[#7a5410]/80 tracking-wide">
              Trung · Anh · Dưa Hấu
            </span>
          </div>
        </Link>

        <nav className="relative flex items-center gap-1 overflow-x-auto no-scrollbar bg-[#fff6df]/80 p-1 rounded-xl border border-[#c99a2e]/30">
          {ind && (
            <span
              aria-hidden="true"
              className="absolute top-1 bottom-1 rounded-lg bg-gradient-to-b from-[#12896a] to-[#0b6b53] ring-1 ring-[#064436] shadow-md shadow-emerald-900/30 transition-[left,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ left: ind.left, width: ind.width }}
            />
          )}
          {NAV_ITEMS.map((item) => {
            const isActive = isActiveHref(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => {
                  itemRefs.current[item.href] = el;
                }}
                className={`nav-link relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${
                  isActive
                    ? "text-white"
                    : "text-stone-600 hover:text-[#064436] hover:bg-white/70"
                }`}
              >
                <span
                  className={`nav-ico ${
                    isActive ? "text-[#f2cf75] anim-pop" : "text-[#c99a2e]"
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
