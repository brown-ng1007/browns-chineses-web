"use client";

import { useState } from "react";

export default function WritePage() {
  const [selectedLevel, setSelectedLevel] = useState<number>(1);

  return (
    <main className="space-y-6 pb-8">
      {/* Header section */}
      <section className="rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-600 mb-1">
          <span>Apple Pencil • Chấm nét tự động</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Luyện tập viết chữ Hán
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Tập viết từng nét chữ Hán trên iPad với hướng dẫn thứ tự nét và chấm điểm trực quan.
        </p>
      </section>

      {/* Level selector */}
      <section className="rounded-3xl bg-white/90 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgb(15,23,42,0.04)] border border-white/90 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Chọn cấp độ HSK 3.0 để luyện viết:</h2>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setSelectedLevel(lv)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                selectedLevel === lv
                  ? "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-sm shadow-rose-500/25"
                  : "bg-slate-100/80 text-slate-700 hover:bg-slate-200/70"
              }`}
            >
              HSK {lv}
            </button>
          ))}
        </div>
      </section>

      {/* Writing canvas simulation area */}
      <section className="rounded-3xl bg-white/90 backdrop-blur-xl p-8 sm:p-12 shadow-[0_10px_35px_rgb(15,23,42,0.06)] border border-white/90 text-center space-y-6">
        <div className="mx-auto w-32 h-32 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center text-6xl font-bold text-slate-800 font-hanzi shadow-inner">
          中
        </div>

        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-lg font-bold text-slate-900">
            Khu vực luyện viết HSK {selectedLevel}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Sử dụng bút cảm ứng hoặc ngón tay trên màn hình iPad/iPhone để viết theo thứ tự nét chuẩn.
          </p>
        </div>

        <div className="flex justify-center gap-3">
          <button
            type="button"
            className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Xem nét mẫu
          </button>
          <button
            type="button"
            className="rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 transition"
          >
            Chữ tiếp theo
          </button>
        </div>
      </section>
    </main>
  );
}