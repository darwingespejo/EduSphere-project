"use client";

// Sphere + orbit mark. The ring node spins on hover; full speed when `spin` is on (loading states).
export function OrbitMark({ size = 28, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden className="orbit-mark group/logo">
      <circle cx="24" cy="24" r="9" fill="var(--primary)" />
      <circle cx="24" cy="24" r="9" fill="url(#core-glow)" opacity="0.5" />
      <g style={{ transformOrigin: "24px 24px", animation: "orbit-spin 6s linear infinite", animationPlayState: spin ? "running" : "paused" }}
        className="[animation-play-state:paused] group-hover/logo:![animation-play-state:running]">
        <ellipse cx="24" cy="24" rx="19" ry="7.5" stroke="var(--mint)" strokeWidth="1.5" transform="rotate(-24 24 24)" opacity="0.8" />
        <circle cx="43" cy="24" r="3.2" fill="var(--mint)" transform="rotate(-24 24 24)" />
      </g>
      <defs>
        <radialGradient id="core-glow">
          <stop offset="60%" stopColor="var(--coral)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.55" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <OrbitMark size={size} />
      <span className="display font-bold text-[19px] tracking-tight">Edu<span className="text-coral">Sphere</span></span>
    </span>
  );
}

// Full-screen orbiting-dots loader — used in place of any default spinner.
export function SphereLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16" role="status" aria-label={label ?? "Loading"}>
      <div className="relative w-14 h-14">
        <div className="absolute inset-[22px] rounded-full bg-primary" />
        <div className="absolute inset-0 rounded-full border border-mint/50" style={{ animation: "orbit-spin 1.6s linear infinite" }}>
          <span className="absolute -top-[5px] left-1/2 -ml-[5px] w-2.5 h-2.5 rounded-full bg-mint" />
        </div>
        <div className="absolute inset-2 rounded-full border border-amber/40" style={{ animation: "orbit-spin 2.6s linear infinite reverse" }}>
          <span className="absolute -bottom-[4px] left-1/2 -ml-[4px] w-2 h-2 rounded-full bg-amber" />
        </div>
      </div>
      {label && <p className="text-muted text-sm font-mono">{label}</p>}
    </div>
  );
}
