"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import EnHeader from "@/components/en/EnHeader";
import { loadPractice, logActivity } from "@/lib/en/store";
import { meaningOptions, shortMeaning, pickDistinct, isPlayableWord } from "@/lib/en/games";
import { shuffle, norm } from "@/lib/en/quiz";
import { IOE_EXPANSION, type IoeExpandedGame } from "@/lib/en/ioe-expansion";
import { getMelonRenderer, type MelonRuntimeRendererKind } from "@/lib/content/contract";
import type { EnWord } from "@/lib/en/words";
import "@/components/en/en.css";

const BEST_KEY = "melon_ioe_arcade_best_v1";
const PROGRESS_KEY = "melon_ioe_progress_v3";

const CORE_GAMES = [
  { id: "pair", title: "Cool Pair Matching", vi: "Ghép cặp từ vựng", icon: "🧩", color: "mint", scene: "school", thumb: "pair", desc: "Ghép từ tiếng Anh với nghĩa tiếng Việt." },
  { id: "penalty", title: "Penalty Shootout", vi: "Sút phạt đền", icon: "⚽", color: "green", scene: "soccer", thumb: "penalty", desc: "Chọn đáp án chuẩn để đưa bóng vào lưới." },
  { id: "extra", title: "Leave Me Out", vi: "Tìm chữ cái thừa", icon: "🔎", color: "violet", scene: "search", thumb: "extra", desc: "Phát hiện ký tự bị chèn sai trong từ." },
  { id: "rearrange", title: "Rearrange Sentences", vi: "Sắp xếp câu", icon: "🔤", color: "blue", scene: "book", thumb: "rearrange", desc: "Sắp xếp các từ thành câu hoàn chỉnh." },
  { id: "monkey", title: "Monkey Swing", vi: "Khỉ đu dây", icon: "🐒", color: "orange", scene: "monkey", thumb: "monkey", desc: "Điền từ còn thiếu để giúp chú khỉ qua sông." },
  { id: "sea", title: "Sea Match", vi: "Kho báu đại dương", icon: "🐠", color: "cyan", scene: "sea", thumb: "sea", desc: "Tìm các cặp từ và nghĩa dưới đáy biển." },
  { id: "climb", title: "Climb Mountain", vi: "Leo núi điền từ", icon: "⛰️", color: "rose", scene: "climb", thumb: "climb", desc: "Chọn chữ cái còn thiếu để chinh phục đỉnh núi." },
  { id: "cannon", title: "Cannon Pirate", vi: "Đại bác hải tặc", icon: "🏴‍☠️", color: "indigo", scene: "pirate", thumb: "cannon", desc: "Trả lời đúng để bắn hạ tàu cướp biển." },
  { id: "octopus", title: "Octopus Row", vi: "Bạch tuộc chèo thuyền", icon: "🐙", color: "amber", scene: "octopus", thumb: "octopus", desc: "Chọn từ phù hợp để bạch tuộc về đích." },
  { id: "exam", title: "IOE Exam Contest", vi: "Thử thách IOE", icon: "🏆", color: "gold", scene: "trophy", thumb: "exam", desc: "Câu hỏi tổng hợp theo phong cách IOE." },
] as const;

type CoreId = (typeof CORE_GAMES)[number]["id"];
type ExpandedId = (typeof IOE_EXPANSION)[number]["id"];
type GameId = CoreId | ExpandedId;
type GameDef = { id: GameId; title: string; vi: string; icon: string; color: string; scene: string; thumb: string; desc: string; category: string; expanded: boolean };
type PairCard = { key: string; value: string; pairId: string; side: "word" | "meaning" };
type RuntimeQuestion = {
  kind: MelonRuntimeRendererKind;
  prompt: string;
  subPrompt?: string;
  options?: string[];
  answer: string;
  speakText?: string;
  tokens?: string[];
  answerTokens?: string[];
  letters?: { value: string; index: number }[];
  extraIndex?: number;
  missingIndex?: number;
  word?: EnWord;
  pairs?: PairCard[];
  explain?: string;
};
type Lesson = { id: string; title: string; description: string; icon: string; gameIds: GameId[] };
type SavedProgress = { unlockedLesson: number; highScores: Record<string, number> };

const LESSONS: Lesson[] = [
  {
    id: "lesson-1", title: "Lesson 1: Daily Routines & School Objects", icon: "📚",
    description: "Ôn từ vựng trường học, hoạt động hằng ngày, phát âm và ngữ pháp nền tảng.",
    gameIds: ["pair", "penalty", "extra", "rearrange", "monkey", "sea", "climb", "cannon", "listen-one", "listen-sentence", "phoneme-odd", "ending-sound", "odd-one-out", "word-class", "spelling-bee", "missing-vowels", "sentence-gap", "article-choice", "preposition-path", "dialogue-reply", "dialogue-order", "sailor-rescue"]
  },
  {
    id: "lesson-2", title: "Lesson 2: Hobbies, Sports & Nature", icon: "🌿",
    description: "Luyện chủ đề sở thích, thể thao, thiên nhiên, nghe hiểu và cấu trúc câu.",
    gameIds: ["pair", "penalty", "sea", "climb", "octopus", "exam", "monkey", "listen-one", "listen-sentence", "odd-one-out", "synonym-hunt", "antonym-duel", "definition-match", "word-class", "spelling-bee", "verb-tense", "pronoun-choice", "conjunction-bridge", "plural-quantifier", "comparative-race", "question-word", "collocation-match"]
  },
  {
    id: "lesson-3", title: "Lesson 3: Advanced Grammar & Reading", icon: "🏅",
    description: "Củng cố ngữ pháp, hội thoại, đọc hiểu và thử thách tổng hợp nâng cao.",
    gameIds: ["penalty", "rearrange", "octopus", "cannon", "exam", "phoneme-odd", "word-stress", "synonym-hunt", "antonym-duel", "definition-match", "verb-tense", "article-choice", "preposition-path", "pronoun-choice", "conjunction-bridge", "error-detective", "dialogue-reply", "dialogue-order", "reading-comprehension", "cloze-passage", "sentence-rewrite", "plural-quantifier", "comparative-race", "question-word", "collocation-match", "sailor-rescue"]
  }
];

const EXPANDED_BY_ID = new Map(IOE_EXPANSION.map((game) => [game.id, game]));
const ALL_GAMES: GameDef[] = [
  ...CORE_GAMES.map((game) => ({ ...game, category: "Melon Mini Games", expanded: false })),
  ...IOE_EXPANSION.map((game) => ({ ...game, expanded: true }))
];
const CATEGORIES = ["Tất cả", "Listening", "Pronunciation", "Vocabulary", "Grammar", "Communication", "Reading"] as const;

function speakText(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
}

function makeExtra(word: string) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const candidates = alphabet.split("").filter((letter) => !word.toLowerCase().includes(letter));
  const extra = candidates[Math.floor(Math.random() * candidates.length)] ?? "x";
  const at = Math.floor(Math.random() * (word.length + 1));
  return { letters: [...word.slice(0, at), extra, ...word.slice(at)].map((value, index) => ({ value, index })), extraIndex: at };
}

function fromExpanded(game: IoeExpandedGame): RuntimeQuestion {
  if (game.kind === "order") {
    const correctTokens = (game.answer.split("|").length > 1 ? game.answer.split("|") : (game.tokens ?? [])).map((x) => x.trim());
    return { kind: "order", prompt: game.prompt, subPrompt: game.subPrompt, tokens: shuffle(game.tokens ?? correctTokens), answerTokens: correctTokens, answer: correctTokens.join(" "), explain: game.explain };
  }
  return {
    kind: game.kind === "listen" ? "listen" : game.kind === "binary" ? "choice" : game.kind,
    prompt: game.prompt,
    subPrompt: game.subPrompt,
    options: game.options,
    answer: game.answer,
    speakText: game.speakText,
    explain: game.explain,
  };
}

function makeRuntimeQuestion(id: GameId, source: { pool: EnWord[]; words: EnWord[] }): RuntimeQuestion {
  const expanded = EXPANDED_BY_ID.get(id as ExpandedId);
  if (expanded) return fromExpanded(expanded);
  const available = source.words.length >= 4 ? source.words : source.pool;
  const playable = available.filter(isPlayableWord);
  const word = shuffle(playable.length ? playable : available)[0];
  if (!word) {
    return { kind: "choice", prompt: "Choose the correct answer.", options: ["apple", "book", "school", "water"], answer: "school" };
  }
  if (id === "pair" || id === "sea") {
    const chosen = pickDistinct(available, 3);
    const cards: PairCard[] = shuffle(chosen.flatMap((item) => [
      { key: `${item.id}-w`, value: item.word, pairId: item.id, side: "word" as const },
      { key: `${item.id}-m`, value: shortMeaning(item), pairId: item.id, side: "meaning" as const },
    ]));
    return { kind: "pairs", prompt: id === "sea" ? "Giải cứu kho báu: ghép mỗi từ với nghĩa tương ứng." : "Chọn từ tiếng Anh và ghép với nghĩa tiếng Việt.", answer: "pairs", pairs: cards, explain: "Mỗi cặp gồm một từ tiếng Anh và nghĩa tiếng Việt tương ứng." };
  }
  if (id === "extra") {
    const extra = makeExtra(word.word);
    return { kind: "letters", prompt: "Tìm chữ cái bị chèn thừa để sửa lại từ.", subPrompt: `Gợi ý nghĩa: ${shortMeaning(word)}`, answer: String(extra.extraIndex), letters: extra.letters, extraIndex: extra.extraIndex, word };
  }
  if (id === "climb") {
    const missingIndex = Math.floor(Math.random() * word.word.length);
    const correct = word.word[missingIndex].toLowerCase();
    return { kind: "letters", prompt: "Chọn chữ cái còn thiếu để hoàn thành từ.", subPrompt: `Nghĩa: ${shortMeaning(word)}`, answer: correct, options: shuffle([correct, ..."aeiourst".split("").filter((c) => c !== correct).slice(0, 3)]), missingIndex, word };
  }
  if (id === "rearrange") {
    const expected = (word.example || `I like ${word.word}.`).replace(/[.!?]+$/g, "").split(/\s+/).filter(Boolean);
    const tokens = shuffle(expected);
    return { kind: "order", prompt: "Sắp xếp các từ để tạo thành câu đúng.", subPrompt: `Từ gợi ý: ${word.word}`, tokens, answerTokens: expected, answer: expected.join(" "), word, explain: word.example };
  }
  if (id === "monkey") {
    const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hasWord = new RegExp(`(^|[^A-Za-z])${escaped}(?![A-Za-z])`, "i").test(word.example || "");
    const prompt = hasWord ? word.example.replace(new RegExp(`(^|[^A-Za-z])(${escaped})(?![A-Za-z])`, "i"), "$1_____ ") : `The _____ is important. (${shortMeaning(word)})`;
    const alternatives = shuffle(available.filter((item) => item.id !== word.id)).slice(0, 3).map((item) => item.word);
    return { kind: "choice", prompt: "Điền từ còn thiếu để chú khỉ qua sông.", subPrompt: prompt, options: shuffle([word.word, ...alternatives]), answer: word.word, speakText: prompt, word, explain: `${word.word}: ${shortMeaning(word)}` };
  }
  return {
    kind: "choice",
    prompt: id === "penalty" ? "Sút phạt: chọn nghĩa tiếng Việt đúng để ghi bàn!" : id === "cannon" ? "Nạp đạn đại bác bằng đáp án chính xác!" : id === "octopus" ? "Chọn đáp án đúng để bạch tuộc chèo tới đích!" : "Chọn nghĩa tiếng Việt chính xác.",
    subPrompt: word.word,
    options: meaningOptions(word, available),
    answer: shortMeaning(word),
    speakText: word.word,
    word,
    explain: `${word.word} = ${shortMeaning(word)}`,
  };
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function GameScene({ game }: { game: GameDef }) {
  const categoryLabel = game.expanded ? game.category : "MELON MINI GAME";
  return (
    <div className={`ioe-play-scene scene-${game.scene}`} data-scene={game.scene} role="img" aria-label={`Bối cảnh ${game.vi}`}>
      <video
        className="ioe-scene-video"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster={`/ioe/games/${game.thumb}.webp`}
        aria-hidden="true"
      >
        <source src={`/ioe/videos/${game.thumb}.mp4`} type="video/mp4" />
      </video>
      <div className="ioe-scene-shade" aria-hidden="true" />
      <div className="ioe-scene-meta">
        <span className="ioe-scene-chip"><i aria-hidden="true" />{categoryLabel}</span>
        <strong>{game.vi}</strong>
      </div>
      <span className="ioe-scene-mark" aria-hidden="true">MELON · QUEST</span>
    </div>
  );
}

export default function IoeArcadePage() {
  const [data, setData] = useState<{ pool: EnWord[]; words: EnWord[] } | null>(null);
  const [phase, setPhase] = useState<"hub" | "playing" | "result">("hub");
  const [selectedLessonId, setSelectedLessonId] = useState(LESSONS[0].id);
  const [testLength, setTestLength] = useState<4 | 6 | 10>(4);
  const [sessionGames, setSessionGames] = useState<GameId[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [isStandalone, setIsStandalone] = useState(false);
  const [question, setQuestion] = useState<RuntimeQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [timeLeft, setTimeLeft] = useState(480);
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);
  const [pairSelected, setPairSelected] = useState<string[]>([]);
  const [pairMatched, setPairMatched] = useState<string[]>([]);
  const [ordered, setOrdered] = useState<string[]>([]);
  const [inputAnswer, setInputAnswer] = useState("");
  const [best, setBest] = useState(0);
  const [progress, setProgress] = useState<SavedProgress>({ unlockedLesson: 1, highScores: {} });
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Tất cả");
  const [showExpanded, setShowExpanded] = useState(true);
  const [showCore, setShowCore] = useState(true);
  const [savedResult, setSavedResult] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPractice().then((result) => { if (alive) setData({ pool: result.pool, words: result.words }); });
    try {
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SavedProgress>;
        setProgress({ unlockedLesson: Math.max(1, Number(parsed.unlockedLesson) || 1), highScores: parsed.highScores ?? {} });
      }
    } catch { /* local storage có thể bị tắt */ }
    return () => { alive = false; };
  }, []);

  const currentLesson = useMemo(() => LESSONS.find((lesson) => lesson.id === selectedLessonId) ?? LESSONS[0], [selectedLessonId]);
  const activeGame = useMemo(() => ALL_GAMES.find((game) => game.id === sessionGames[sessionIndex]) ?? null, [sessionGames, sessionIndex]);
  const filteredGames = useMemo(() => ALL_GAMES.filter((game) => category === "Tất cả" || game.category === category), [category]);

  const prepareCurrentQuestion = useCallback((id: GameId, source: { pool: EnWord[]; words: EnWord[] }) => {
    setQuestion(makeRuntimeQuestion(id, source));
    setFeedback(null);
    setPairSelected([]);
    setPairMatched([]);
    setOrdered([]);
    setInputAnswer("");
  }, []);

  useEffect(() => {
    if (phase !== "playing" || !data || !sessionGames[sessionIndex]) return;
    prepareCurrentQuestion(sessionGames[sessionIndex], data);
  }, [phase, data, sessionGames, sessionIndex, prepareCurrentQuestion]);

  useEffect(() => {
    if (phase !== "playing" || question?.kind !== "listen" || !question.speakText) return;
    const timer = window.setTimeout(() => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(question.speakText);
      utterance.lang = "en-US";
      utterance.rate = 0.88;
      window.speechSynthesis.speak(utterance);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [phase, sessionIndex, question?.kind, question?.speakText]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setInterval(() => {
      setTimeLeft((remaining) => {
        if (remaining <= 1) {
          window.setTimeout(() => setPhase("result"), 0);
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "result" || savedResult) return;
    setSavedResult(true);
    const nextBest = Math.max(best, score);
    setBest(nextBest);
    try { localStorage.setItem(BEST_KEY, String(nextBest)); } catch { /* ignore */ }
    if (!isStandalone && selectedLessonId) {
      const lessonIndex = LESSONS.findIndex((lesson) => lesson.id === selectedLessonId);
      const nextProgress: SavedProgress = {
        unlockedLesson: Math.max(progress.unlockedLesson, Math.min(LESSONS.length, lessonIndex + 2)),
        highScores: { ...progress.highScores, [selectedLessonId]: Math.max(progress.highScores[selectedLessonId] ?? 0, score) },
      };
      setProgress(nextProgress);
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(nextProgress)); } catch { /* ignore */ }
    }
    void logActivity("game", correctCount, Math.max(1, sessionGames.length)).catch(() => undefined);
  }, [phase, savedResult, best, score, isStandalone, selectedLessonId, progress, correctCount, sessionGames.length]);

  function startSession(ids: GameId[], lessonId: string | null) {
    setSelectedLessonId(lessonId ?? LESSONS[0].id);
    setIsStandalone(!lessonId);
    setSessionGames(ids);
    setSessionIndex(0);
    setScore(0);
    setCorrectCount(0);
    setMistakes(0);
    setTimeLeft(Math.max(120, ids.length * 120));
    setFeedback(null);
    setSavedResult(false);
    setPhase("playing");
  }

  function startLessonSession() {
    if (!data) return;
    const chosen = shuffle(currentLesson.gameIds).slice(0, testLength);
    startSession(chosen, currentLesson.id);
  }

  function playSingle(id: GameId) {
    if (!data) return;
    startSession([id], null);
  }

  function advance(isCorrect: boolean) {
    if (feedback || phase !== "playing") return;
    setFeedback(isCorrect ? "right" : "wrong");
    if (isCorrect) { setScore((value) => value + 50); setCorrectCount((value) => value + 1); }
    else setMistakes((value) => value + 1);
    window.setTimeout(() => {
      if (sessionIndex + 1 >= sessionGames.length) setPhase("result");
      else setSessionIndex((value) => value + 1);
    }, 900);
  }

  function submitChoice(value: string) {
    if (!question || feedback) return;
    advance(norm(value) === norm(question.answer));
  }

  function submitOrder() {
    if (!question || feedback) return;
    const ok = norm(ordered.join(" ")) === norm((question.answerTokens ?? []).join(" "));
    advance(ok);
  }

  function submitInput() {
    if (!question || feedback) return;
    advance(norm(inputAnswer) === norm(question.answer));
  }

  function selectPair(key: string) {
    // Chỉ cho chọn tối đa 2 thẻ; tránh trạng thái 3 thẻ nếu người dùng chạm quá nhanh.
    if (!question?.pairs || feedback || pairSelected.length >= 2 || pairSelected.includes(key)) return;
    const card = question.pairs.find((item) => item.key === key);
    if (!card || pairMatched.includes(card.pairId)) return;
    const next = [...pairSelected, key];
    setPairSelected(next);
    if (next.length === 2) {
      const a = question.pairs.find((item) => item.key === next[0]);
      const b = question.pairs.find((item) => item.key === next[1]);
      if (a && b && a.pairId === b.pairId && a.side !== b.side) {
        const matched = [...pairMatched, a.pairId];
        setPairMatched(matched);
        setPairSelected([]);
        if (matched.length === question.pairs.length / 2) advance(true);
      } else {
        setMistakes((value) => value + 1);
        window.setTimeout(() => setPairSelected([]), 550);
      }
    }
  }

  function playAgain() {
    if (isStandalone && sessionGames[0]) playSingle(sessionGames[0]);
    else { setPhase("hub"); setSessionGames([]); }
  }

  if (!data) {
    return <main className="mx-auto w-full max-w-4xl pb-20 pt-3"><EnHeader title="Melon IOE Arcade" sub="Đang chuẩn bị bộ câu hỏi của bạn…" /><div className="en-card p-6 text-center text-sm text-slate-500">Đang tải dữ liệu học tập…</div></main>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 pb-24 pt-2">
      <EnHeader title="Melon IOE Arcade" sub="Ôn luyện theo Lesson, chọn 4 / 6 / 10 mini-game và chinh phục thử thách IOE." />

      {phase === "hub" && (
        <>
          <section className="ioe-hero">
            <div className="relative z-10 max-w-xl">
              <span className="ioe-kicker">MELON LANGUAGE · IOE TRAINING MODE</span>
              <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">Vừa học, vừa chơi,<br />mỗi ngày tiến bộ.</h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-emerald-50/90">Khôi phục khung luyện theo Lesson của Gemini, giữ 10 mini-game gốc và bổ sung 29 dạng luyện tập theo kỹ năng thường gặp trong IOE.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
                <span className="ioe-stat"><b>{ALL_GAMES.length}</b> thử thách</span>
                <span className="ioe-stat"><b>{data.words.length}</b> từ sẵn sàng</span>
                <span className="ioe-stat"><b>{best}</b> điểm kỷ lục</span>
              </div>
            </div>
            <div className="ioe-hero-art" aria-hidden="true"><Image src="/ioe/games/exam.webp" alt="" fill priority sizes="220px" /></div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2 px-1">
              <div><p className="ioe-section-label">LESSON ROADMAP</p><h2 className="text-xl font-black text-slate-900">Chọn bài luyện tập</h2></div>
              <span className="text-xs text-stone-500">Chọn 4, 6 hoặc 10 mini-game ngẫu nhiên</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {LESSONS.map((lesson, index) => {
                const locked = index + 1 > progress.unlockedLesson;
                const selected = selectedLessonId === lesson.id;
                return (
                  <button key={lesson.id} type="button" disabled={locked} onClick={() => setSelectedLessonId(lesson.id)} className={`ioe-lesson-card ${selected ? "is-selected" : ""} ${locked ? "is-locked" : ""}`}>
                    <span className="ioe-lesson-icon">{locked ? "—" : String(index + 1).padStart(2, "0")}</span>
                    <span className="block text-left"><span className="ioe-game-number">LESSON {index + 1} · {lesson.gameIds.length} DẠNG BÀI</span><strong className="mt-1 block text-sm text-slate-900">{lesson.title}</strong><span className="mt-2 block text-xs leading-5 text-slate-600">{lesson.description}</span></span>
                    <span className="ioe-lesson-score">{progress.highScores[lesson.id] ? `Kỷ lục ${progress.highScores[lesson.id]} điểm` : locked ? "Chưa mở khóa" : "Chưa có điểm"}</span>
                  </button>
                );
              })}
            </div>
            <div className="ioe-session-panel">
              <div className="min-w-0"><p className="ioe-section-label">SESSION BUILDER</p><h3 className="mt-1 text-base font-black text-slate-900">{currentLesson.title}</h3><p className="mt-1 text-xs text-slate-600">Hệ thống xáo trộn {testLength} mini-game từ {currentLesson.gameIds.length} dạng bài của Lesson này. Mỗi trò có tối đa 2 phút.</p></div>
              <div className="flex flex-wrap items-center gap-2">
                {[4, 6, 10].map((length) => <button key={length} type="button" onClick={() => setTestLength(length as 4 | 6 | 10)} className={`ioe-length-button ${testLength === length ? "is-active" : ""}`}>{length} trò</button>)}
                <button type="button" onClick={startLessonSession} className="en-btn max-w-[190px]">Bắt đầu phiên →</button>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2 px-1"><div><p className="ioe-section-label">PRACTICE LIBRARY</p><h2 className="text-xl font-black text-slate-900">Khám phá các dạng bài IOE</h2><p className="mt-1 text-xs text-slate-500">10 trò gốc + 29 dạng mở rộng · Chạm thẻ để chơi riêng một thử thách.</p></div><button type="button" onClick={() => { setCategory("Tất cả"); setShowCore(true); setShowExpanded(true); }} className="text-xs font-bold text-emerald-700">Hiện tất cả ↗</button></div>
            <div className="ioe-filter-row">{CATEGORIES.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`ioe-filter ${category === item ? "is-active" : ""}`}>{item === "Tất cả" ? "Tất cả" : item}</button>)}</div>
            <div className="flex flex-wrap gap-2 px-1">
              <button type="button" onClick={() => setShowCore((value) => !value)} className={`ioe-toggle ${showCore ? "is-on" : ""}`}>10 trò gốc {showCore ? "✓" : "+"}</button>
              <button type="button" onClick={() => setShowExpanded((value) => !value)} className={`ioe-toggle ${showExpanded ? "is-on" : ""}`}>29 dạng mở rộng {showExpanded ? "✓" : "+"}</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGames.filter((game) => game.expanded ? showExpanded : showCore).map((game, index) => (
                <button key={game.id} type="button" onClick={() => playSingle(game.id)} className={`ioe-game-card ioe-${game.color} text-left`}>
                  <span className="ioe-game-art"><Image src={`/ioe/games/${game.thumb}.webp`} alt={game.title} fill sizes="(max-width: 640px) 100vw, 33vw" /><span className="ioe-game-art-tag">{String(index + 1).padStart(2, "0")}</span></span>
                  <span className="ioe-game-copy"><span className="ioe-game-number">{game.expanded ? game.category.toUpperCase() : "MELON MINI GAME"} · {String(index + 1).padStart(2, "0")}</span><span className="ioe-game-title">{game.vi}</span><span className="ioe-game-desc">{game.desc}</span></span>
                  <span className="ioe-card-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </section>
          <div className="ioe-footnote"><span>💡</span><p>Các trò ghép từ vựng ưu tiên lấy dữ liệu trong kho học tiếng Anh. Các câu nghe, phát âm, ngữ pháp và đọc hiểu là bộ câu hỏi tự biên soạn theo định dạng luyện tập IOE, không phải đề thi thật.</p></div>
          <p className="text-center text-[11px] text-slate-400"><Link href="/en/games" className="font-semibold text-emerald-700 hover:underline">← Quay lại 4 trò chơi nhanh</Link></p>
        </>
      )}

      {phase === "playing" && activeGame && question && (
        <section className="en-card overflow-hidden p-4 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex min-w-0 items-center gap-3"><span className="ioe-play-thumb"><Image src={`/ioe/games/${activeGame.thumb}.webp`} alt="" fill sizes="48px" /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{activeGame.title}</p><p className="truncate text-sm font-extrabold text-slate-900">{activeGame.vi}</p></div></div>
            <div className="flex flex-wrap gap-2"><span className="ioe-pill">⭐ {score} điểm</span><span className="ioe-pill">{sessionIndex + 1}/{sessionGames.length} trò</span><span className={`ioe-pill ${timeLeft < 60 ? "ioe-pill-danger" : ""}`}>⏱ {formatTime(timeLeft)}</span></div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all" style={{ width: `${((sessionIndex + (feedback ? 1 : 0)) / sessionGames.length) * 100}%` }} /></div>
          <GameScene game={activeGame} />
          <div className="mx-auto max-w-2xl py-5 text-center">
            <p className="ioe-renderer-label">{getMelonRenderer(question.kind).label}</p>
            <p className="text-sm font-bold text-slate-700">{question.prompt}</p>
            {question.subPrompt && <p className="mt-3 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50 p-5 text-xl font-black text-slate-900">{question.subPrompt}</p>}
            {question.word && <div className="mt-2 flex items-center justify-center gap-3"><span className="text-xs text-slate-500">{question.word.pos} · {question.word.ipa}</span><button type="button" onClick={() => speakText(question.word!.word)} className="text-xs font-bold text-emerald-700 hover:underline">🔊 Nghe phát âm</button></div>}
            {question.speakText && !question.word && <button type="button" onClick={() => speakText(question.speakText!)} className="ioe-listen-button mt-4">🔊 Nghe lại</button>}

            {question.kind === "pairs" && question.pairs && (
              <div className="mt-5"><p className="text-xs text-slate-500">Đã ghép {pairMatched.length}/{question.pairs.length / 2} cặp</p><div className="mx-auto mt-4 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">{question.pairs.map((card) => { const selected = pairSelected.includes(card.key); const matched = pairMatched.includes(card.pairId); return <button key={card.key} type="button" disabled={matched || !!feedback} onClick={() => selectPair(card.key)} className={`ioe-pair-card ${selected ? "is-selected" : ""} ${matched ? "is-matched" : ""}`}><span>{matched ? "✓" : card.side === "word" ? "EN" : "VI"}</span>{matched ? "Đã ghép" : card.value}</button>; })}</div></div>
            )}

            {(question.kind === "choice" || question.kind === "listen" || question.kind === "stress") && question.options && (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">{question.options.map((option, index) => <button key={`${option}-${index}`} type="button" disabled={!!feedback} onClick={() => submitChoice(option)} className={`ioe-option ${feedback === "right" && norm(option) === norm(question.answer) ? "is-correct" : ""}`}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
            )}

            {question.kind === "order" && question.tokens && (
              <div className="mt-5"><div className="ioe-answer-line">{ordered.length ? ordered.map((token, index) => <button key={`${token}-${index}`} type="button" disabled={!!feedback} onClick={() => { setOrdered((items) => items.filter((_, i) => i !== index)); }} className="ioe-word-token">{token}</button>) : <span className="text-sm text-slate-400">Chạm các thẻ từ bên dưới theo đúng thứ tự…</span>}</div><div className="mt-4 flex flex-wrap justify-center gap-2">{question.tokens.filter((token, index) => {
                const usedCount = ordered.filter((item) => item === token).length;
                const copiesBefore = question.tokens!.slice(0, index + 1).filter((item) => item === token).length;
                return copiesBefore > usedCount;
              }).map((token, index) => <button key={`${token}-${index}`} type="button" disabled={!!feedback} onClick={() => setOrdered((items) => [...items, token])} className="ioe-word-token">{token}</button>)}</div><button type="button" disabled={!!feedback || ordered.length !== question.answerTokens?.length} onClick={submitOrder} className="en-btn mx-auto mt-5 max-w-xs">Kiểm tra thứ tự</button></div>
            )}

            {question.kind === "input" && (
              <div className="mx-auto mt-5 flex max-w-md flex-col gap-3"><input value={inputAnswer} onChange={(event) => setInputAnswer(event.target.value)} disabled={!!feedback} onKeyDown={(event) => { if (event.key === "Enter") submitInput(); }} className="en-input text-center font-bold" placeholder="Nhập đáp án tiếng Anh…" autoComplete="off" /><button type="button" disabled={!!feedback || !inputAnswer.trim()} onClick={submitInput} className="en-btn">Kiểm tra đáp án</button></div>
            )}

            {question.kind === "letters" && question.letters && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">{question.letters.map((letter, index) => <button key={`${letter.value}-${index}`} type="button" disabled={!!feedback} onClick={() => advance(index === question.extraIndex)} className="ioe-letter">{letter.value.toUpperCase()}</button>)}</div>
            )}
            {question.kind === "letters" && question.word && !question.letters && (
              <><p className="mt-5 text-3xl font-black tracking-[0.22em] text-emerald-800">{question.word.word.split("").map((letter, index) => index === question.missingIndex ? "_" : letter.toUpperCase()).join(" ")}</p><div className="mt-5 flex flex-wrap justify-center gap-2">{question.options?.map((letter, index) => <button key={`${letter}-${index}`} type="button" disabled={!!feedback} onClick={() => advance(letter.toLowerCase() === question.answer.toLowerCase())} className="ioe-letter">{letter.toUpperCase()}</button>)}</div></>
            )}

            {feedback && <div className={`ioe-feedback-note mt-5 ${feedback === "right" ? "is-right" : "is-wrong"}`}><strong>{feedback === "right" ? "Chính xác! +50 điểm ✨" : "Chưa chính xác. Cùng xem lại nhé."}</strong>{question.explain && <span>{question.explain}</span>}</div>}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4"><button type="button" onClick={() => { setPhase("hub"); setSessionGames([]); }} className="text-xs font-bold text-slate-500 hover:text-slate-900">← Thoát phiên chơi</button><span className="text-xs text-slate-400">Sai {mistakes} lần · {isStandalone ? "Chơi tự do" : currentLesson.title}</span></div>
        </section>
      )}

      {phase === "result" && (
        <section className="en-card p-7 text-center sm:p-10"><div className="ioe-result-art"><Image src="/ioe/games/exam.webp" alt="Cúp chiến thắng" fill sizes="112px" /></div><p className="ioe-section-label mt-4">PHIÊN LUYỆN TẬP HOÀN TẤT</p><h2 className="mt-2 text-2xl font-black text-slate-900">Hoàn thành thử thách!</h2><p className="mt-1 text-sm text-slate-500">{isStandalone ? activeGame?.vi : currentLesson.title}</p><div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2"><div className="ioe-mini-stat"><b>{score}</b><span>Điểm số</span></div><div className="ioe-mini-stat"><b>{correctCount}/{sessionGames.length}</b><span>Trò hoàn thành</span></div><div className="ioe-mini-stat"><b>{mistakes}</b><span>Số lỗi</span></div></div><p className="mt-5 text-xs text-slate-500">Kỷ lục cá nhân: <b className="text-amber-700">{best} điểm</b>{!isStandalone ? ` · Kỷ lục Lesson: ${progress.highScores[selectedLessonId] ?? score} điểm` : ""}</p><div className="mx-auto mt-7 flex max-w-md flex-col gap-2 sm:flex-row"><button type="button" onClick={playAgain} className="en-btn">{isStandalone ? "Chơi lại ↻" : "Về bảng Lesson"}</button><button type="button" onClick={() => { setPhase("hub"); setSessionGames([]); }} className="en-btn en-btn--ghost">Chọn thử thách khác</button></div></section>
      )}
    </main>
  );
}
