export default function Watermelon({ className = "" }: { className?: string }) {
  const seeds: [number, number, number][] = [
    [44, 30, -20],
    [60, 40, 0],
    [76, 30, 20],
    [31, 22, -35],
    [89, 22, 35],
    [52, 24, -8],
    [68, 24, 8],
  ];
  return (
    <svg
      viewBox="0 0 120 72"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 15 A55 55 0 0 0 115 15 Z" fill="#1f9d55" />
      <path d="M10 15 A50 50 0 0 0 110 15 Z" fill="#d9f99d" />
      <path d="M15 15 A45 45 0 0 0 105 15 Z" fill="#ff4d6d" />
      <path d="M32 15 A28 28 0 0 0 88 15 Z" fill="#ff8ea3" opacity="0.45" />
      <rect x="5" y="13" width="110" height="4" rx="2" fill="#1f9d55" />
      {seeds.map(([x, y, r], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx="2.1"
          ry="3.6"
          fill="#2b1a1f"
          transform={`rotate(${r} ${x} ${y})`}
        />
      ))}
    </svg>
  );
}
