"use client";

import { useEffect } from "react";

const JUICE = ["#ff4d6d", "#ff8fa3", "#e11d48", "#fb7185", "#4ade80"];
const MAX_LIVE = 80;

export default function TapEffects() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let live = 0;

    function spawn(x: number, y: number, big: boolean) {
      // vòng nước dưa lan ra
      const ring = document.createElement("span");
      Object.assign(ring.style, {
        position: "fixed",
        left: x + "px",
        top: y + "px",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        border: "2px solid rgba(244,63,94,0.55)",
        pointerEvents: "none",
        zIndex: "9999",
      });
      document.body.appendChild(ring);
      live++;
      const ra = ring.animate(
        [
          { transform: "translate(-50%,-50%) scale(0.4)", opacity: 0.9 },
          { transform: "translate(-50%,-50%) scale(" + (big ? 4.2 : 3.2) + ")", opacity: 0 },
        ],
        { duration: 520, easing: "cubic-bezier(0.16,0.84,0.3,1)", fill: "forwards" }
      );
      ra.onfinish = () => {
        ring.remove();
        live--;
      };

      // hạt và giọt nước
      const count = big ? 10 : 6;
      for (let i = 0; i < count; i++) {
        const isSeed = i % 3 === 0;
        const size = isSeed ? 8 + Math.random() * 3 : 5 + Math.random() * 6;
        const el = document.createElement("span");
        Object.assign(el.style, {
          position: "fixed",
          left: x + "px",
          top: y + "px",
          width: size + "px",
          height: size * (isSeed ? 1.5 : 1) + "px",
          background: isSeed ? "#2b1a1f" : JUICE[i % JUICE.length],
          borderRadius: isSeed ? "50% 50% 50% 50% / 65% 65% 35% 35%" : "50%",
          pointerEvents: "none",
          zIndex: "9999",
          willChange: "transform, opacity",
        });
        document.body.appendChild(el);
        live++;

        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const dist = 26 + Math.random() * (big ? 48 : 34);
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const rot = Math.random() * 360 - 180;
        const t = (a: number, b: number, s: number, r: number) =>
          "translate(-50%,-50%) translate(" + a + "px," + b + "px) scale(" + s + ") rotate(" + r + "deg)";

        const anim = el.animate(
          [
            { transform: t(0, 0, 0.3, 0), opacity: 1 },
            { transform: t(dx, dy, 1, rot), opacity: 1, offset: 0.55 },
            { transform: t(dx * 1.15, dy * 1.15 + 26, 0.6, rot * 1.4), opacity: 0 },
          ],
          {
            duration: 520 + Math.random() * 260,
            easing: "cubic-bezier(0.16,0.84,0.3,1)",
            fill: "forwards",
          }
        );
        anim.onfinish = () => {
          el.remove();
          live--;
        };
      }
    }

    function onDown(e: PointerEvent) {
      if (reduce.matches || live > MAX_LIVE) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as Element | null;
      const hit = target?.closest?.('a[href], button, [role="button"], summary');
      if (!hit) return;
      if ((hit as HTMLButtonElement).disabled) return;
      if (hit.getAttribute("aria-disabled") === "true") return;
      if (hit.closest("[data-no-burst]")) return;
      spawn(e.clientX, e.clientY, !!hit.closest("nav, header"));
    }

    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);

  return null;
}
