"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/config";

const NAV_ITEMS = [
  { href: "/", label: "Trang chủ" },
  { href: "/vocab", label: "Từ vựng" },
  { href: "/review", label: "Ôn tập" },
  { href: "/write", label: "Tập viết" },
  { href: "/skills", label: "Kỹ năng" },
  { href: "/settings", label: "Cài đặt" },
];

export default function NavBar() {
  const pathname = usePathname();

  if (pathname.startsWith("/login")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <Link
          href="/"
          className="text-lg font-bold text-slate-900 tracking-tight"
        >
          {APP_NAME}
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}