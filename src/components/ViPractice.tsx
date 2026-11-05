"use client";

import { useState } from "react";
import type {
  ViAttemptRequest,
  ViAttemptResponse,
  ViConfirmChoice,
  ViConfirmRequest,
  ViUserStatus,
  ViVerdict,
} from "@/types/database.types";

export interface SavedViMeaning {
  text: string;
  status: ViUserStatus;
}

interface ViPracticeProps {
  wordId: string;
  savedMeaning: SavedViMeaning | null;
  onSaved: (wordId: string, text: string, status: ViUserStatus) => void;
}

const VERDICT_CONFIG: Record<
  ViVerdict,
  { label: string; badgeClass: string; boxClass: string }
> = {
  correct: {
    label: "Đúng",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    boxClass: "bg-emerald-50/80 border-emerald-200",
  },
  close: {
    label: "Gần đúng",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    boxClass: "bg-amber-50/80 border-amber-200",
  },
  incorrect: {
    label: "Sai",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
    boxClass: "bg-rose-50/80 border-rose-200",
  },
};

const STATUS_LABEL: Record<ViUserStatus, string> = {
  own: "Nghĩa tự nhập",
  accepted: "Nghĩa nhận từ gợi ý",
  merged: "Nghĩa đã gộp",
};

export default function ViPractice({
  wordId,
  savedMeaning,
  onSaved,
}: ViPracticeProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showSavedMeaning, setShowSavedMeaning] = useState<boolean>(false);

  const [inputText, setInputText] = useState<string>("");
  const [checkedInputText, setCheckedInputText] = useState<string>("");

  const [checking, setChecking] = useState<boolean>(false);
  const [attemptResult, setAttemptResult] = useState<ViAttemptResponse | null>(
    null
  );
  const [selectedSuggestion, setSelectedSuggestion] = useState<string>("");

  const [savingChoice, setSavingChoice] = useState<ViConfirmChoice | null>(
    null
  );
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) {
      setErrorMsg("Vui lòng nhập nghĩa tiếng Việt trước khi kiểm tra.");
      return;
    }
    if (trimmed.length > 200) {
      setErrorMsg("Nghĩa kiểm tra tối đa 200 ký tự. Vui lòng rút gọn lại.");
      return;
    }

    setChecking(true);
    setErrorMsg(null);
    setSaveSuccess(false);
    setAttemptResult(null);
    setSelectedSuggestion("");

    try {
      const payload: ViAttemptRequest = {
        word_id: wordId,
        input_text: trimmed,
      };

      const res = await fetch("/api/vi/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setErrorMsg(
            "Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang hoặc đăng nhập lại."
          );
        } else if (res.status === 429) {
          setErrorMsg("Đã hết lượt chấm trong 24 giờ (giới hạn 300 lượt/ngày).");
        } else if (res.status === 502) {
          setErrorMsg("Chưa chấm được lúc này, thử lại sau ít giây.");
        } else if (res.status === 400) {
          setErrorMsg("Nội dung nhập chưa hợp lệ (cần từ 1 đến 200 ký tự).");
        } else if (res.status === 404) {
          setErrorMsg("Không tìm thấy từ vựng này để chấm.");
        } else {
          setErrorMsg("Chưa chấm được lúc này, thử lại sau ít giây.");
        }
        return;
      }

      const data: ViAttemptResponse = await res.json();
      setAttemptResult(data);
      setCheckedInputText(trimmed);
      setShowSavedMeaning(true);

      const firstSuggestion =
        data.suggested_text ??
        (data.candidates.length > 0 ? data.candidates[0] : "");
      setSelectedSuggestion(firstSuggestion);
    } catch {
      setErrorMsg(
        "Không thể kết nối mạng. Chữ bạn vừa gõ vẫn được giữ nguyên, hãy thử lại khi có mạng."
      );
    } finally {
      setChecking(false);
    }
  }

  async function handleConfirm(choice: ViConfirmChoice) {
    let textToSave = "";

    if (choice === "keep_mine") {
      textToSave = (checkedInputText || inputText).trim();
    } else if (choice === "accept_candidate") {
      textToSave = selectedSuggestion.trim();
    } else if (choice === "merge") {
      textToSave = inputText.trim();
    }

    if (!textToSave) {
      setErrorMsg("Nội dung nghĩa cần lưu không được để trống.");
      return;
    }
    if (textToSave.length > 500) {
      setErrorMsg("Nghĩa lưu tối đa 500 ký tự. Vui lòng rút gọn lại.");
      return;
    }

    setSavingChoice(choice);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const payload: ViConfirmRequest = {
        word_id: wordId,
        choice,
        text: textToSave,
      };

      const res = await fetch("/api/vi/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setErrorMsg(
            "Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang hoặc đăng nhập lại."
          );
        } else {
          setErrorMsg("Chưa lưu được lúc này, vui lòng thử lại sau ít giây.");
        }
        return;
      }

      const data: { ok: boolean; status: ViUserStatus } = await res.json();
      if (data.ok) {
        setSaveSuccess(true);
        setShowSavedMeaning(true);
        onSaved(wordId, textToSave, data.status);
      }
    } catch {
      setErrorMsg(
        "Không thể kết nối mạng khi lưu. Chữ bạn gõ vẫn được giữ nguyên, hãy thử lại."
      );
    } finally {
      setSavingChoice(null);
    }
  }

  function handleAppendSuggestionToInput(suggestionText: string) {
    setSelectedSuggestion(suggestionText);
    const current = inputText.trim();
    if (!current) {
      setInputText(suggestionText);
      return;
    }
    if (!current.toLowerCase().includes(suggestionText.toLowerCase())) {
      setInputText(`${current}; ${suggestionText}`);
    }
  }

  const allSuggestions: string[] = [];
  if (attemptResult) {
    if (
      attemptResult.suggested_text &&
      attemptResult.suggested_text.trim().length > 0
    ) {
      allSuggestions.push(attemptResult.suggested_text.trim());
    }
    for (const c of attemptResult.candidates) {
      const trimmedCandidate = c.trim();
      if (
        trimmedCandidate.length > 0 &&
        !allSuggestions.includes(trimmedCandidate)
      ) {
        allSuggestions.push(trimmedCandidate);
      }
    }
  }
  const hasSuggestions = allSuggestions.length > 0;

  const inputChangedSinceCheck =
    attemptResult !== null && inputText.trim() !== checkedInputText;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            isOpen
              ? "bg-slate-200 text-slate-800 shadow-xs"
              : "bg-blue-50/80 text-blue-700 hover:bg-blue-100/80 border border-blue-200/60"
          }`}
        >
          {isOpen ? "Đóng luyện nghĩa" : "✍️ Luyện nghĩa Việt"}
        </button>

        {savedMeaning && (
          <button
            type="button"
            onClick={() => setShowSavedMeaning((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200/70 transition"
          >
            {showSavedMeaning ? "Ẩn nghĩa đã lưu" : "📖 Xem nghĩa đã lưu"}
          </button>
        )}
      </div>

      {savedMeaning && showSavedMeaning && (
        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 text-sm shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Nghĩa bạn đã lưu ({STATUS_LABEL[savedMeaning.status]}):
            </span>
          </div>
          <p className="mt-1 font-semibold text-slate-900 break-words">
            {savedMeaning.text}
          </p>
        </div>
      )}

      {isOpen && (
        <div className="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-4 space-y-3.5 shadow-inner">
          <form onSubmit={handleCheck} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600">
              Tự nhập nghĩa tiếng Việt (hoặc chỉnh sửa trước khi bấm &ldquo;Gộp&rdquo;):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setSaveSuccess(false);
                }}
                placeholder="Nhập nghĩa tiếng Việt..."
                disabled={checking || savingChoice !== null}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none disabled:opacity-60 shadow-xs"
              />
              <button
                type="submit"
                disabled={checking || savingChoice !== null || !inputText.trim()}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md disabled:opacity-50 transition shrink-0"
              >
                {checking ? "Đang chấm..." : "Kiểm tra"}
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs sm:text-sm text-rose-700 shadow-xs">
              {errorMsg}
            </div>
          )}

          {attemptResult && (
            <div
              className={`rounded-2xl border p-4 space-y-3 shadow-xs ${
                VERDICT_CONFIG[attemptResult.verdict].boxClass
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border shadow-xs ${
                    VERDICT_CONFIG[attemptResult.verdict].badgeClass
                  }`}
                >
                  {VERDICT_CONFIG[attemptResult.verdict].label}
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  Điểm: {attemptResult.score}/100
                </span>
              </div>

              <p className="text-xs text-slate-500 break-words">
                Chấm cho: &ldquo;{checkedInputText}&rdquo;
                {inputChangedSinceCheck &&
                  " (ô nhập đã thay đổi, bấm Kiểm tra lại)"}
              </p>

              <p className="text-sm text-slate-800 leading-relaxed font-medium">
                {attemptResult.explanation}
              </p>

              {hasSuggestions && (
                <div className="rounded-xl bg-white/90 border border-slate-200/80 p-3 space-y-2 shadow-xs">
                  <p className="text-xs font-semibold text-slate-600">
                    Gợi ý đối chiếu (chọn 1 gợi ý để nhận hoặc ghép vào ô nhập):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {allSuggestions.map((item) => {
                      const isSelected = selectedSuggestion === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setSelectedSuggestion(item)}
                          className={`text-left px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  {selectedSuggestion && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAppendSuggestionToInput(selectedSuggestion)
                      }
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                    >
                      + Chép thêm gợi ý này vào ô nhập để sửa/gộp
                    </button>
                  )}
                </div>
              )}

              <div className="pt-1 space-y-2">
                <p className="text-xs font-semibold text-slate-600">
                  Chọn cách lưu nghĩa của bạn:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={savingChoice !== null || checking}
                    onClick={() => handleConfirm("keep_mine")}
                    className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition shadow-xs"
                  >
                    {savingChoice === "keep_mine"
                      ? "Đang lưu..."
                      : "Giữ nghĩa của tôi"}
                  </button>

                  {hasSuggestions && (
                    <button
                      type="button"
                      disabled={
                        savingChoice !== null ||
                        checking ||
                        !selectedSuggestion.trim()
                      }
                      onClick={() => handleConfirm("accept_candidate")}
                      className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs"
                    >
                      {savingChoice === "accept_candidate"
                        ? "Đang lưu..."
                        : "Nhận gợi ý"}
                    </button>
                  )}

                  {hasSuggestions && (
                    <button
                      type="button"
                      disabled={
                        savingChoice !== null ||
                        checking ||
                        !inputText.trim() ||
                        !inputChangedSinceCheck
                      }
                      onClick={() => handleConfirm("merge")}
                      className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs"
                    >
                      {savingChoice === "merge"
                        ? "Đang lưu..."
                        : "Gộp (lưu theo ô nhập)"}
                    </button>
                  )}
                </div>

                {hasSuggestions && !inputChangedSinceCheck && (
                  <p className="text-[11px] text-slate-500">
                    Muốn gộp: bấm &ldquo;+ Chép thêm gợi ý&rdquo; hoặc sửa ô nhập, nút Gộp sẽ sáng lên.
                  </p>
                )}

                {saveSuccess && (
                  <p className="text-xs sm:text-sm font-bold text-emerald-700 flex items-center gap-1">
                    <span>✓</span> Đã lưu thành công
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}