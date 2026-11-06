import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import TapEffects from "@/components/TapEffects";
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
};

export const viewport: Viewport = {
  themeColor: "#064436",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const HANZI = [
  { c: "西", left: "6%", top: "58%", size: 120, dur: 22, delay: 0, rot: -8 },
  { c: "瓜", left: "84%", top: "22%", size: 150, dur: 26, delay: -6, rot: 6 },
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
        </div>
        <TapEffects />
        <NavBar />
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-28 sm:pb-6">{children}</div>
      </body>
    </html>
  );
}
