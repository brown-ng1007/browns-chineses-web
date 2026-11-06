import Link from "next/link";

export default function EnHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/en"
        aria-label="Về bản đồ"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl font-bold text-stone-500 ring-2 ring-stone-200"
      >
        ←
      </Link>
      <div>
        <h1 className="text-xl font-extrabold text-stone-800">{title}</h1>
        {sub && <p className="text-xs text-stone-500">{sub}</p>}
      </div>
    </div>
  );
}
