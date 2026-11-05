"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";

export type PathNode = {
  itemId: string; lessonId: string; title: string; moduleTitle: string;
  estimatedMinutes: number; status: "locked" | "current" | "done" | "skipped"; position: number;
};

// The learning path as a constellation: alternating nodes along a sine spine, lines draw
// between neighbors, completed nodes glow, the active node pulses.
export function Constellation({ items, onOpen }: { items: PathNode[]; onOpen: (n: PathNode) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const width = columns === 2 ? 420 : 900;
  const rows = Math.ceil(items.length / columns);
  const H = Math.max(150, rows * 145 + 20);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateColumns = () => setColumns(container.clientWidth < 600 ? 2 : 4);
    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const nodes = useMemo(() => {
    return items.map((it, i) => {
      const row = Math.floor(i / columns);
      const indexInRow = i % columns;
      const column = row % 2 === 0 ? indexInRow : columns - 1 - indexInRow;
      const x = ((column + 0.5) * width) / columns;
      const y = 55 + row * 145 + Math.sin(indexInRow * 1.35) * 12;
      return { ...it, x, y, i };
    });
  }, [columns, items, width]);

  const segColor = (a: PathNode & { x: number; y: number }, b: PathNode & { x: number; y: number }) => {
    if (a.status === "done" && b.status === "done") return "var(--mint)";
    if (a.status === "done" && b.status !== "locked") return "var(--primary)";
    return "var(--line)";
  };

  return (
    <div ref={containerRef} className="w-full min-w-0">
      <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="xMidYMin meet" role="list" aria-label="Learning path">
        {/* faint boundary orbit */}
        <ellipse cx={width / 2} cy={H / 2} rx={width / 2 - 20} ry={H / 2 - 24} fill="none" stroke="var(--line)" strokeDasharray="3 7" />
        {nodes.slice(0, -1).map((a, i) => {
          const b = nodes[i + 1];
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + (a.y > b.y ? 18 : -18);
          const d = `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`;
          return (
            <motion.path key={`seg-${a.itemId}`} d={d} fill="none" stroke={segColor(a, b)} strokeWidth={a.status === "done" ? 2 : 1.5}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              style={{ strokeDasharray: a.status === "done" ? "none" : "4 6" }}
            />
          );
        })}
        {nodes.map((n, i) => {
          const done = n.status === "done";
          const current = n.status === "current";
          const locked = n.status === "locked";
          return (
            <motion.g key={n.itemId} role="listitem"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: locked ? 0.55 : 1, scale: 1 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 260, damping: 20 }}
              onClick={() => !locked && onOpen(n)}
              className={locked ? "cursor-not-allowed" : "cursor-pointer"}
            >
              {current && (
                <circle cx={n.x} cy={n.y} r={20} fill="none" stroke="var(--primary)" strokeWidth="1.5"
                  style={{ transformOrigin: `${n.x}px ${n.y}px`, animation: "orbit-spin 4s linear infinite" }}
                  strokeDasharray="30 14" />
              )}
              {current && (
                <circle cx={n.x} cy={n.y} r={14} fill="var(--primary)" opacity="0.22">
                  <animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={n.x} cy={n.y} r={current ? 11 : 9}
                fill={done ? "var(--mint)" : current ? "var(--primary)" : "var(--raised)"}
                stroke={done ? "none" : current ? "none" : "var(--line)"}
                strokeWidth="1.5"
                style={done ? { filter: "drop-shadow(0 0 8px var(--glow-mint))" } : current ? { filter: "drop-shadow(0 0 10px var(--glow-primary))" } : {}}
              />
              {done && (
                <g transform={`translate(${n.x - 6}, ${n.y - 6})`} color="#06251e">
                  <Check size={12} strokeWidth={3.5} />
                </g>
              )}
              {locked && (
                <g transform={`translate(${n.x - 5}, ${n.y - 5})`}>
                  <Lock size={10} strokeWidth={2.5} color="var(--muted)" />
                </g>
              )}
              <text x={n.x} y={n.y + 30} textAnchor="middle" fontSize="11" fill="var(--text)" fontWeight={600}
                style={{ maxWidth: 120 }}>
                {n.title.length > 22 ? n.title.slice(0, 21) + "…" : n.title}
              </text>
              <text x={n.x} y={n.y + 45} textAnchor="middle" fontSize="9.5" fill="var(--muted)" fontFamily="var(--font-mono)">
                {n.estimatedMinutes} min
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
