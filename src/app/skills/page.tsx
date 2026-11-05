"use client";

export default function SkillsPage() {
  return (
    <main className="space-y-6 pb-8">
      {/* Header section */}
      <section className="rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
          <span>Thống kê học tập • Tiến độ HSK</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Theo dõi kỹ năng
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Tổng hợp số lượt ôn tập, tỉ lệ ghi nhớ từ vựng và biểu đồ tiến độ đạt được theo từng cấp độ HSK.
        </p>
      </section>

      {/* Stats Overview Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-white/90 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgb(15,23,42,0.04)] border border-white/90 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tổng từ đã học</span>
          <div className="text-3xl font-bold text-slate-900">0</div>
          <p className="text-xs text-slate-500">Đồng bộ từ vựng &amp; SRS</p>
        </div>

        <div className="rounded-3xl bg-white/90 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgb(15,23,42,0.04)] border border-white/90 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tỉ lệ ghi nhớ</span>
          <div className="text-3xl font-bold text-emerald-600">--%</div>
          <p className="text-xs text-slate-500">Dựa trên kết quả ôn tập</p>
        </div>

        <div className="rounded-3xl bg-white/90 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgb(15,23,42,0.04)] border border-white/90 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Chuỗi ngày học</span>
          <div className="text-3xl font-bold text-blue-600">1 ngày</div>
          <p className="text-xs text-slate-500">Bắt đầu hành trình hôm nay</p>
        </div>
      </section>

      {/* Chart simulation area */}
      <section className="rounded-3xl bg-white/90 backdrop-blur-xl p-6 sm:p-8 shadow-[0_10px_35px_rgb(15,23,42,0.06)] border border-white/90 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Tiến độ phân bổ cấp độ HSK</h2>
        <div className="h-48 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 text-sm">
          Biểu đồ thống kê chi tiết sẽ hiển thị khi bạn bắt đầu học và ôn tập từ vựng.
        </div>
      </section>
    </main>
  );
}