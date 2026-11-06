import "@/components/en/en.css";
import type { ReactNode } from "react";

// Bao toàn bộ khu tiếng Anh để áp giao diện Dưa Hấu Hoàng Kim (xem components/en/en.css)
export default function EnLayout({ children }: { children: ReactNode }) {
  return <div className="en-page">{children}</div>;
}
