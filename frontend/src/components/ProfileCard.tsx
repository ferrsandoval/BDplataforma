import { useNavigate } from "react-router-dom";
import { ArrowRight, Trash2 } from "lucide-react";
import { formatDate } from "../lib/utils";
import StatusBadge from "./StatusBadge";
import type { ProfileListItem } from "../lib/types";

export default function ProfileCard({
  profile,
  onDelete,
}: {
  profile: ProfileListItem;
  onDelete?: (requestId: string) => void;
}) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/perfil/${profile.request_id}`)}
      className="bg-white rounded-xl border border-slate-200 p-4 hover:border-[#C9A85C] hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate">
            {profile.input?.nombre_completo ?? "—"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            CURP: {profile.input?.curp ?? "—"} &middot; RFC: {profile.input?.rfc ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(profile.request_id);
              }}
              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Eliminar búsqueda"
            >
              <Trash2 size={15} />
            </button>
          )}
          <ArrowRight
            size={16}
            className="text-slate-300 group-hover:text-[#C9A85C] transition-colors mt-0.5"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <StatusBadge status={profile.status} />
        <span className="text-xs text-slate-400 ml-auto">{formatDate(profile.created_at)}</span>
      </div>
    </div>
  );
}
