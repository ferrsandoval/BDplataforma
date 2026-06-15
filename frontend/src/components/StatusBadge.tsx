import { cn, statusLabel } from "../lib/utils";
import type { ProfileStatus } from "../lib/types";

const styles: Record<ProfileStatus, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  processing: "bg-blue-100 text-blue-700 border-blue-200",
  complete: "bg-green-100 text-green-700 border-green-200",
  partial: "bg-yellow-100 text-yellow-700 border-yellow-200",
  error: "bg-red-100 text-red-700 border-red-200",
};

export default function StatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        styles[status] ?? styles.pending
      )}
    >
      {status === "processing" && (
        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      )}
      {statusLabel(status)}
    </span>
  );
}
