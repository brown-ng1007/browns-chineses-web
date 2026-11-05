"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import Watermelon from "@/components/Watermelon";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Trang chủ",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/vocab",
    label: "Từ vựng",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: "/review",
    label: "Ôn tập",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: "/write",
    label: "Tập viết",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    href: "/skills",
    label: "Kỹ năng",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Cài đặt",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function NavBar() {
  const pathname = usePathname();
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  const isActiveHref = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
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

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3 pb-3">
      <div className="max-w-5xl mx-auto rounded-2xl bg-white/80 backdrop-blur-xl border border-white/80 shadow-[0_3px_0_0_#d9f99d,0_6px_0_0_#22a45a,0_16px_30px_rgba(229,51,79,0.12)] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <Link
          href="/"
          className="logo-wrap flex items-center gap-2.5 group self-start sm:self-auto"
        >
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-50 to-pink-100 ring-1 ring-rose-200 flex items-center justify-center shadow-sm shadow-rose-500/20">
            <Watermelon className="logo-slice w-8 h-auto" />
          </span>
          <div className="flex flex-col">
            <span className="text-base font-bold bg-gradient-to-r from-rose-700 via-red-600 to-emerald-700 bg-clip-text text-transparent tracking-tight leading-tight">
              {APP_NAME}
            </span>
            <span className="text-[11px] font-medium text-emerald-700/70 tracking-wide">
              Góc học của Dưa Hấu
            </span>
          </div>
        </Link>

        <nav className="relative flex items-center gap-1 overflow-x-auto no-scrollbar bg-rose-50/70 p-1 rounded-xl border border-rose-100">
          {ind && (
            <span
              aria-hidden="true"
              className="absolute top-1 bottom-1 rounded-lg bg-gradient-to-r from-rose-500 to-red-500 shadow-md shadow-rose-500/30 transition-[left,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
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
                    : "text-stone-600 hover:text-rose-700 hover:bg-white/70"
                }`}
              >
                <span
                  className={`nav-ico ${
                    isActive ? "text-white anim-pop" : "text-rose-300"
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
