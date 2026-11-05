import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/config";

const SECTIONS = [
  {
    href: "/vocab",
    title: "Từ vựng HSK",
    desc: "Tra cứu 11.902 từ vựng theo cấp độ HSK 2.0 và HSK 3.0.",
    status: "Sẵn sàng",
    ready: true,
  },
  {
    href: "/review",
    title: "Ôn tập (SRS)",
    desc: "Thẻ ghi nhớ lặp lại ngắt quãng và chấm nghĩa tiếng Việt.",
    status: "Sắp có",
    ready: false,
  },
  {
    href: "/write",
    title: "Tập viết",
    desc: "Luyện viết chữ Hán với Apple Pencil trên iPad.",
    status: "Sắp có",
    ready: false,
  },
  {
    href: "/skills",
    title: "Kỹ năng",
    desc: "Theo dõi thời lượng luyện nghe, nói, đọc, viết mỗi ngày.",
    status: "Sắp có",
    ready: false,
  },
  {
    href: "/settings",
    title: "Cài đặt",
    desc: "Quản lý tài khoản, dữ liệu ngoại tuyến (Dexie) và đăng xuất.",
    status: "Sẵn sàng",
    ready: true,
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">{APP_NAME}</h1>
        <p className="text-slate-600 mt-1">{APP_DESCRIPTION}</p>
        {user?.email && (
          <p className="text-sm text-slate-500 mt-3">
            Đang đăng nhập: <span className="font-medium text-slate-800">{user.email}</span>
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl bg-white p-5 shadow-xs border border-slate-200 hover:border-blue-500 hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition">
                  {item.title}
                </h2>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    item.ready
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-2">{item.desc}</p>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}