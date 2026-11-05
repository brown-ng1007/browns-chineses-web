import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import TapEffects from "@/components/TapEffects";
import Watermelon from "@/components/Watermelon";
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
  themeColor: "#e5334f",
  width: "device-width",
  initialScale: 1,
};

const HANZI = [
  { c: "西", left: "6%", top: "58%", size: 120, dur: 22, delay: 0, rot: -8 },
  { c: "瓜", left: "84%", top: "22%", size: 150, dur: 26, delay: -6, rot: 6 },
  { c: "书", left: "70%", top: "76%", size: 100, dur: 19, delay: -3, rot: -4 },
  { c: "听", left: "22%", top: "12%", size: 90, dur: 24, delay: -10, rot: 9 },
];

const FRUITS = [
  { left: "74%", top: "46%", w: 130, dur: 27, delay: -4, rot: 14 },
  { left: "10%", top: "30%", w: 96, dur: 23, delay: -12, rot: -18 },
  { left: "44%", top: "84%", w: 110, dur: 30, delay: -8, rot: 8 },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen text-stone-900 antialiased">
        <div className="bg-stage" aria-hidden="true">
          <div className="bg-blob b1" />
          <div className="bg-blob b2" />
          <div className="bg-blob b3" />
          {HANZI.map((f) => (
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
          {FRUITS.map((f, i) => (
            <span
              key={i}
              className="bg-fruit"
              style={
                {
                  left: f.left,
                  top: f.top,
                  width: f.w,
                  "--dur": `${f.dur}s`,
                  "--delay": `${f.delay}s`,
                  "--rot": `${f.rot}deg`,
                } as React.CSSProperties
              }
            >
              <Watermelon className="w-full h-auto" />
            </span>
          ))}
        </div>
        <TapEffects />
        <NavBar />
        <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
