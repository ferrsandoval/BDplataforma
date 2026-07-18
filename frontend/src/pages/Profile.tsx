import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronDown,
  Loader2,
  Download,
  Sparkles,
  Check,
  Lock,
  Shield,
  Landmark,
} from "lucide-react";
import { getProfile } from "../lib/api";
import { sentimentLabel, cn } from "../lib/utils";
import {
  buildDossier,
  contactabilidad,
  totalFindings,
  findingBadgeStyle,
} from "../lib/profileView";
import type { EnrichedProfile, Sentiment } from "../lib/types";
import StatusBadge from "../components/StatusBadge";
import StatusPoller from "../components/StatusPoller";
import ExportModal, { type ExportRow } from "../components/ExportModal";
import Ficha from "../components/Ficha";

function inputStr(input: Record<string, unknown> | undefined, key: string): string {
  const v = input?.[key];
  return typeof v === "string" && v ? v : "—";
}

const sentimentTag: Record<Sentiment, { color: string; bg: string }> = {
  positive: { color: "#2F6B4F", bg: "#EDF5F0" },
  neutral: { color: "#55606E", bg: "#F1F3F5" },
  negative: { color: "#98342F", bg: "#F7ECEA" },
};

export default function Profile() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<EnrichedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [showFicha, setShowFicha] = useState(false);

  const handleUpdate = useCallback((updated: EnrichedProfile) => setProfile(updated), []);

  useEffect(() => {
    if (!requestId) return;
    getProfile(requestId).then(setProfile).finally(() => setLoading(false));
  }, [requestId]);

  const isPolling = profile?.status === "pending" || profile?.status === "processing";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  if (!profile) {
    return <div className="p-8 text-center text-[#727884]">Expediente no encontrado.</div>;
  }

  if (showFicha) {
    return <Ficha profile={profile} onBack={() => setShowFicha(false)} />;
  }

  const dossier = buildDossier(profile);
  const contact = contactabilidad(profile);
  const social = profile.public_profile?.social_media ?? [];
  const news = profile.public_profile?.news_mentions ?? [];
  const sources = profile.sources_queried ?? [];
  const score = profile.internal_history?.payment_score;
  const emp = profile.employment_info;
  const hasEmployment =
    !!emp &&
    (emp.is_government_employee != null ||
      !!emp.nss ||
      (emp.employment_status && emp.employment_status !== "desconocido") ||
      (emp.evidence?.length ?? 0) > 0);

  const shortId = profile.request_id.slice(-4).toUpperCase();

  const exportRows: ExportRow[] = dossier.map((d) => ({
    tipo: d.type,
    hallazgo: d.desc,
    origen: d.origin,
  }));

  return (
    <div>
      {requestId && <StatusPoller requestId={requestId} onUpdate={handleUpdate} active={isPolling} />}

      {/* Header */}
      <header
        className="sticky top-0 z-[5] border-b border-line px-[34px] py-3.5 flex items-center gap-3.5 backdrop-blur-md"
        style={{ background: "rgba(243,244,246,.9)" }}
      >
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 border border-[#D7DAE0] bg-white px-3 py-[7px] rounded-[7px] text-[12.5px] font-medium text-[#5A616E] hover:bg-[#F7F8F9] transition-colors"
        >
          <ChevronLeft size={15} strokeWidth={2} />
          Expedientes
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif font-semibold text-[19px] text-ink m-0 truncate">
              {inputStr(profile.input, "nombre_completo")}
            </h1>
            <StatusBadge status={profile.status} />
          </div>
          <div className="font-mono text-[11.5px] text-[#8B929E] mt-0.5">
            Exp. {shortId} · CURP {inputStr(profile.input, "curp")} · RFC {inputStr(profile.input, "rfc")}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 bg-ink text-white px-[13px] py-2 rounded-[7px] text-[12.5px] font-semibold hover:bg-[#2A2E36] transition-colors"
          >
            <Download size={14} strokeWidth={2} />
            Exportar
          </button>
        </div>
      </header>

      <div className="px-[34px] pt-6 pb-12 max-w-[1080px]">
        {/* Processing banner */}
        {isPolling && (
          <div className="bg-info-soft border border-[#C9DCEC] rounded-[10px] p-4 flex items-center gap-3.5 mb-[18px]">
            <Loader2 className="animate-spin text-info flex-shrink-0" size={22} />
            <div>
              <p className="font-semibold text-info m-0">Investigación en proceso…</p>
              <p className="text-[13px] text-[#5A7A97] mt-0.5 m-0">
                Consultando fuentes públicas y base de datos interna. Esto puede tardar hasta 30 segundos.
              </p>
            </div>
          </div>
        )}

        {/* Metric strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line rounded-[10px] overflow-hidden mb-[18px]">
          <Metric label="Registros hallados" value={String(totalFindings(profile))} sub="públicos y de investigación" />
          <Metric label="Redes y noticias" value={String(social.length + news.length)} sub="presencia pública" />
          <Metric
            label="Score de pago"
            value={score != null ? String(score) : "—"}
            valueSuffix={score != null ? "/100" : undefined}
            valueColor={score != null ? (score >= 65 ? "#2F6B4F" : score >= 40 ? "#8A6516" : "#98342F") : "#9AA1AD"}
            sub="historial interno"
          />
          <Metric label="Contactabilidad" value={contact.level} valueColor={contact.color} sub={contact.detail} smallValue />
        </div>

        {/* Síntesis */}
        {profile.ai_summary && (
          <div className="bg-white border border-line rounded-[10px] px-[22px] py-[19px] mb-[18px]">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-6 h-6 rounded-[5px] bg-accent-soft flex items-center justify-center">
                <Sparkles size={13} className="text-accent" strokeWidth={2} />
              </span>
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-accent">
                Síntesis de investigación
              </span>
            </div>
            <p className="m-0 text-sm leading-[1.65] text-[#3A404D] max-w-[82ch]">{profile.ai_summary}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_336px] gap-[18px] items-start">
          {/* LEFT column */}
          <div className="flex flex-col gap-3.5 min-w-0">
            {/* 01 Registros e investigación */}
            <Section n="01" title="Registros e investigación" count={dossier.length}>
              {dossier.length === 0 ? (
                <Empty text="Sin registros de investigación." />
              ) : (
                <>
                  <div className="flex items-center gap-3.5 py-1.5">
                    <Legend color="#34506B" label="Investigación Profiler" />
                    <Legend color="#315E86" label="Registro público" />
                  </div>
                  {dossier.map((d, i) => (
                    <div key={i} className="py-3 border-t border-[#F0F1F3]">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span style={findingBadgeStyle(d.kind)}>{d.type}</span>
                        <span className="text-[11.5px] text-[#9AA1AD]">{d.meta}</span>
                        <span className="ml-auto inline-flex items-center gap-1">
                          {d.isPublic ? (
                            <span className="text-[10px] font-semibold text-info inline-flex items-center gap-1">
                              <Landmark size={11} strokeWidth={2.2} />
                              Público
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-accent inline-flex items-center gap-1">
                              <Shield size={11} strokeWidth={2.2} />
                              Profiler
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="m-0 text-[13px] text-[#3A404D] leading-[1.5]">{d.desc}</p>
                    </div>
                  ))}
                </>
              )}
            </Section>

            {/* 02 Noticias */}
            <Section n="02" title="Menciones en noticias" count={news.length}>
              {news.length === 0 ? (
                <Empty text="No se encontraron menciones en noticias." />
              ) : (
                news.map((nItem, i) => {
                  const tag = nItem.sentiment ? sentimentTag[nItem.sentiment] : sentimentTag.neutral;
                  return (
                    <div key={i} className="flex items-start justify-between gap-3.5 py-3 border-t border-[#F0F1F3] first:border-t-0">
                      <div className="min-w-0">
                        {nItem.url ? (
                          <a href={nItem.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-ink-soft hover:underline">
                            {nItem.title}
                          </a>
                        ) : (
                          <span className="text-[13px] font-semibold text-ink-soft">{nItem.title}</span>
                        )}
                        <div className="text-[11.5px] text-[#9AA1AD] mt-0.5">
                          {nItem.source}
                          {nItem.date && ` · ${nItem.date}`}
                        </div>
                      </div>
                      {nItem.sentiment && (
                        <span
                          className="text-[11px] font-semibold px-2.5 py-[3px] rounded-[5px] whitespace-nowrap flex-shrink-0"
                          style={{ color: tag.color, background: tag.bg }}
                        >
                          {sentimentLabel(nItem.sentiment)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </Section>

            {/* 03 Redes */}
            <Section n="03" title="Redes sociales" count={social.length}>
              {social.length === 0 ? (
                <Empty text="No se encontraron perfiles en redes sociales." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {social.map((s, i) => (
                    <div key={i} className="border border-[#EDEFF2] bg-[#FAFBFC] rounded-[9px] px-3.5 py-3.5 min-w-0">
                      <div className="mb-1.5 min-w-0">
                        <span className="font-semibold text-[13px] text-ink-soft">{s.platform}</span>
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-[#9AA1AD] font-mono truncate mt-px hover:underline">
                            {s.url}
                          </a>
                        ) : (
                          s.name && <span className="block text-[11px] text-[#9AA1AD] font-mono truncate mt-px">{s.name}</span>
                        )}
                      </div>
                      {s.bio && <p className="m-0 mb-1.5 text-[12px] text-[#5A616E] leading-[1.5]">{s.bio}</p>}
                      {s.followers != null && (
                        <div className="text-[11px] text-[#9AA1AD] tabular-nums">
                          {s.followers.toLocaleString("es-MX")} seguidores
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* 04 Información laboral (real data, only when present) */}
            {hasEmployment && emp && (
              <Section n="04" title="Información laboral">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <EmpCard
                    label="Empleado de gobierno"
                    value={emp.is_government_employee === true ? "Sí" : emp.is_government_employee === false ? "No" : "Sin datos"}
                    color={emp.is_government_employee === true ? "#315E86" : "#55606E"}
                    detail={emp.government_entity ?? undefined}
                  />
                  <EmpCard label="NSS (Seguro Social)" value={emp.nss ?? "No encontrado"} color={emp.nss ? "#1D2127" : "#9AA1AD"} />
                  <EmpCard
                    label="Estatus laboral"
                    value={emp.employment_status === "activo" ? "Activo" : emp.employment_status === "inactivo" ? "Inactivo" : "Desconocido"}
                    color={emp.employment_status === "activo" ? "#2F6B4F" : emp.employment_status === "inactivo" ? "#98342F" : "#9AA1AD"}
                  />
                </div>
                {(emp.evidence?.length ?? 0) > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#F0F1F3]">
                    <p className="text-[11px] font-semibold text-[#9AA1AD] uppercase mb-2">Evidencia</p>
                    <ul className="space-y-1">
                      {emp.evidence.map((e, i) => (
                        <li key={i} className="text-[12px] text-[#5A616E] border-l-2 border-accent pl-2">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            )}
          </div>

          {/* RIGHT rail */}
          <aside className="flex flex-col gap-3.5 lg:sticky lg:top-[82px]">
            {sources.length > 0 && (
              <div className="bg-white border border-line rounded-[10px] px-5 py-[17px]">
                <div className="font-serif font-semibold text-sm text-ink mb-3">Fuentes consultadas</div>
                {sources.map((src, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-t border-[#F0F1F3] first:border-t-0">
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-ok" strokeWidth={2.4} />
                      <span className="text-[12.5px] text-[#3A404D]">{src.source}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[#9AA1AD]">{src.duration_ms} ms</span>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-[10px] px-[18px] py-[15px]" style={{ background: "#FAFAF7", border: "1px solid #E7E3D6" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lock size={14} style={{ color: "#9A7B2E" }} strokeWidth={2} />
                <span className="text-[10.5px] font-semibold tracking-[0.05em] uppercase" style={{ color: "#8A6E28" }}>
                  Confidencial
                </span>
              </div>
              <p className="m-0 text-[12px] leading-[1.55]" style={{ color: "#7A6A3E" }}>
                Documento de uso restringido. La consulta requiere consentimiento previo del titular
                registrado en el sistema de consentimientos.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filename={`expediente-${shortId}`}
        columns={[
          { key: "tipo", label: "Tipo" },
          { key: "hallazgo", label: "Hallazgo" },
          { key: "origen", label: "Origen" },
        ]}
        rows={exportRows}
        countLabel={`${exportRows.length} registros`}
        onViewFicha={() => {
          setExportOpen(false);
          setShowFicha(true);
        }}
      />
    </div>
  );
}

function Section({
  n,
  title,
  count,
  children,
}: {
  n: string;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="bg-white border border-line rounded-[10px] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-[11px] px-5 py-[15px] text-left"
      >
        <span className="font-mono text-[12px] font-semibold text-[#B0B6C0]">{n}</span>
        <span className="font-serif font-semibold text-[15px] text-ink">{title}</span>
        {count !== undefined && (
          <span className="text-[11px] font-semibold bg-[#F0F1F3] text-[#6B7280] px-2 py-0.5 rounded-full">{count}</span>
        )}
        <ChevronDown
          size={16}
          className={cn("ml-auto text-[#B0B6C0] transition-transform", !open && "-rotate-90")}
          strokeWidth={2}
        />
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#727884]">
      <span className="w-2 h-2 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}

function Metric({
  label,
  value,
  valueSuffix,
  valueColor = "#1B1E24",
  sub,
  smallValue,
}: {
  label: string;
  value: string;
  valueSuffix?: string;
  valueColor?: string;
  sub: string;
  smallValue?: boolean;
}) {
  return (
    <div className="bg-white px-[17px] py-[15px]">
      <div className="text-[10.5px] font-semibold tracking-[0.04em] uppercase text-[#8B929E]">{label}</div>
      <div
        className={cn("font-serif font-semibold mt-2 tabular-nums", smallValue ? "text-[19px]" : "text-[23px]")}
        style={{ color: valueColor }}
      >
        {value}
        {valueSuffix && <span className="text-[13px] text-[#9AA1AD]">{valueSuffix}</span>}
      </div>
      <div className="text-[11.5px] text-[#727884] mt-[3px]">{sub}</div>
    </div>
  );
}

function EmpCard({ label, value, color, detail }: { label: string; value: string; color: string; detail?: string }) {
  return (
    <div className="rounded-[9px] bg-[#FAFBFC] border border-[#EDEFF2] p-3.5">
      <p className="text-[11px] text-[#9AA1AD] mb-1">{label}</p>
      <p className="text-base font-semibold m-0" style={{ color }}>{value}</p>
      {detail && <p className="text-[11px] text-[#9AA1AD] mt-1 m-0">{detail}</p>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[13px] text-[#9AA1AD] py-2">{text}</p>;
}
