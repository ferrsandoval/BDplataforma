import type { CSSProperties } from "react";
import type { EnrichedProfile } from "./types";
import { formatCurrency } from "./utils";

export type FindingKind = "vigente" | "liquidado" | "vencido" | "ref" | "publico";

export interface DossierItem {
  type: string;
  kind: FindingKind;
  meta: string;
  desc: string;
  origin: "Público" | "Profiler";
  isPublic: boolean;
}

const BADGE: Record<FindingKind, { color: string; bg: string }> = {
  vigente: { color: "#2F6B4F", bg: "#EDF5F0" },
  liquidado: { color: "#55606E", bg: "#F1F3F5" },
  vencido: { color: "#98342F", bg: "#F7ECEA" },
  ref: { color: "#34506B", bg: "#EAF0F6" },
  publico: { color: "#315E86", bg: "#EDF3F9" },
};

export function findingBadgeStyle(kind: FindingKind): CSSProperties {
  const b = BADGE[kind];
  return {
    fontSize: "10.5px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "5px",
    whiteSpace: "nowrap",
    color: b.color,
    background: b.bg,
  };
}

function loanKind(status: string): FindingKind {
  if (status === "vigente" || status === "liquidado" || status === "vencido") return status;
  return "ref";
}

/** Merge public records + internal history into a single "Registros e investigación" dossier. */
export function buildDossier(p: EnrichedProfile): DossierItem[] {
  const items: DossierItem[] = [];

  for (const r of p.public_profile?.public_records ?? []) {
    items.push({
      type: r.type,
      kind: "publico",
      meta: [r.source, r.date].filter(Boolean).join(" · "),
      desc: r.description,
      origin: "Público",
      isPublic: true,
    });
  }

  for (const l of p.internal_history?.loans ?? []) {
    const overdue = l.days_overdue > 0 ? ` · ${l.days_overdue} días de atraso` : "";
    items.push({
      type: `Crédito ${l.status}`,
      kind: loanKind(l.status),
      meta: `Cartera propia · ${l.date}`,
      desc: `Crédito por ${formatCurrency(l.amount)} — ${l.status}${overdue}.`,
      origin: "Profiler",
      isPublic: false,
    });
  }

  for (const ref of p.internal_history?.references ?? []) {
    items.push({
      type: "Referencia",
      kind: "ref",
      meta: "Expediente interno",
      desc: `${ref.name} · ${ref.relationship} · ${ref.phone}`,
      origin: "Profiler",
      isPublic: false,
    });
  }

  return items;
}

export interface ContactabilidadInfo {
  level: "Alta" | "Media" | "Baja";
  color: string;
  detail: string;
}

export function contactabilidad(p: EnrichedProfile): ContactabilidadInfo {
  const refs = p.internal_history?.references?.length ?? 0;
  const social = p.public_profile?.social_media?.length ?? 0;
  const hasPhone = typeof p.input?.telefono === "string" && !!p.input.telefono;
  const points = refs + social + (hasPhone ? 1 : 0);
  const detail = `${refs} ref. · ${social} redes`;
  if (points >= 4) return { level: "Alta", color: "#2F6B4F", detail };
  if (points >= 2) return { level: "Media", color: "#8A6516", detail };
  return { level: "Baja", color: "#98342F", detail };
}

export function totalFindings(p: EnrichedProfile): number {
  return (
    (p.public_profile?.social_media?.length ?? 0) +
    (p.public_profile?.news_mentions?.length ?? 0) +
    (p.public_profile?.public_records?.length ?? 0) +
    (p.internal_history?.loans?.length ?? 0) +
    (p.internal_history?.references?.length ?? 0)
  );
}
