"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";

// Radar over the skill constellation. Up to 10 axes, values 0-100.
export function Radar({ data, size = 300 }: { data: { skill: string; score: number }[]; size?: number }) {
  const n = Math.max(3, data.length);
  const cx = size / 2, cy = size / 2, R = size / 2 - 46;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, v: number) => [cx + Math.cos(angle(i)) * R * v, cy + Math.sin(angle(i)) * R * v];

  const ring = (f: number) =>
    Array.from({ length: n }, (_, i) => `${i === 0 ? "M" : "L"}${pt(i, f).join(",")}`).join(" ") + " Z";
  const shape = useMemo(
    () => data.map((d, i) => `${i === 0 ? "M" : "L"}${pt(i, d.score / 100).join(",")}`).join(" ") + " Z",
    [data, size]
  );

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Skill mastery radar chart">
      {[0.33, 0.66, 1].map((f) => (
        <path key={f} d={ring(f)} fill="none" stroke="var(--line)" strokeWidth="1" />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" />;
      })}
      <motion.path
        d={shape}
        fill="var(--glow-primary)"
        stroke="var(--primary)"
        strokeWidth="2"
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {data.map((d, i) => {
        const [x, y] = pt(i, d.score / 100);
        return <circle key={`p${i}`} cx={x} cy={y} r="3" fill="var(--mint)" />;
      })}
      {data.map((d, i) => {
        const [x, y] = pt(i, 1.22);
        const anchor = Math.abs(x - cx) < 10 ? "middle" : x > cx ? "start" : "end";
        return (
          <text key={`l${i}`} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
            fill="var(--muted)" fontSize="10" fontFamily="var(--font-mono)">
            {d.skill.length > 14 ? d.skill.slice(0, 13) + "…" : d.skill}
          </text>
        );
      })}
    </svg>
  );
}

// 28-day activity area chart: lessons completed and code runs per day.
export function ActivityArea({ data, height = 120 }: { data: { date: string; lessons: number; runs: number }[]; height?: number }) {
  const w = 560;
  const max = Math.max(2, ...data.map((d) => d.lessons + d.runs));
  const stepX = w / (data.length - 1);
  const y = (v: number) => height - 8 - (v / max) * (height - 24);
  const pts = data.map((d, i) => [i * stepX, y(d.lessons + d.runs)]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${height - 8} L0,${height - 8} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Activity over the last 28 days">
      <defs>
        <linearGradient id="act-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill="url(#act-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} />
      <motion.path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeOut" }} />
      {data.filter((d, i) => i % 7 === 0).map((d) => {
        const i = data.indexOf(d);
        return (
          <text key={d.date} x={i * stepX} y={height - 0} fill="var(--muted)" fontSize="9" fontFamily="var(--font-mono)">
            {d.date.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}
