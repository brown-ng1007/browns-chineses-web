// Câu ví dụ có tô đậm từ đang học (kể cả khi từ đổi đuôi nhẹ, ví dụ thêm s hoặc ed)
export default function Highlight({ text, word }: { text: string; word: string }) {
  if (!text || !word) return <>{text}</>;
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp("(^|[^A-Za-z])(" + esc + "[A-Za-z]{0,3})(?![A-Za-z])", "i").exec(text);
  if (!m) return <>{text}</>;
  const start = m.index + m[1].length;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-amber-200/70 px-0.5 font-extrabold text-stone-900">{m[2]}</mark>
      {text.slice(start + m[2].length)}
    </>
  );
}
