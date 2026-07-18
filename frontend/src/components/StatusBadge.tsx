import { statusMeta } from "../lib/utils";
import type { ProfileStatus } from "../lib/types";

export default function StatusBadge({ status }: { status: ProfileStatus }) {
  const m = statusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap border rounded-md"
      style={{
        color: m.color,
        background: m.bg,
        borderColor: m.border,
        padding: "3px 9px 3px 8px",
      }}
    >
      <span
        className={status === "processing" ? "pmx-pulse" : undefined}
        style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot }}
      />
      {m.label}
    </span>
  );
}
