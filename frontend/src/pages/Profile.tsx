import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Loader2,
  Globe,
  Newspaper,
  FileText,
  Database,
  Activity,
  Sparkles,
  Briefcase,
} from "lucide-react";
import { getProfile } from "../lib/api";
import { formatDate, formatCurrency, sentimentLabel, sentimentColor, cn } from "../lib/utils";
import type { EnrichedProfile } from "../lib/types";
import StatusBadge from "../components/StatusBadge";
import StatusPoller from "../components/StatusPoller";
import SourceResult from "../components/SourceResult";

export default function Profile() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<EnrichedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const handleUpdate = useCallback((updated: EnrichedProfile) => {
    setProfile(updated);
  }, []);

  useEffect(() => {
    if (!requestId) return;
    getProfile(requestId)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [requestId]);

  const isPolling =
    profile?.status === "pending" || profile?.status === "processing";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#0B2545]" size={32} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-slate-500">Perfil no encontrado.</div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {requestId && (
        <StatusPoller requestId={requestId} onUpdate={handleUpdate} active={isPolling} />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {profile.input?.nombre_completo ?? "—"}
          </h1>
          <p className="text-xs text-slate-500">
            CURP: {profile.input?.curp} &middot; RFC: {profile.input?.rfc} &middot; Tel:{" "}
            {profile.input?.telefono}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <StatusBadge status={profile.status} />
        </div>
      </div>

      {/* Processing spinner */}
      {isPolling && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4 mb-6">
          <Loader2 className="animate-spin text-blue-600 flex-shrink-0" size={24} />
          <div>
            <p className="font-medium text-blue-800">Enriquecimiento en proceso…</p>
            <p className="text-sm text-blue-600 mt-0.5">
              Consultando fuentes públicas y base de datos interna. Esto puede tardar hasta 30
              segundos.
            </p>
          </div>
        </div>
      )}



      {/* AI Summary */}
      {profile.ai_summary && (
        <div className="bg-gradient-to-r from-[#0B2545]/5 to-[#C9A85C]/10 border border-[#C9A85C]/20 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-[#C9A85C] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#C9A85C] uppercase tracking-wide mb-1.5">
                Resumen IA
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {profile.ai_summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Employment Info */}
      {profile.employment_info && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="text-[#C9A85C]"><Briefcase size={17} /></span>
            <span className="font-semibold text-slate-800">Información Laboral</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Government employee */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500 mb-1">Empleado de gobierno</p>
              <p className={cn(
                "text-lg font-bold",
                profile.employment_info.is_government_employee === true
                  ? "text-blue-600"
                  : profile.employment_info.is_government_employee === false
                  ? "text-slate-600"
                  : "text-slate-400"
              )}>
                {profile.employment_info.is_government_employee === true
                  ? "Sí"
                  : profile.employment_info.is_government_employee === false
                  ? "No"
                  : "Sin datos"}
              </p>
              {profile.employment_info.government_entity && (
                <p className="text-xs text-slate-500 mt-1">
                  {profile.employment_info.government_entity}
                </p>
              )}
            </div>

            {/* NSS */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500 mb-1">NSS (Seguro Social)</p>
              <p className={cn(
                "text-lg font-bold",
                profile.employment_info.nss ? "text-slate-800" : "text-slate-400"
              )}>
                {profile.employment_info.nss ?? "No encontrado"}
              </p>
            </div>

            {/* Employment status */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500 mb-1">Estatus laboral</p>
              <p className={cn(
                "text-lg font-bold",
                profile.employment_info.employment_status === "activo"
                  ? "text-green-600"
                  : profile.employment_info.employment_status === "inactivo"
                  ? "text-red-600"
                  : "text-slate-400"
              )}>
                {profile.employment_info.employment_status === "activo"
                  ? "Activo"
                  : profile.employment_info.employment_status === "inactivo"
                  ? "Inactivo"
                  : "Desconocido"}
              </p>
            </div>
          </div>

          {/* Evidence */}
          {(profile.employment_info.evidence?.length ?? 0) > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Evidencia</p>
              <ul className="space-y-1">
                {profile.employment_info.evidence.map((e, i) => (
                  <li key={i} className="text-xs text-slate-600 border-l-2 border-[#C9A85C] pl-2">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Collapsible sections */}
      <div className="space-y-4">
        <CollapsibleSection
          title="Redes sociales"
          icon={<Globe size={17} />}
          count={profile.public_profile?.social_media?.length}
        >
          {(profile.public_profile?.social_media?.length ?? 0) === 0 ? (
            <Empty text="No se encontraron perfiles en redes sociales." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {profile.public_profile.social_media.map((s, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-slate-800">{s.platform}</span>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#C9A85C] hover:underline truncate"
                      >
                        {s.url}
                      </a>
                    )}
                  </div>
                  {s.bio && <p className="text-sm text-slate-600 mb-2">{s.bio}</p>}
                  {s.followers != null && (
                    <p className="text-xs text-slate-500">
                      {s.followers.toLocaleString("es-MX")} seguidores
                    </p>
                  )}
                  {(s.public_posts_sample?.length ?? 0) > 0 && (
                    <ul className="mt-2 space-y-1">
                      {s.public_posts_sample.map((post, j) => (
                        <li key={j} className="text-xs text-slate-500 border-l-2 border-[#C9A85C] pl-2">
                          {post}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Menciones en noticias"
          icon={<Newspaper size={17} />}
          count={profile.public_profile?.news_mentions?.length}
        >
          {(profile.public_profile?.news_mentions?.length ?? 0) === 0 ? (
            <Empty text="No se encontraron menciones en noticias." />
          ) : (
            <div className="divide-y divide-slate-100">
              {profile.public_profile.news_mentions.map((n, i) => (
                <div key={i} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {n.url ? (
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-slate-800 hover:text-[#0B2545] hover:underline"
                        >
                          {n.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-slate-800">{n.title}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {n.source} {n.date && `· ${n.date}`}
                      </p>
                    </div>
                    {n.sentiment && (
                      <span className={cn("text-xs font-medium flex-shrink-0", sentimentColor(n.sentiment))}>
                        {sentimentLabel(n.sentiment)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Registros públicos"
          icon={<FileText size={17} />}
          count={profile.public_profile?.public_records?.length}
        >
          {(profile.public_profile?.public_records?.length ?? 0) === 0 ? (
            <Empty text="No se encontraron registros públicos." />
          ) : (
            <div className="divide-y divide-slate-100">
              {profile.public_profile.public_records.map((r, i) => (
                <div key={i} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-flex px-2 py-0.5 rounded bg-[#0B2545]/10 text-[#0B2545] text-xs font-medium mr-2">
                        {r.type}
                      </span>
                      <span className="text-xs text-slate-500">{r.source} {r.date && `· ${r.date}`}</span>
                      <p className="text-sm text-slate-700 mt-1">{r.description}</p>
                    </div>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#C9A85C] hover:underline flex-shrink-0"
                      >
                        Ver
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Historial interno"
          icon={<Database size={17} />}
          count={profile.internal_history?.loans?.length}
        >
          <div className="space-y-4">
            {/* Payment score */}
            {profile.internal_history?.payment_score !== undefined &&
              profile.internal_history.payment_score !== null && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500">Score de pago</p>
                    <p
                      className={cn(
                        "text-2xl font-bold",
                        profile.internal_history.payment_score >= 65
                          ? "text-green-600"
                          : profile.internal_history.payment_score >= 40
                          ? "text-amber-500"
                          : "text-red-600"
                      )}
                    >
                      {profile.internal_history.payment_score}
                      <span className="text-sm font-normal text-slate-400">/100</span>
                    </p>
                  </div>
                </div>
              )}

            {/* Loans */}
            {(profile.internal_history?.loans?.length ?? 0) === 0 ? (
              <Empty text="Sin historial de créditos en base de datos interna." />
            ) : (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Créditos</p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                  {profile.internal_history.loans.map((l, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 text-sm bg-white">
                      <div>
                        <span className="font-medium text-slate-800">{formatCurrency(l.amount)}</span>
                        <span className="text-slate-500 ml-2 text-xs">{l.date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {l.days_overdue > 0 && (
                          <span className="text-xs text-red-600 font-medium">
                            {l.days_overdue} días vencido
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            l.status === "vigente"
                              ? "bg-green-100 text-green-700"
                              : l.status === "liquidado"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          {l.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* References */}
            {(profile.internal_history?.references?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Referencias</p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                  {profile.internal_history.references.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 text-sm bg-white">
                      <span className="font-medium text-slate-800">{r.name}</span>
                      <span className="text-slate-500 text-xs">{r.relationship} · {r.phone}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>



        {/* Sources */}
        {(profile.sources_queried?.length ?? 0) > 0 && (
          <CollapsibleSection
            title="Fuentes consultadas"
            icon={<Activity size={17} />}
            count={profile.sources_queried?.length}
            defaultOpen={false}
          >
            <div>
              {profile.sources_queried.map((s, i) => (
                <SourceResult key={i} source={s} />
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[#C9A85C]">{icon}</span>
          <span className="font-semibold text-slate-800">{title}</span>
          {count !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {count}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp size={16} className="text-slate-400" />
        ) : (
          <ChevronDown size={16} className="text-slate-400" />
        )}
      </button>
      {open && <div className="px-6 pb-5">{children}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400 py-2">{text}</p>;
}
