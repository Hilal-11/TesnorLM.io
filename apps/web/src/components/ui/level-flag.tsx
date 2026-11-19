import { cn } from "@/lib/utils";

export type Level = "beginner" | "intermediate" | "expert";

const LEVELS: Record<Level, { word: string; bars: number }> = {
  beginner: { word: "Beginner", bars: 1 },
  intermediate: { word: "Intermediate", bars: 2 },
  expert: { word: "Expert", bars: 3 },
};

const BAR_HEIGHTS = ["h-1.5", "h-2.5", "h-3"];

/** Explanation level as a 1–3 bar icon plus the word (never colour alone). */
export function LevelFlag({ level, className }: { level: Level; className?: string }) {
  const { word, bars } = LEVELS[level];
  return (
    <span
      data-slot="level-flag"
      className={cn("inline-flex items-center gap-2 text-small font-medium text-ink", className)}
    >
      <span aria-hidden className="flex h-3 items-end gap-0.5">
        {BAR_HEIGHTS.map((height, i) => (
          <span
            key={height}
            className={cn("w-1 rounded-xs", height, i < bars ? "bg-ink" : "bg-rule-strong")}
          />
        ))}
      </span>
      {word}
    </span>
  );
}
