"use client";

type Props = {
  on: boolean;
  color: string;
};

export function Toggle({ on, color }: Props) {
  return (
    <span
      className="inline-block w-[38px] h-5 rounded-[10px] relative shrink-0 transition-colors"
      style={{ background: on ? color : "var(--color-line-strong)" }}
      aria-hidden="true"
    >
      <span
        className="absolute top-[3px] w-[14px] h-[14px] rounded-full transition-all"
        style={{
          left: on ? 19 : 3,
          background: on ? "var(--color-on-accent)" : "var(--color-ink-5)",
        }}
      />
    </span>
  );
}
