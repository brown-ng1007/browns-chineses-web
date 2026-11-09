"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EnHeader from "@/components/en/EnHeader";
import { loadPractice, logActivity } from "@/lib/en/store";
import { meaningOptions, shortMeaning, pickDistinct } from "@/lib/en/games";
import { shuffle } from "@/lib/en/quiz";
import type { EnWord } from "@/lib/en/words";
import "@/components/en/en.css";

const BEST_KEY = "melon_ioe_arcade_best_v1";
const GAMES = [
  { id: "pair", title: "Cool Pair Matching", vi: "Ghép cặp từ vựng", icon: "🧩", color: "mint", desc: "Lật thẻ và ghép từ tiếng Anh với nghĩa tiếng Việt." },
  { id: "penalty", title: "Penalty Shootout", vi: "Sút phạt đền", icon: "⚽", color: "green", desc: "Chọn đáp án chuẩn để đưa bóng vào lưới." },
  { id: "extra", title: "Leave Me Out", vi: "Tìm chữ cái thừa", icon: "🔎", color: "violet", desc: "Phát hiện ký tự bị chèn sai trong từ tiếng Anh." },
  { id: "rearrange", title: "Rearrange Sentences", vi: "Sắp xếp câu", icon: "🔤", color: "blue", desc: "Sắp xếp các từ thành câu ví dụ hoàn chỉnh." },
  { id: "monkey", title: "Monkey Swing", vi: "Khỉ đu dây", icon: "🐒", color: "orange", desc: "Điền từ còn thiếu để giúp chú khỉ qua sông." },
  { id: "sea", title: "Sea Match", vi: "Kho báu đại dương", icon: "🐠", color: "cyan", desc: "Tìm các cặp từ và nghĩa ẩn dưới đáy biển." },
  { id: "climb", title: "Climb Mountain", vi: "Leo núi điền từ", icon: "⛰️", color: "rose", desc: "Chọn chữ cái còn thiếu để chinh phục đỉnh núi." },
  { id: "cannon", title: "Cannon Pirate", vi: "Đại bác hải tặc", icon: "🏴‍☠️", color: "indigo", desc: "Trả lời đúng để bắn hạ tàu cướp biển." },
  { id: "octopus", title: "Octopus Row", vi: "Bạch tuộc chèo thuyền", icon: "🐙", color: "amber", desc: "Chọn từ phù hợp với ngữ cảnh để về đích." },
  { id: "exam", title: "IOE Exam Contest", vi: "Thử thách IOE", icon: "🏆", color: "gold", desc: "Bài kiểm tra tổng hợp 5 câu hỏi tính điểm." },
] as const;

type GameId = (typeof GAMES)[number]["id"];
type PairCard = { key: string; value: string; pairId: string; side: "word" | "meaning" };

function speakWord(word: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
}

function makeExtraWord(word: string) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const candidates = alphabet.split("").filter((c) => !word.toLowerCase().includes(c));
  const extra = candidates[Math.floor(Math.random() * candidates.length)] ?? "x";
  const at = Math.floor(Math.random() * (word.length + 1));
  return { letters: [...word.slice(0, at), extra, ...word.slice(at)].map((value, index) => ({ value, index })), extraIndex: at };
}

export default function IoeArcadePage() {
  const [data, setData] = useState<{ pool: EnWord[]; words: EnWord[] } | null>(null);
  const [gameId, setGameId] = useState<GameId | null>(null);
  const [phase, setPhase] = useState<"hub" | "ready" | "play" | "result">("hub");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [best, setBest] = useState(0);
  const [question, setQuestion] = useState<EnWord | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);
  const [pairCards, setPairCards] = useState<PairCard[]>([]);
  const [pairSelected, setPairSelected] = useState<string[]>([]);
  const [pairMatched, setPairMatched] = useState<string[]>([]);
  const [extra, setExtra] = useState<ReturnType<typeof makeExtraWord> | null>(null);
  const [sentence, setSentence] = useState<string[]>([]);
  const [sentencePool, setSentencePool] = useState<string[]>([]);
  const [missingLetter, setMissingLetter] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    loadPractice().then((result) => {
      if (alive) setData({ pool: result.pool, words: result.words });
    });
    try { setBest(Number(localStorage.getItem(BEST_KEY)) || 0); } catch { /* local storage unavailable */ }
    return () => { alive = false; };
  }, []);

  const activeGame = useMemo(() => GAMES.find((game) => game.id === gameId) ?? null, [gameId]);

  const prepareRound = useCallback((id: GameId, index: number, source: { pool: EnWord[]; words: EnWord[] }) => {
    const usable = source.words.length >= 8 ? source.words : source.pool;
    const word = shuffle(usable)[0];
    setQuestion(word);
    setFeedback(null);
    setOptions(id === "monkey"
      ? shuffle([word.word, ...shuffle(usable.filter((item) => item.id !== word.id)).slice(0, 3).map((item) => item.word)])
      : meaningOptions(word, usable.length >= 4 ? usable : source.pool));
    setExtra(id === "extra" ? makeExtraWord(word.word) : null);
    setMissingLetter(Math.floor(Math.random() * word.word.length));
    const tokens = word.example.replace(/[.!?]+$/g, "").split(/\s+/).filter(Boolean);
    const scrambled = shuffle(tokens);
    setSentence([]);
    setSentencePool(scrambled);
    setRound(index);
  }, []);

  function beginGame(id: GameId) {
    if (!data) return;
    setGameId(id);
    setScore(0);
    setCorrect(0);
    setMistakes(0);
    setRound(0);
    setPairSelected([]);
    setPairMatched([]);
    setFeedback(null);
    if (id === "pair" || id === "sea") {
      const chosen = pickDistinct(data.words.length >= 4 ? data.words : data.pool, 4);
      const cards: PairCard[] = chosen.flatMap((word) => [
        { key: `${word.id}-word`, value: word.word, pairId: word.id, side: "word" as const },
        { key: `${word.id}-meaning`, value: shortMeaning(word), pairId: word.id, side: "meaning" as const },
      ]);
      setPairCards(shuffle(cards));
      setPhase("play");
    } else {
      prepareRound(id, 0, data);
      setPhase("ready");
    }
  }

  async function finish(finalScore = score, finalCorrect = correct, finalMistakes = mistakes, total = 5) {
    setPhase("result");
    const nextBest = Math.max(best, finalScore);
    setBest(nextBest);
    try { localStorage.setItem(BEST_KEY, String(nextBest)); } catch { /* ignore */ }
    try { await logActivity("game", finalCorrect, total); } catch { /* activity log is optional */ }
  }

  function nextRound(nextScore: number, nextCorrect: number, nextMistakes: number) {
    if (!data || !gameId) return;
    if (round >= 4) {
      finish(nextScore, nextCorrect, nextMistakes, 5);
      return;
    }
    prepareRound(gameId, round + 1, data);
  }

  function answer(value: string) {
    if (!question || feedback || phase !== "play") return;
    const isCorrect = value === (gameId === "monkey" ? question.word : shortMeaning(question));
    const nextScore = score + (isCorrect ? 20 : 0);
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextMistakes = mistakes + (isCorrect ? 0 : 1);
    setScore(nextScore); setCorrect(nextCorrect); setMistakes(nextMistakes);
    setFeedback(isCorrect ? "right" : "wrong");
    window.setTimeout(() => nextRound(nextScore, nextCorrect, nextMistakes), 850);
  }

  function chooseExtra(index: number) {
    if (!extra || !question || feedback) return;
    const isCorrect = index === extra.extraIndex;
    const nextScore = score + (isCorrect ? 20 : 0);
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextMistakes = mistakes + (isCorrect ? 0 : 1);
    setScore(nextScore); setCorrect(nextCorrect); setMistakes(nextMistakes);
    setFeedback(isCorrect ? "right" : "wrong");
    window.setTimeout(() => nextRound(nextScore, nextCorrect, nextMistakes), 850);
  }

  function submitSentence() {
    if (!question || feedback || sentence.length !== sentencePool.length) return;
    const expected = question.example.replace(/[.!?]+$/g, "").split(/\s+/).filter(Boolean);
    const isCorrect = sentence.join(" ").toLowerCase() === expected.join(" ").toLowerCase();
    const nextScore = score + (isCorrect ? 20 : 0);
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextMistakes = mistakes + (isCorrect ? 0 : 1);
    setScore(nextScore); setCorrect(nextCorrect); setMistakes(nextMistakes);
    setFeedback(isCorrect ? "right" : "wrong");
    window.setTimeout(() => nextRound(nextScore, nextCorrect, nextMistakes), 1000);
  }

  function selectPair(key: string) {
    if (pairSelected.includes(key) || pairMatched.some((id) => pairCards.find((card) => card.key === key)?.pairId === id)) return;
    const next = [...pairSelected, key];
    setPairSelected(next);
    if (next.length === 2) {
      const a = pairCards.find((card) => card.key === next[0]);
      const b = pairCards.find((card) => card.key === next[1]);
      if (a && b && a.pairId === b.pairId && a.side !== b.side) {
        const matched = [...pairMatched, a.pairId];
        setPairMatched(matched);
        setScore((v) => v + 25);
        setCorrect((v) => v + 1);
        setPairSelected([]);
        if (matched.length === 4) finish(score + 25, 4, mistakes, 4);
      } else {
        setMistakes((v) => v + 1);
        window.setTimeout(() => setPairSelected([]), 650);
      }
    }
  }

  function beginQuiz() {
    if (!data || !gameId) return;
    setPhase("play");
    prepareRound(gameId, 0, data);
  }

  if (!data) {
    return <main className="mx-auto w-full max-w-3xl pb-20 pt-3"><EnHeader title="IOE Mini Games" sub="Đang chuẩn bị bộ từ vựng của bạn…" /><div className="en-card p-6 text-center text-sm text-slate-500">Đang tải dữ liệu học tập…</div></main>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 pb-24 pt-2">
      <EnHeader title="Melon IOE Arcade" sub="Học từ vựng qua 10 thử thách ngắn · Dùng chính bộ từ trong lộ trình Tiếng Anh" />

      {phase === "hub" && (
        <>
          <section className="ioe-hero">
            <div className="relative z-10 max-w-xl">
              <span className="ioe-kicker">MELON LANGUAGE · ARCADE MODE</span>
              <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">Chơi một chút.<br />Nhớ thêm thật nhiều.</h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-emerald-50/90">10 mini-game lấy từ vựng trực tiếp từ kho học tiếng Anh. Điểm số và kết quả được lưu trên thiết bị của bạn.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
                <span className="ioe-stat">📚 {data.words.length} từ sẵn sàng</span>
                <span className="ioe-stat">🏅 Kỷ lục {best} điểm</span>
              </div>
            </div>
            <div className="ioe-hero-art" aria-hidden="true"><span>🍉</span><i>✦</i><b>+XP</b></div>
          </section>

          <div className="flex items-end justify-between gap-3">
            <div><p className="ioe-section-label">CHỌN THỬ THÁCH</p><h2 className="text-xl font-black text-slate-900">Arcade mini games</h2></div>
            <Link href="/en/games" className="text-xs font-bold text-emerald-700 hover:underline">Trò chơi khác ↗</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {GAMES.map((game, index) => (
              <button key={game.id} type="button" onClick={() => beginGame(game.id)} className={`ioe-game-card ioe-${game.color} text-left`}>
                <span className="ioe-game-icon">{game.icon}</span>
                <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase tracking-wider opacity-60">THỬ THÁCH {String(index + 1).padStart(2, "0")}</span><span className="mt-1 block text-base font-extrabold text-slate-900">{game.vi}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{game.desc}</span></span>
                <span className="ioe-card-arrow">↗</span>
              </button>
            ))}
          </div>
          <div className="ioe-footnote"><span>💡</span><p>Trò chơi dùng từ đã học nếu bạn có đủ thẻ; nếu chưa, hệ thống tự lấy từ trong lộ trình làm bộ khởi động.</p></div>
        </>
      )}

      {phase === "ready" && activeGame && (
        <section className="en-card p-6 text-center sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-5xl">{activeGame.icon}</div>
          <p className="ioe-section-label mt-5">SẴN SÀNG CHƯA?</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{activeGame.vi}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{activeGame.desc} Hoàn thành 5 câu hỏi, mỗi câu đúng nhận 20 điểm.</p>
          <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-2"><div className="ioe-mini-stat"><b>05</b><span>Lượt chơi</span></div><div className="ioe-mini-stat"><b>20</b><span>Điểm/câu</span></div><div className="ioe-mini-stat"><b>∞</b><span>Thử lại</span></div></div>
          <div className="mx-auto mt-7 flex max-w-sm gap-2"><button type="button" onClick={() => setPhase("hub")} className="en-btn en-btn--ghost">Quay lại</button><button type="button" onClick={beginQuiz} className="en-btn">Bắt đầu chơi <span>→</span></button></div>
        </section>
      )}

      {phase === "play" && activeGame && (
        <section className="en-card overflow-hidden p-4 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">{activeGame.icon}</span><div><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{activeGame.title}</p><p className="text-sm font-extrabold text-slate-900">{activeGame.vi}</p></div></div>
            <div className="flex gap-2"><span className="ioe-pill">⭐ {score} điểm</span><span className="ioe-pill">{gameId === "pair" || gameId === "sea" ? pairMatched.length : round + 1}/ {gameId === "pair" || gameId === "sea" ? 4 : 5}</span></div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all" style={{ width: `${((gameId === "pair" || gameId === "sea" ? pairMatched.length : round) / (gameId === "pair" || gameId === "sea" ? 4 : 5)) * 100}%` }} /></div>

          {(gameId === "pair" || gameId === "sea") ? (
            <div className="py-6 text-center"><p className="text-sm font-bold text-slate-800">Chọn một từ và ghép với nghĩa tương ứng</p><p className="mt-1 text-xs text-slate-500">Đã tìm được {pairMatched.length}/4 cặp</p><div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">{pairCards.map((card) => { const selected = pairSelected.includes(card.key); const matched = pairMatched.includes(card.pairId); return <button key={card.key} type="button" disabled={matched} onClick={() => selectPair(card.key)} className={`ioe-pair-card ${selected ? "is-selected" : ""} ${matched ? "is-matched" : ""}`}><span>{matched ? "✓" : card.side === "word" ? "EN" : "VI"}</span>{matched ? "Đã ghép" : card.value}</button>; })}</div></div>
          ) : question && (
            <div className="mx-auto max-w-2xl py-6 text-center">
              {gameId === "extra" ? <><p className="text-sm font-semibold text-slate-500">Tìm chữ cái bị chèn thừa để sửa lại từ</p><div className="mt-5 flex flex-wrap justify-center gap-2">{extra?.letters.map((letter, index) => <button key={`${letter.index}-${index}`} type="button" disabled={!!feedback} onClick={() => chooseExtra(index)} className="ioe-letter">{letter.value.toUpperCase()}</button>)}</div><p className="mt-4 text-xs text-slate-400">Gợi ý nghĩa: {shortMeaning(question)}</p></> : gameId === "rearrange" ? <><p className="text-sm font-semibold text-slate-500">Chạm các từ theo đúng thứ tự để tạo câu</p><div className="ioe-answer-line mt-5">{sentence.length ? sentence.map((token, i) => <button key={`${token}-${i}`} type="button" onClick={() => { setSentence((v) => v.filter((_, j) => j !== i)); setSentencePool((v) => [...v, token]); }} className="ioe-word-token">{token}</button>) : <span className="text-slate-400">Chọn từ bên dưới…</span>}</div><div className="mt-5 flex flex-wrap justify-center gap-2">{sentencePool.map((token, i) => <button key={`${token}-${i}`} type="button" onClick={() => { setSentence((v) => [...v, token]); setSentencePool((v) => v.filter((_, j) => j !== i)); }} className="ioe-word-token">{token}</button>)}</div><button type="button" disabled={sentence.length !== sentencePool.length} onClick={submitSentence} className="en-btn mx-auto mt-6 max-w-xs">Kiểm tra câu</button></> : gameId === "climb" ? <><p className="text-sm font-semibold text-slate-500">Chọn chữ cái còn thiếu để hoàn thành từ</p><div className="mt-5 text-3xl font-black tracking-[0.25em] text-emerald-800">{question.word.split("").map((letter, index) => index === missingLetter ? "_" : letter.toUpperCase()).join(" ")}</div><div className="mt-6 flex flex-wrap justify-center gap-2">{shuffle([question.word[missingLetter], ..."aeiourst".split("").filter((c) => c !== question.word[missingLetter]).slice(0, 3)]).map((letter, i) => <button key={`${letter}-${i}`} type="button" disabled={!!feedback} onClick={() => answer(letter === question.word[missingLetter] ? shortMeaning(question) : "")} className="ioe-letter">{letter.toUpperCase()}</button>)}</div><p className="mt-4 text-xs text-slate-400">Nghĩa: {shortMeaning(question)}</p></> : <><p className="text-sm font-semibold text-slate-500">{gameId === "monkey" ? "Điền từ còn thiếu để chú khỉ qua sông" : gameId === "cannon" ? "Chọn đáp án đúng để nạp đạn đại bác" : gameId === "octopus" ? "Chọn nghĩa đúng để bạch tuộc chèo thuyền" : gameId === "exam" ? "Câu hỏi IOE tổng hợp · Chọn một đáp án" : "Chọn nghĩa tiếng Việt chính xác"}</p><div className="mt-5 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50 p-6"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{question.pos} · {question.ipa}</p><p className="mt-2 text-2xl font-black text-slate-900">{gameId === "monkey" && question.example.toLowerCase().includes(question.word.toLowerCase()) ? question.example.replace(new RegExp(question.word, "ig"), "_____ ") : question.word}</p><button type="button" onClick={() => speakWord(question.word)} className="mt-2 text-xs font-bold text-emerald-700 hover:underline">🔊 Nghe phát âm</button></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{options.map((option, i) => <button key={`${option}-${i}`} type="button" disabled={!!feedback} onClick={() => answer(option)} className={`ioe-option ${feedback && option === shortMeaning(question) ? "is-correct" : ""} ${feedback === "wrong" && option !== shortMeaning(question) ? "" : ""}`}><span>{String.fromCharCode(65 + i)}</span>{option}</button>)}</div></>}
              {feedback && <p className={`mt-5 text-sm font-extrabold ${feedback === "right" ? "text-emerald-700" : "text-rose-600"}`}>{feedback === "right" ? "Chính xác! +20 điểm ✨" : `Chưa đúng. Đáp án: ${gameId === "extra" || gameId === "climb" || gameId === "monkey" ? question.word : gameId === "rearrange" ? question.example : shortMeaning(question)}`}</p>}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4"><button type="button" onClick={() => setPhase("hub")} className="text-xs font-bold text-slate-500 hover:text-slate-900">← Thoát trò chơi</button><span className="text-xs text-slate-400">Sai {mistakes} lần</span></div>
        </section>
      )}

      {phase === "result" && activeGame && (
        <section className="en-card p-7 text-center sm:p-10"><div className="text-6xl">🏆</div><p className="ioe-section-label mt-4">THỬ THÁCH HOÀN TẤT</p><h2 className="mt-2 text-2xl font-black text-slate-900">Làm tốt lắm!</h2><p className="mt-1 text-sm text-slate-500">{activeGame.vi}</p><div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2"><div className="ioe-mini-stat"><b>{score}</b><span>Điểm số</span></div><div className="ioe-mini-stat"><b>{correct}</b><span>Đúng</span></div><div className="ioe-mini-stat"><b>{mistakes}</b><span>Số lỗi</span></div></div><p className="mt-5 text-xs text-slate-500">Kỷ lục cá nhân: <b className="text-amber-700">{best} điểm</b></p><div className="mx-auto mt-7 flex max-w-md flex-col gap-2 sm:flex-row"><button type="button" onClick={() => beginGame(gameId!)} className="en-btn">Chơi lại ↻</button><button type="button" onClick={() => { setPhase("hub"); setGameId(null); }} className="en-btn en-btn--ghost">Chọn trò khác</button></div></section>
      )}
    </main>
  );
}
