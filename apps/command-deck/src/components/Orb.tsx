import { useEffect, useRef } from "react";
import { useCompanions } from "../state/companionStore";
import { useConversation } from "../state/conversationStore";

type RGB = [number, number, number];

interface OrbProps {
  hue: RGB;
}

/** Particle orb. Energy follows voice state and how many companions are busy. Click for a ripple. */
export function Orb({ hue }: OrbProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef(hue);
  const ripple = useRef<() => void>(() => {});
  hueRef.current = hue;

  useEffect(() => {
    ripple.current();
  }, [hue]);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const N = 3000;
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * Math.PI * (3 - Math.sqrt(5));
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      const d = 2.5 + Math.random() * 3;
      return {
        b: [Math.cos(th) * r, y, Math.sin(th) * r] as const,
        s: [Math.sin(v) * Math.cos(u) * d, Math.cos(v) * d, Math.sin(v) * Math.sin(u) * d] as const,
        ph: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.45,
      };
    });
    const motes = Array.from({ length: 140 }, () => ({
      r: 1.15 + Math.random() * 0.6,
      a: Math.random() * Math.PI * 2,
      y: (Math.random() - 0.5) * 1.4,
      sp: (0.00006 + Math.random() * 0.00014) * (Math.random() < 0.5 ? -1 : 1),
      tw: Math.random() * 6,
    }));
    const RING = 240;
    let energy = 0;
    let shocks: { t0: number; dir: [number, number, number] }[] = [];
    let tilt = [0, 0];
    let tiltT = [0, 0];
    let col = [...hueRef.current];
    let spin = 0;
    let last = performance.now();
    const t0 = still ? -1e5 : last;
    let raf = 0;

    const kick = (v: number) => (energy = Math.min(1.6, energy + v));
    ripple.current = () => {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      shocks.push({ t0: performance.now(), dir: [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)] });
      kick(0.5);
    };
    const unsubConv = useConversation.subscribe((s, p) => {
      if (s.messages.length > p.messages.length) kick(0.35);
    });

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      tiltT = [((e.clientY - r.top) / r.height - 0.5) * 0.6, ((e.clientX - r.left) / r.width - 0.5) * 0.8];
    };
    const onLeave = () => (tiltT = [0, 0]);
    const onClick = () => ripple.current();
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("click", onClick);

    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    const rot = (x: number, y: number, z: number, ca: number, sa: number, cb: number, sb: number) => {
      const X = x * ca - z * sa;
      const Z = x * sa + z * ca;
      return [X, y * cb - Z * sb, y * sb + Z * cb];
    };

    const draw = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      const dpr = devicePixelRatio || 1;
      if (cv.width !== w * dpr || cv.height !== h * dpr) {
        cv.width = w * dpr;
        cv.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const voice = useConversation.getState().voice;
      const busy = useCompanions.getState().companions.filter((c) => c.status === "BUSY").length;
      energy *= Math.pow(0.985, dt / 16);
      if (voice === "speaking") energy = Math.max(energy, 0.55 + 0.45 * Math.abs(Math.sin(t * 0.011) * Math.sin(t * 0.0037)));
      if (voice === "listening" || voice === "transcribing") energy = Math.max(energy, 0.4 + 0.3 * Math.abs(Math.sin(t * 0.008)));
      const think = voice === "thinking" || busy > 0;
      if (think) energy = Math.max(energy, 0.3 + busy * 0.06);
      const E = energy;

      const target = hueRef.current;
      col = col.map((v, i) => v + (target[i] - v) * 0.05);
      const [cr, cg, cb] = col.map((v) => v | 0);
      tilt = tilt.map((v, i) => v + (tiltT[i] - v) * 0.05);
      spin += dt * (0.00016 + (think ? 0.0009 : 0) + E * 0.0004);
      const pitch = 0.32 + tilt[0];
      const ca = Math.cos(spin + tilt[1]);
      const sa = Math.sin(spin + tilt[1]);
      const cpb = Math.cos(pitch);
      const spb = Math.sin(pitch);

      const R = Math.min(w * 0.42, h * 0.38) * (1 + Math.sin(t * 0.0012) * 0.012 + E * 0.04);
      const cx = w / 2;
      const cy = h * 0.42;
      const intro = Math.min(1, (t - t0) / 2600);

      const g = ctx.createRadialGradient(cx + R * 0.25, cy, R * 0.1, cx, cy, R * 1.5);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${0.1 + E * 0.14})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      shocks = shocks.filter((s) => t - s.t0 < 1600);
      const amp = 0.018 + E * 0.09;
      const tw = t * 0.001;
      const vis = 0.12 - E * 0.5;
      const persp = (Z: number) => (1 / (1.9 - Z * 0.35)) * 1.9;

      for (const p of pts) {
        let [x, y, z] = p.b as unknown as [number, number, number];
        let d = 1 + amp * Math.sin(y * 7 + tw * 3.1 + p.ph * 0.3) * Math.cos(x * 5 - tw * 2.3) + 0.006 * Math.sin(tw * 4 + p.ph);
        for (const s of shocks) {
          const ang = Math.acos(Math.max(-1, Math.min(1, x * s.dir[0] + y * s.dir[1] + z * s.dir[2])));
          const front = (t - s.t0) * 0.0022;
          d += 0.16 * (1 - (t - s.t0) / 1600) * Math.exp(-(ang - front) * (ang - front) * 30);
        }
        x *= d;
        y *= d;
        z *= d;
        const k = ease(Math.max(0, Math.min(1, (intro - p.delay) / (1 - p.delay))));
        if (k < 1) {
          x = p.s[0] + (x - p.s[0]) * k;
          y = p.s[1] + (y - p.s[1]) * k;
          z = p.s[2] + (z - p.s[2]) * k;
        }
        const [X, Y, Z] = rot(x, y, z, ca, sa, cpb, spb);
        const light = X * 0.8 + Z * 0.4 - vis;
        if (light <= 0 && k === 1) continue;
        const a = (k < 1 ? 0.5 : Math.min(1, light * 1.3)) * (0.3 + (0.7 * (Z + 1)) / 2) * (0.75 + 0.25 * Math.sin(tw * 5 + p.ph * 7));
        const sz = 0.9 + (Z + 1) * 0.7 + E * 0.6;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;
        ctx.fillRect(cx + X * R * persp(Z) - sz / 2, cy + Y * R * persp(Z) - sz / 2, sz, sz);
      }

      for (let i = 0; i < RING; i++) {
        const ang = (i / RING) * Math.PI * 2 - spin * 1.7;
        const rr = 1.32 + E * 0.08;
        const [X, Y, Z] = rot(Math.cos(ang) * rr, Math.sin(ang * 3 + t * 0.002) * 0.03, Math.sin(ang) * rr, 1, 0, Math.cos(1.25 + tilt[0]), Math.sin(1.25 + tilt[0]));
        const a = (0.08 + (0.35 * (Z + 1.3)) / 2.6) * intro * (i % 4 === 0 ? 1 : 0.45);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;
        ctx.fillRect(cx + X * R * persp(Z), cy + Y * R * persp(Z), 1.4, 1.4);
      }

      for (const m of motes) {
        m.a += m.sp * dt * (1 + E * 3);
        const [X, Y, Z] = rot(Math.cos(m.a) * m.r, m.y, Math.sin(m.a) * m.r, ca, sa, cpb, spb);
        const a = (0.15 + 0.35 * Math.abs(Math.sin(tw * 1.5 + m.tw))) * intro * (0.4 + (0.6 * (Z + 1.6)) / 3.2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;
        ctx.fillRect(cx + X * R * persp(Z), cy + Y * R * persp(Z), 1.8, 1.8);
      }
      ctx.globalCompositeOperation = "source-over";
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      unsubConv();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("click", onClick);
    };
  }, []);

  return <canvas ref={canvas} aria-hidden="true" />;
}
