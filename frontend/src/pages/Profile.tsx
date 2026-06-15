import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Globe,
  Newspaper,
  FileText,
  Database,
  Activity,
  Download,
} from "lucide-react";
import { getProfile } from "../lib/api";
import { formatDate, formatCurrency, sentimentLabel, sentimentColor, cn } from "../lib/utils";
import type { EnrichedProfile } from "../lib/types";
import RiskBadge from "../components/RiskBadge";
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
          {profile.status === "complete" && (
            <RiskBadge level={profile.risk_summary.overall_risk} size="lg" />
          )}
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

      {/* Risk summary card */}
      {profile.status !== "pending" && profile.status !== "processing" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Activity size={18} className="text-[#C9A85C]" />
              Resumen de riesgo
            </h2>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={13} />
              Exportar PDF
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <RiskMetric
              label="Lista negra"
              value={profile.risk_summary.blacklist_hit ? "Sí" : "No"}
              danger={profile.risk_summary.blacklist_hit}
            />
            <RiskMetric
              label="Registros judiciales"
              value={profile.risk_summary.judicial_records ? "Sí" : "No"}
              danger={profile.risk_summary.judicial_records}
            />
            <RiskMetric
              label="Presencia digital"
              value={`${profile.risk_summary.digital_presence_score}/100`}
            />
            <RiskMetric
              label="Consistencia de identidad"
              value={profile.risk_summary.identity_consistency ? "Verificada" : "Inconsistente"}
              danger={!profile.risk_summary.identity_consistency}
            />
          </div>

          {profile.processing_duration_ms && (
            <p className="text-xs text-slate-400 mt-4">
              Procesado en {(profile.processing_duration_ms / 1000).toFixed(1)} s &middot;{" "}
              {formatDate(profile.created_at)}
            </p>
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
                  {s.followers !== undefined && (
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

        <CollapsibleSection
          title="Listas de restricción"
          icon={<ShieldAlert size={17} />}
          count={
            profile.public_profile?.public_records?.filter((r) =>
              r.source === "OFAC" || r.source === "SAT Lista de Deudores"
            ).length
          }
        >
          {!profile.risk_summary?.blacklist_hit ? (
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              No figura en ninguna lista de restricción consultada.
            </div>
          ) : (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
              <strong>Alerta:</strong> El sujeto fue encontrado en al menos una lista de restricción.
              Revise los registros públicos para el detalle.
            </div>
          )}
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

function RiskMetric({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p
        className={cn(
          "text-base font-semibold",
          danger ? "text-red-600" : "text-slate-800"
        )}
      >
        {value}
      </p>
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
