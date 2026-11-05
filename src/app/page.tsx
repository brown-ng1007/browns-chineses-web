import Link from "next/link";
import { APP_NAME } from "@/lib/config";

const READY = [
  {
    href: "/vocab",
    title: "Từ vựng",
    desc: "Tra từ HSK 1 đến 9, xem nghĩa tiếng Anh và luyện nghĩa tiếng Việt do bạn tự nhập.",
  },
  {
    href: "/review",
    title: "Ôn tập",
    desc: "Thẻ ghi nhớ nhắc đúng lúc sắp quên. Mất mạng vẫn ôn được, có mạng lại sẽ tự lưu.",
  },
  {
    href: "/write",
    title: "Tập viết",
    desc: "Viết chữ Hán bằng Apple Pencil, app kiểm tra thứ tự và hướng từng nét.",
  },
  {
    href: "/skills",
    title: "Kỹ năng",
    desc: "Thống kê số lượt ôn, tỉ lệ nhớ và tiến độ theo cấp HSK.",
  },
];

const SOON = [
  { title: "Nghe", desc: "Luyện nghe chữ Hán và câu ví dụ." },
  { title: "Nói", desc: "Luyện phát âm và đọc theo mẫu." },
];

export default function HomePage() {
  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">{APP_NAME}</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Học tiếng Trung đều 4 kỹ năng: nghe, nói, đọc, viết.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {READY.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block rounded-2xl bg-white p-5 shadow-xs border border-blue-200 hover:border-blue-400 hover:bg-blue-50/40 transition"
          >
            <h2 className="text-lg font-bold text-blue-700">{s.title}</h2>
            <p className="text-sm text-slate-600 mt-1">{s.desc}</p>
          </Link>
        ))}
        {SOON.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-500">{s.title}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                Sắp có
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{s.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
