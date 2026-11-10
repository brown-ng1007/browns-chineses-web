import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import Watermelon from "@/components/Watermelon";
import TowerHome from "@/components/tower/TowerHome";

const READY = [
  {
    href: "/vocab",
    title: "Từ vựng",
    hanzi: "词",
    subtitle: "HSK 1 – 9 • Tự nhập nghĩa Việt",
    desc: "Tra từ HSK 1 đến 9, xem nghĩa tiếng Anh và luyện nghĩa tiếng Việt do bạn tự nhập.",
    accent: "from-rose-500 to-red-500",
    pill: "bg-rose-50 text-rose-700 border-rose-200/70",
  },
  {
    href: "/review",
    title: "Ôn tập",
    hanzi: "忆",
    subtitle: "Thẻ ghi nhớ SRS • Hỗ trợ Offline",
    desc: "Thẻ ghi nhớ nhắc đúng lúc sắp quên. Mất mạng vẫn ôn được, có mạng lại sẽ tự lưu.",
    accent: "from-pink-500 to-rose-500",
    pill: "bg-pink-50 text-pink-700 border-pink-200/70",
  },
  {
    href: "/write",
    title: "Tập viết",
    hanzi: "书",
    subtitle: "Xem mẫu 3 lần • Chấm nét tự động",
    desc: "Xem mô phỏng thứ tự nét, rồi tự viết bằng Apple Pencil. App kiểm tra từng nét.",
    accent: "from-emerald-600 to-green-600",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
  },
  {
    href: "/skills",
    title: "Kỹ năng",
    hanzi: "艺",
    subtitle: "Thống kê • Tiến độ HSK",
    desc: "Thống kê số lượt ôn, tỉ lệ nhớ và tiến độ theo cấp HSK.",
    accent: "from-lime-500 to-green-600",
    pill: "bg-lime-50 text-lime-700 border-lime-200/70",
  },
  {
    href: "/listen",
    title: "Nghe",
    hanzi: "听",
    subtitle: "Nghe và chọn chữ • Giọng đọc",
    desc: "Nghe phát âm chữ Hán rồi chọn đúng chữ, có chế độ đọc chậm.",
    accent: "from-orange-400 to-rose-500",
    pill: "bg-orange-50 text-orange-700 border-orange-200/70",
  },
  {
    href: "/speak",
    title: "Nói",
    hanzi: "说",
    subtitle: "Đọc theo mẫu • Nhận dạng giọng",
    desc: "Nghe mẫu, đọc lại bằng micro và xem app có nhận ra đúng chữ không.",
    accent: "from-fuchsia-500 to-pink-500",
    pill: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/70",
  },
  {
    href: "/settings",
    title: "Cài đặt",
    hanzi: "设",
    subtitle: "Thẻ mới mỗi ngày • Giọng đọc",
    desc: "Chỉnh số thẻ mới, tốc độ giọng đọc, cấp HSK và tài khoản.",
    accent: "from-stone-600 to-stone-800",
    pill: "bg-stone-100 text-stone-700 border-stone-200/70",
  },
];

const SEEDS = [
  { top: "14%", left: "52%", r: "-20deg", d: "0s" },
  { top: "62%", left: "46%", r: "25deg", d: "-2s" },
  { top: "30%", left: "68%", r: "10deg", d: "-4s" },
  { top: "72%", left: "78%", r: "-35deg", d: "-1s" },
  { top: "18%", left: "88%", r: "30deg", d: "-3s" },
];

export default function HomePage() {
  return (
    <main className="space-y-6 pb-8">
      {/* Hero: một lát dưa hấu */}
      <section className="zh-home-hero rise hero-shine relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#064436] via-[#0b6b53] to-[#12896a] ring-1 ring-[#c99a2e]/60 p-6 sm:p-8 pb-10 sm:pb-12 text-white shadow-[0_20px_50px_-12px_rgba(6,68,54,0.55)]">
        {SEEDS.map((s, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="seed"
            style={
              {
                top: s.top,
                left: s.left,
                "--r": s.r,
                "--d": s.d,
              } as React.CSSProperties
            }
          />
        ))}

        <Watermelon className="hero-slice pointer-events-none select-none absolute -right-4 bottom-3 w-40 sm:w-60 h-auto opacity-20 sm:opacity-65 drop-shadow-xl" />

        <div className="relative z-10 max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/30">
            <span className="pulse-dot h-2 w-2 rounded-full bg-lime-300" />
            CHINESE GARDEN · HSK 3.0
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-[#f7dc8a]">
            {APP_NAME}
          </h1>

          <p className="text-sm sm:text-base text-emerald-50/90 leading-relaxed">
            Lộ trình HSK 1–9 theo nhịp riêng: học từ mới, ôn bằng SRS, luyện nghe – nói và thu hoạch từng cột mốc.
            Bỏ lỡ một ngày vẫn có thể quay lại từ bước tiếp theo.
          </p>
        </div>

        {/* Vỏ dưa ở mép dưới */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3 bg-[#c99a2e]" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-3 h-2 bg-[#f2cf75]" />
      </section>

      <TowerHome />

      <Link
        href="/en"
        className="en-gateway-card rise block rounded-3xl p-5 sm:p-6 text-white"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="en-gateway-kicker">ENGLISH QUEST · WORLD ROUTE</span>
            <h2 className="mt-1 text-lg font-bold">Học tiếng Anh theo bản đồ chặng</h2>
            <p className="mt-1 text-sm text-amber-50">
              Mỗi ngày một chặng nhỏ, có sao và boss. Mục tiêu TOEIC và IELTS.
            </p>
          </div>
          <span className="en-gateway-mark" aria-hidden="true">EN</span>
        </div>
      </Link>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400">
            Công cụ luyện tập
          </h2>
          <span className="text-xs font-medium text-emerald-700/70">
            7 tính năng sẵn sàng
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {READY.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              style={{ "--i": i + 1 } as React.CSSProperties}
              className="rise glass-card group relative overflow-hidden rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-6 border border-white/90 shadow-[0_8px_30px_rgb(229,51,79,0.07)] hover:shadow-[0_16px_40px_rgb(229,51,79,0.18)] hover:border-rose-300/80 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`card-icon font-hanzi w-12 h-12 rounded-2xl bg-gradient-to-br ${s.accent} text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-rose-900/10 shrink-0`}
                    >
                      {s.hanzi}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-stone-900 group-hover:text-rose-600 transition-colors">
                        {s.title}
                      </h3>
                      <span
                        className={`inline-block mt-0.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.pill}`}
                      >
                        {s.subtitle}
                      </span>
                    </div>
                  </div>

                  <span className="card-arrow w-8 h-8 rounded-full bg-rose-50 text-rose-300 group-hover:bg-rose-500 group-hover:text-white flex items-center justify-center shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>

                <p className="text-sm text-stone-600 mt-4 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
