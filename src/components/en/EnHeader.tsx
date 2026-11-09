import Link from "next/link";

export default function EnHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="en-head">
      <Link href="/en" aria-label="Về lộ trình" className="en-back">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5m6-6-6 6 6 6" />
        </svg>
      </Link>
      <div>
        <h1 className="en-head-title">{title}</h1>
        {sub && <p className="en-head-sub">{sub}</p>}
      </div>
    </div>
  );
}
