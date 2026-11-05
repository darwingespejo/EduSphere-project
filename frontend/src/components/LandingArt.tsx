"use client";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

/* The hero centerpiece: glossy CSS-3D sphere, two satellite droplets, orbit rings,
   each layer tracking the pointer at its own depth. */
export function OrbitHero() {
  const skills = ["Functions", "Async", "Arrays", "DOM", "Objects", "Control flow", "Debugging", "Testing"];
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 16 });
  const sy = useSpring(my, { stiffness: 60, damping: 16 });
  const coreX = useTransform(sx, (v) => v * 14), coreY = useTransform(sy, (v) => v * 14);
  const midX = useTransform(sx, (v) => v * -9), midY = useTransform(sy, (v) => v * -9);
  const farX = useTransform(sx, (v) => v * 20), farY = useTransform(sy, (v) => v * 20);

  return (
    <div
      ref={ref}
      className="relative w-[320px] h-[320px] md:w-[470px] md:h-[470px] mx-auto"
      aria-hidden
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
        my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
    >
      <motion.div style={{ x: coreX, y: coreY }} className="absolute inset-0">
        <div className="absolute inset-[31%]" style={{ animation: "float-y 7s ease-in-out infinite" }}>
          <div className="sphere3d w-full h-full" />
          <div className="planet-face absolute inset-0 flex flex-col items-center justify-center gap-[12%]">
            <div className="flex items-center gap-5">
              <span className="planet-eye" />
              <span className="planet-eye" />
            </div>
            <span className="planet-smile" />
          </div>
          <div className="sphere-shadow" />
        </div>
      </motion.div>
      <div className="planet-orbit absolute inset-[27%] rounded-[50%] border-[7px] border-amber/90" />
      <motion.div style={{ x: farX, y: farY }} className="absolute inset-0">
        <div className="sphere3d absolute w-[9%] h-[9%] top-[12%] right-[24%] opacity-90" style={{ animation: "float-y 5.2s ease-in-out infinite" }} />
        <div className="sphere3d absolute w-[6%] h-[6%] bottom-[16%] left-[18%] opacity-75" style={{ animation: "float-y 6.4s ease-in-out 1.1s infinite" }} />
      </motion.div>
      <motion.div style={{ x: midX, y: midY }} className="absolute inset-0">
        {[
          { inset: "18%", dur: "26s", dir: 1, items: [skills[0], skills[3], skills[6]] },
          { inset: "6%", dur: "38s", dir: -1, items: [skills[1], skills[4], skills[7]] },
          { inset: "30%", dur: "18s", dir: 1, items: [skills[2], skills[5]] },
        ].map((ring, ri) => (
          <div key={ri} className="absolute aspect-square rounded-full border" style={{ inset: ring.inset, borderColor: "rgba(19,74,124,0.28)", animation: `orbit-spin ${ring.dur} linear infinite${ring.dir < 0 ? " reverse" : ""}` }}>
            {ring.items.map((s, i) => {
              const a = (i / ring.items.length) * Math.PI * 2;
              const top = (50 + Math.sin(a) * 50).toFixed(4);
              const left = (50 + Math.cos(a) * 50).toFixed(4);
              return (
                <span key={s} className="absolute card-raise px-2.5 py-1 font-mono text-[10px] md:text-[11px] text-muted whitespace-nowrap"
                  style={{ top: `${top}%`, left: `${left}%`, transform: "translate(-50%, -50%)", animation: `orbit-spin ${ring.dur} linear infinite reverse` }}>
                  {s}
                </span>
              );
            })}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* Layered sliding wave divider (see globals.css keyframes). */
const WAVE_PATH = "M0,42 C120,22 240,60 360,44 C480,28 600,56 720,42 C840,28 960,52 1080,38 C1200,24 1320,50 1440,36 L1440,80 L0,80 Z";
const waveUri = (color: string, opacity: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='1440' height='80' viewBox='0 0 1440 80'><path d='${WAVE_PATH}' fill='rgba(${color},${opacity})'/></svg>`)}")`;

export function WaveDivider() {
  return (
    <div className="relative h-[80px] overflow-hidden -mb-px" aria-hidden>
      <div className="absolute inset-0" style={{ backgroundImage: waveUri("19,74,124", 0.16), backgroundSize: "1440px 80px", animation: "wave-slide 30s linear infinite" }} />
      <div className="absolute inset-0" style={{ backgroundImage: waveUri("19,74,124", 0.28), backgroundSize: "1440px 80px", animation: "wave-slide-rev 21s linear infinite" }} />
      <div className="absolute inset-0" style={{ backgroundImage: waveUri("14,47,82", 0.85), backgroundSize: "1440px 80px", animation: "wave-slide 15s linear infinite" }} />
    </div>
  );
}

/* Photo card: shared treatment for landing imagery — rounded frame, grade overlay, sheen. */
export function PhotoCard({ src, alt, credit, className = "", aspect = "aspect-[16/10]" }: {
  src: string; alt: string; credit?: string; className?: string; aspect?: string;
}) {
  return (
    <figure className={`relative overflow-hidden rounded-3xl border border-line ${aspect} ${className} group`}>
      <img src={src} alt={alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.05]" />
      {/* union grade: pulls every photo into the navy palette regardless of source tonality */}
      <div className="absolute inset-0 mix-blend-multiply opacity-[0.22]" style={{ background: "#134a7c" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(14,47,82,0) 40%, rgba(14,47,82,0.5))" }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "radial-gradient(circle at var(--sheen-x,50%) var(--sheen-y,50%), rgba(255,255,255,0.16), transparent 60%)" }} />
      {credit && <figcaption className="absolute bottom-2.5 right-3.5 font-mono text-[9.5px] text-white/65">{credit}</figcaption>}
    </figure>
  );
}
