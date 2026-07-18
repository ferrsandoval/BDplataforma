import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ProfileStatus, Sentiment } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function sentimentLabel(sentiment?: Sentiment): string {
  const labels: Record<Sentiment, string> = {
    positive: "Positivo",
    neutral: "Neutral",
    negative: "Negativo",
  };
  return sentiment ? labels[sentiment] : "Sin clasificar";
}

export function sentimentColor(sentiment?: Sentiment): string {
  const colors: Record<Sentiment, string> = {
    positive: "text-green-600",
    neutral: "text-slate-600",
    negative: "text-red-600",
  };
  return sentiment ? colors[sentiment] : "text-slate-400";
}

export interface StatusMeta {
  label: string;
  color: string; // text
  bg: string;
  border: string;
  dot: string;
}

/** Semantic palette for expediente statuses (ProfilerMX v2). */
export function statusMeta(status?: string): StatusMeta {
  const map: Record<string, StatusMeta> = {
    complete: { label: "Completo", color: "#2F6B4F", bg: "#EDF5F0", border: "#CBE3D5", dot: "#3E8E6B" },
    processing: { label: "Procesando", color: "#315E86", bg: "#EDF3F9", border: "#C9DCEC", dot: "#4A7FB0" },
    pending: { label: "Pendiente", color: "#55606E", bg: "#F1F3F5", border: "#E2E5EA", dot: "#9AA2AE" },
    partial: { label: "Parcial", color: "#8A6516", bg: "#FAF4E6", border: "#EAD9B0", dot: "#C79A3A" },
    error: { label: "Error", color: "#98342F", bg: "#F7ECEA", border: "#E6C6C2", dot: "#C1554E" },
  };
  return map[status ?? ""] ?? map.pending;
}

export function statusLabel(status: ProfileStatus): string {
  return statusMeta(status).label;
}
