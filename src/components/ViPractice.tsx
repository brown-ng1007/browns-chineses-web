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
    boxClass: "bg-emerald-50/70 border-emerald-200",
  },
  close: {
    label: "Gần đúng",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    boxClass: "bg-amber-50/70 border-amber-200",
  },
  incorrect: {
    label: "Sai",
    badgeClass: "bg-red-100 text-red-800 border-red-300",
    boxClass: "bg-red-50/70 border-red-200",
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
    // Xóa kết quả cũ ngay khi bắt đầu chấm lại, để không hiểu nhầm nếu lần này bị lỗi
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

  // Ô nhập đã khác chữ vừa chấm (người dùng đang sửa/gộp)
  const inputChangedSinceCheck =
    attemptResult !== null && inputText.trim() !== checkedInputText;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
      {/* Khu vực nút mở Luyện nghĩa Việt & Xem nghĩa đã lưu (ẩn mặc định) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`px-3.5 py-2 rounded-xl text-sm font-medium transition ${
            isOpen
              ? "bg-slate-200 text-slate-800"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
          }`}
        >
          {isOpen ? "Đóng luyện nghĩa" : "Luyện nghĩa Việt"}
        </button>

        {savedMeaning && (
          <button
            type="button"
            onClick={() => setShowSavedMeaning((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
          >
            {showSavedMeaning ? "Ẩn nghĩa đã lưu" : "Xem nghĩa tôi đã lưu"}
          </button>
        )}
      </div>

      {/* Nghĩa Việt đã lưu của người dùng: CHỈ hiện khi bấm Xem hoặc sau khi Kiểm tra */}
      {savedMeaning && showSavedMeaning && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Nghĩa bạn đã lưu ({STATUS_LABEL[savedMeaning.status]}):
            </span>
          </div>
          <p className="mt-0.5 font-semibold text-slate-900 break-words">
            {savedMeaning.text}
          </p>
        </div>
      )}

      {/* Khu vực nhập và chấm nghĩa */}
      {isOpen && (
        <div className="rounded-xl bg-slate-50/80 border border-slate-200 p-3.5 space-y-3">
          <form onSubmit={handleCheck} className="space-y-2.5">
            <label className="block text-xs font-medium text-slate-600">
              Tự nhập nghĩa tiếng Việt (hoặc chỉnh sửa tại đây trước khi bấm
              &ldquo;Gộp&rdquo;):
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
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={checking || savingChoice !== null || !inputText.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition shrink-0"
              >
                {checking ? "Đang chấm..." : "Kiểm tra"}
              </button>
            </div>
          </form>

          {/* Thông báo lỗi thân thiện */}
          {errorMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs sm:text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Kết quả chấm & đối chiếu (CHỈ hiện sau khi đã gọi API attempt) */}
          {attemptResult && (
            <div
              className={`rounded-xl border p-3.5 space-y-3 ${
                VERDICT_CONFIG[attemptResult.verdict].boxClass
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
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
                Kết quả này chấm cho: &ldquo;{checkedInputText}&rdquo;
                {inputChangedSinceCheck &&
                  " (ô nhập đã khác, bấm Kiểm tra để chấm lại chữ mới)"}
              </p>

              <p className="text-sm text-slate-800 leading-relaxed">
                {attemptResult.explanation}
              </p>

              {/* Phần đối chiếu: suggested_text và candidates (nếu có) */}
              {hasSuggestions && (
                <div className="rounded-lg bg-white/90 border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">
                    Gợi ý đối chiếu (chọn 1 gợi ý nếu muốn nhận hoặc ghép vào ô
                    nhập):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {allSuggestions.map((item) => {
                      const isSelected = selectedSuggestion === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setSelectedSuggestion(item)}
                          className={`text-left px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600"
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
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                    >
                      + Chép thêm gợi ý này vào ô nhập phía trên để sửa/gộp
                    </button>
                  )}
                </div>
              )}

              {/* Các nút cho người dùng tự quyết định lưu */}
              <div className="pt-1 space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  Chọn cách lưu nghĩa của bạn:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={savingChoice !== null || checking}
                    onClick={() => handleConfirm("keep_mine")}
                    className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 disabled:opacity-50 transition"
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
                      className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
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
                      className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      {savingChoice === "merge"
                        ? "Đang lưu..."
                        : "Gộp (lưu theo ô nhập)"}
                    </button>
                  )}
                </div>

                {hasSuggestions && !inputChangedSinceCheck && (
                  <p className="text-xs text-slate-500">
                    Muốn gộp: bấm &ldquo;+ Chép thêm gợi ý&rdquo; hoặc sửa ô nhập
                    trước, nút Gộp sẽ sáng lên.
                  </p>
                )}

                {saveSuccess && (
                  <p className="text-xs sm:text-sm font-semibold text-emerald-700">
                    ✓ Đã lưu
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
