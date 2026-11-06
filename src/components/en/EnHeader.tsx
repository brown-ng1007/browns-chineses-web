import Link from "next/link";

export default function EnHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="en-head">
      <Link href="/en" aria-label="Về bản đồ" className="en-back">
        ←
      </Link>
      <div>
        <h1 className="en-head-title">{title}</h1>
        {sub && <p className="en-head-sub">{sub}</p>}
      </div>
    </div>
  );
}
