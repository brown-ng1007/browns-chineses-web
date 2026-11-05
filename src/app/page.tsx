import Link from "next/link";
import { APP_NAME } from "@/lib/config";

const READY = [
  {
    href: "/vocab",
    title: "Từ vựng",
    hanzi: "词",
    subtitle: "HSK 1 – 9 • Tự nhập nghĩa Việt",
    desc: "Tra từ HSK 1 đến 9, xem nghĩa tiếng Anh và luyện nghĩa tiếng Việt do bạn tự nhập.",
    accent: "from-blue-600 to-indigo-600",
    pill: "bg-blue-50 text-blue-700 border-blue-200/70",
  },
  {
    href: "/review",
    title: "Ôn tập",
    hanzi: "忆",
    subtitle: "Thẻ ghi nhớ SRS • Hỗ trợ Offline",
    desc: "Thẻ ghi nhớ nhắc đúng lúc sắp quên. Mất mạng vẫn ôn được, có mạng lại sẽ tự lưu.",
    accent: "from-indigo-600 to-violet-600",
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
  },
  {
    href: "/write",
    title: "Tập viết",
    hanzi: "书",
    subtitle: "Apple Pencil • Chấm nét tự động",
    desc: "Viết chữ Hán bằng Apple Pencil, app kiểm tra thứ tự và hướng từng nét.",
    accent: "from-rose-600 to-red-600",
    pill: "bg-rose-50 text-rose-700 border-rose-200/70",
  },
  {
    href: "/skills",
    title: "Kỹ năng",
    hanzi: "艺",
    subtitle: "Thống kê • Tiến độ HSK",
    desc: "Thống kê số lượt ôn, tỉ lệ nhớ và tiến độ theo cấp HSK.",
    accent: "from-emerald-600 to-teal-600",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
  },
  {
    href: "/listen",
    title: "Nghe",
    hanzi: "听",
    subtitle: "Nghe và chọn chữ • Giọng đọc",
    desc: "Nghe phát âm chữ Hán rồi chọn đúng chữ, có chế độ đọc chậm.",
    accent: "from-sky-600 to-cyan-600",
    pill: "bg-sky-50 text-sky-700 border-sky-200/70",
  },
  {
    href: "/speak",
    title: "Nói",
    hanzi: "说",
    subtitle: "Đọc theo mẫu • Nhận dạng giọng",
    desc: "Nghe mẫu, đọc lại bằng micro và xem app có nhận ra đúng chữ không.",
    accent: "from-amber-500 to-orange-600",
    pill: "bg-amber-50 text-amber-700 border-amber-200/70",
  },
  {
    href: "/settings",
    title: "Cài đặt",
    hanzi: "设",
    subtitle: "Thẻ mới mỗi ngày • Giọng đọc",
    desc: "Chỉnh số thẻ mới, tốc độ giọng đọc, cấp HSK và tài khoản.",
    accent: "from-slate-600 to-slate-800",
    pill: "bg-slate-100 text-slate-700 border-slate-200/70",
  },
];


export default function HomePage() {
  return (
    <main className="space-y-6 pb-8">
      {/* Thẻ Hero phong cách Studio */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-[0_20px_50px_rgb(15,23,42,0.14)] border border-white/10">
        <div
          aria-hidden="true"
          className="font-hanzi pointer-events-none select-none absolute -right-4 -bottom-8 text-[140px] sm:text-[180px] font-bold text-white/[0.05] leading-none"
        >
          學
        </div>

        <div className="relative z-10 max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-medium text-blue-200 border border-white/15">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Không gian học tiếng Trung cá nhân
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {APP_NAME}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Học tiếng Trung đều 4 kỹ năng: nghe, nói, đọc, viết. Tối ưu thao tác
            cảm ứng và Apple Pencil trên iPad &amp; iPhone.
          </p>
        </div>
      </section>

      {/* 4 Phân khu chính đã sẵn sàng */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Phân khu luyện tập
          </h2>
          <span className="text-xs font-medium text-slate-400">
            7 tính năng sẵn sàng
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {READY.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group relative overflow-hidden rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-6 border border-white/90 shadow-[0_8px_30px_rgb(15,23,42,0.05)] hover:shadow-[0_16px_40px_rgb(37,99,235,0.12)] hover:border-blue-300/80 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`font-hanzi w-12 h-12 rounded-2xl bg-gradient-to-br ${s.accent} text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-slate-900/10 shrink-0`}
                    >
                      {s.hanzi}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {s.title}
                      </h3>
                      <span
                        className={`inline-block mt-0.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.pill}`}
                      >
                        {s.subtitle}
                      </span>
                    </div>
                  </div>

                  <span className="w-8 h-8 rounded-full bg-slate-100/80 text-slate-400 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all duration-200 shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </div>

                <p className="text-sm text-slate-600 mt-4 leading-relaxed">
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