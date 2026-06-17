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

export function statusLabel(status: ProfileStatus): string {
  const labels: Record<ProfileStatus, string> = {
    pending: "Pendiente",
    processing: "Procesando",
    complete: "Completado",
    error: "Error",
  };
  return labels[status];
}

export function statusColor(status: ProfileStatus): string {
  const colors: Record<ProfileStatus, string> = {
    pending: "text-slate-600",
    processing: "text-blue-600",
    complete: "text-green-600",
    error: "text-red-600",
  };
  return colors[status];
}

export function statusBg(status: ProfileStatus): string {
  const colors: Record<ProfileStatus, string> = {
    pending: "bg-slate-100 text-slate-800",
    processing: "bg-blue-100 text-blue-800",
    complete: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
  };
  return colors[status];
}
