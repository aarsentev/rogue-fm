"use client";

// Calm counterpart to the equalizer, shown for non-music segments (ads, DJ
// talk, overlays). A slow flowing sine in a low-opacity station colour with a
// label naming the segment — deliberately unhurried, so it reads as "not the
// music".

const HEIGHT = 44;

// One reusable stretch of sine (200 user units wide, ~8 periods). Translating
// the doubled-width SVG by -50% shifts an even number of periods → seamless.
const WAVE_PATH = (() => {
  const pts: string[] = [];
  for (let x = 0; x <= 200; x += 2) {
    const y = HEIGHT / 2 + 7 * Math.sin((2 * Math.PI * x) / 25);
    pts.push(`${x},${y.toFixed(2)}`);
  }
  return "M" + pts.join(" L");
})();

export function SmoothWave({ color }: { color: string }) {
  return (
    <div className="relative overflow-hidden" style={{ height: HEIGHT }}>
      <svg
        className="wave-flow absolute top-0 left-0"
        width="200%"
        height={HEIGHT}
        viewBox={`0 0 200 ${HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={WAVE_PATH}
          fill="none"
          stroke={color}
          strokeOpacity={0.4}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
