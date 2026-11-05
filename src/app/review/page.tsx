"use client";

import { useState } from "react";

export default function ReviewPage() {
  const [started, setStarted] = useState(false);

  return (
    <main className="space-y-6 pb-8">
      {/* Header section */}
      <section className="rounded-3xl bg-white/85 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_30px_rgb(15,23,42,0.05)] border border-white/90 space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
          <span>Ghi nhớ ngắt quãng • SRS</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Ôn tập thông minh
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Hệ thống thẻ ghi nhớ nhắc đúng thời điểm bạn sắp quên. Hoạt động mượt mà ngay cả khi ngoại tuyến.
        </p>
      </section>

      {/* Main card preview / trigger */}
      <section className="rounded-3xl bg-white/90 backdrop-blur-xl p-8 sm:p-12 shadow-[0_10px_35px_rgb(15,23,42,0.06)] border border-white/90 text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center text-3xl font-bold shadow-lg shadow-indigo-500/25 font-hanzi">
          忆
        </div>

        <div className="max-w-md mx-auto space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            Sẵn sàng ôn tập từ vựng hôm nay?
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Hệ thống đã chọn sẵn các thẻ cần ôn dựa trên tiến độ trí nhớ của bạn.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStarted(true)}
          className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200"
        >
          {started ? "Đang chuẩn bị phiên ôn tập..." : "Bắt đầu phiên ôn tập"}
        </button>
      </section>
    </main>
  );
}