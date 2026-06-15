import { cn, riskBg, riskLabel } from "../lib/utils";
import type { RiskLevel } from "../lib/types";

interface Props {
  level: RiskLevel;
  size?: "sm" | "md" | "lg";
}

export default function RiskBadge({ level, size = "md" }: Props) {
  const sizeClass = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5 font-semibold",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        sizeClass,
        riskBg(level)
      )}
    >
      <span
        className={cn(
          "rounded-full mr-1.5",
          size === "lg" ? "w-2.5 h-2.5" : "w-2 h-2",
          {
            low: "bg-green-500",
            medium: "bg-amber-500",
            high: "bg-red-500",
          }[level]
        )}
      />
      Riesgo {riskLabel(level)}
    </span>
  );
}
