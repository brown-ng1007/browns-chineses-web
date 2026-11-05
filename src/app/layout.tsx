import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/config";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

const FLOATERS = [
  { c: "学", left: "6%", top: "58%", size: 120, dur: 22, delay: 0, rot: -8 },
  { c: "语", left: "84%", top: "22%", size: 150, dur: 26, delay: -6, rot: 6 },
  { c: "书", left: "70%", top: "72%", size: 100, dur: 19, delay: -3, rot: -4 },
  { c: "听", left: "20%", top: "14%", size: 90, dur: 24, delay: -10, rot: 9 },
  { c: "说", left: "48%", top: "86%", size: 110, dur: 28, delay: -14, rot: -6 },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen text-slate-900 antialiased">
        <div className="bg-stage" aria-hidden="true">
          <div className="bg-blob b1" />
          <div className="bg-blob b2" />
          <div className="bg-blob b3" />
          {FLOATERS.map((f) => (
            <span
              key={f.c}
              className="bg-hanzi"
              style={
                {
                  left: f.left,
                  top: f.top,
                  fontSize: f.size,
                  "--dur": `${f.dur}s`,
                  "--delay": `${f.delay}s`,
                  "--rot": `${f.rot}deg`,
                } as React.CSSProperties
              }
            >
              {f.c}
            </span>
          ))}
        </div>
        <NavBar />
        <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
