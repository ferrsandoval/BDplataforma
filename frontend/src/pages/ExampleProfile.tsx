import { useState } from "react";
import { ArrowLeft, Globe, Newspaper, FileText, Database, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDate, formatCurrency, sentimentLabel, sentimentColor, cn } from "../lib/utils";
import StatusBadge from "../components/StatusBadge";
import SourceResult from "../components/SourceResult";
import { mockProfile } from "../lib/mockData";
import type { EnrichedProfile } from "../lib/types";

export default function ExampleProfile() {
  const navigate = useNavigate();
  const profile = mockProfile;

  return (
    <div className="p-8 max-w-5xl mx-auto">
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
                            l.status === "active"
                              ? "bg-green-100 text-green-700"
                              : l.status === "paid"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          {l.status === "active" ? "Activo" : l.status === "paid" ? "Pagado" : "Vencido"}
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
            icon={<Globe size={17} />}
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
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="text-[#C9A85C]">{icon}</div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
          {count !== undefined && (
            <span className="text-xs text-slate-400 ml-1">({count})</span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "text-slate-400 transition-transform",
            isOpen ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {isOpen && <div className="mt-4">{children}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 text-center">
      {text}
    </div>
  );
}
