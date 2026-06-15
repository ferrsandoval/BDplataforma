import { CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { cn } from "../lib/utils";
import type { SourceStatus } from "../lib/types";

const icons = {
  success: <CheckCircle size={15} className="text-green-600" />,
  not_found: <XCircle size={15} className="text-slate-400" />,
  error: <AlertCircle size={15} className="text-red-500" />,
  timeout: <Clock size={15} className="text-amber-500" />,
};

const labels = {
  success: "Encontrado",
  not_found: "No encontrado",
  error: "Error",
  timeout: "Tiempo agotado",
};

export default function SourceResult({ source }: { source: SourceStatus }) {
  const icon = icons[source.status] ?? icons.error;
  const label = labels[source.status] ?? source.status;

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        {icon}
        <span>{source.source}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn("text-xs", {
          success: "text-green-600",
          not_found: "text-slate-400",
          error: "text-red-500",
          timeout: "text-amber-500",
        }[source.status] ?? "text-slate-400")}>
          {label}
        </span>
        <span className="text-xs text-slate-400">{source.duration_ms} ms</span>
      </div>
    </div>
  );
}
