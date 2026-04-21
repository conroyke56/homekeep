'use client';

/**
 * CoverageRing (03-02 Plan, D-15, VIEW-05, SPEC §8.1).
 *
 * Pure display primitive — hand-rolled SVG. Uses the "radius 16 ⇒
 * circumference ≈ 100" trick so that `stroke-dashoffset = 100 - clamped`
 * is a direct percentage mapping (no math per pixel). The SVG is
 * `-rotate-90` so the filled arc begins at the 12 o'clock position and
 * sweeps clockwise (Pitfall 9).
 *
 * Motion policy (RESEARCH §Reduced-motion):
 *   - `motion-safe:` prefix makes the transition conditional on
 *     `prefers-reduced-motion: no-preference`. Users with reduced
 *     motion enabled see an instant snap to the final dashoffset.
 *
 * Accessibility:
 *   - `role="img"` + `aria-label="Coverage X%"` so assistive tech
 *     announces the percentage as a single atomic value.
 *   - The nested SVG is `aria-hidden` — the wrapper owns the label.
 *
 * No runtime dependencies beyond React + Tailwind classes.
 */
export function CoverageRing({ percentage }: { percentage: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const offset = 100 - clamped;
  return (
    <div
      role="img"
      aria-label={`Coverage ${clamped}%`}
      className="inline-flex flex-col items-center gap-2"
    >
      <div className="relative inline-flex size-28 items-center justify-center">
        <svg viewBox="0 0 36 36" className="size-28 -rotate-90" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-muted"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-[600ms] motion-safe:ease-out"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="100 100"
            strokeDashoffset={offset}
          />
        </svg>
        {/* Centered percentage — the label lives OUTSIDE the ring now so that
            wide letter-spacing can't cross the stroke on any percentage. */}
        <span className="pointer-events-none absolute font-display text-2xl font-semibold tabular-nums">
          {clamped}%
        </span>
      </div>
      {/* Caption below the ring — immune to ring diameter. Kept tight and warm. */}
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
        on schedule
      </span>
    </div>
  );
}
