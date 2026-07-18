import { useState } from "react";
import { X, FileText, Table2, Download } from "lucide-react";

export interface ExportColumn {
  key: string;
  label: string;
}

export type ExportRow = Record<string, string | number | null | undefined>;

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  filename: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  countLabel: string;
  onViewFicha?: () => void;
}

function cell(v: string | number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

function toCsv(columns: ExportColumn[], rows: ExportRow[]): string {
  const esc = (val: string) => {
    if (/[",\n;]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
    return val;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(cell(r[c.key]))).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

function toXls(columns: ExportColumn[], rows: ExportRow[]): string {
  const escHtml = (val: string) =>
    val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const head = columns.map((c) => `<th>${escHtml(c.label)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td>${escHtml(cell(r[c.key]))}</td>`).join("")}</tr>`
    )
    .join("");
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob(["\uFEFF" + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportModal({
  open,
  onClose,
  title = "Exportar datos",
  subtitle = "Elige el formato de exportación",
  filename,
  columns,
  rows,
  countLabel,
  onViewFicha,
}: ExportModalProps) {
  const [fmt, setFmt] = useState<"csv" | "xlsx">("csv");
  if (!open) return null;

  const isCsv = fmt === "csv";
  const preview = rows.slice(0, 2);

  function handleDownload() {
    if (isCsv) {
      download(toCsv(columns, rows), `${filename}.csv`, "text/csv");
    } else {
      download(toXls(columns, rows), `${filename}.xls`, "application/vnd.ms-excel");
    }
  }

  const segBase =
    "px-3.5 py-[7px] text-[12.5px] font-semibold transition-colors cursor-pointer";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: "rgba(20,22,28,.44)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[640px] max-w-full bg-white rounded-xl overflow-hidden pmx-fade shadow-[0_24px_60px_rgba(20,22,28,.34)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[22px] py-[18px] border-b border-[#EAECEF]">
          <div>
            <h3 className="font-serif font-semibold text-[17px] text-ink m-0">{title}</h3>
            <p className="mt-[3px] text-[12.5px] text-[#8B929E]">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-[7px] bg-[#F1F3F5] flex items-center justify-center text-[#5A616E] hover:bg-[#E9ECEF] transition-colors"
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>

        <div className="px-[22px] pt-5 pb-[22px] flex flex-col gap-3">
          {/* Ficha PDF (only when a single expediente is in context) */}
          {onViewFicha && (
            <div className="border border-line rounded-[10px] px-[18px] py-4 flex gap-[15px] items-start">
              <div className="w-[38px] h-[38px] rounded-lg bg-accent-soft flex items-center justify-center flex-shrink-0">
                <FileText size={19} className="text-accent" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-ink">
                  Ficha del expediente
                  <span className="font-mono text-[10.5px] font-semibold text-accent bg-accent-soft px-1.5 py-px rounded ml-1.5">
                    PDF
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-[#727884] leading-[1.5]">
                  Documento imprimible con el detalle completo del sujeto: datos, síntesis y registros
                  de investigación.
                </p>
              </div>
              <div className="flex flex-col gap-[7px] flex-shrink-0">
                <button
                  onClick={onViewFicha}
                  className="border border-[#D7DAE0] bg-white text-[#3A4150] px-[13px] py-[7px] rounded-[7px] text-[12.5px] font-semibold whitespace-nowrap hover:bg-[#F7F8F9] transition-colors"
                >
                  Ver ficha
                </button>
              </div>
            </div>
          )}

          {/* CSV / Excel */}
          <div className="border border-line rounded-[10px] px-[18px] py-4">
            <div className="flex gap-[15px] items-start">
              <div className="w-[38px] h-[38px] rounded-lg bg-ok-soft flex items-center justify-center flex-shrink-0">
                <Table2 size={19} className="text-ok" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-ink">
                  {onViewFicha ? "Datos del expediente" : "Datos masivos"}
                  <span className="font-mono text-[10.5px] font-semibold text-ok bg-ok-soft px-1.5 py-px rounded ml-1.5">
                    CSV / XLS
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-[#727884] leading-[1.5]">
                  Exporta {onViewFicha ? "el expediente" : "el listado de expedientes"} en formato
                  tabular para análisis o carga en otros sistemas.
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex items-center gap-4 flex-wrap">
              <div className="flex items-center border border-[#D7DAE0] rounded-[7px] overflow-hidden">
                <button
                  onClick={() => setFmt("csv")}
                  className={segBase + (isCsv ? " bg-ink text-white" : " bg-white text-[#5A616E]")}
                >
                  CSV
                </button>
                <button
                  onClick={() => setFmt("xlsx")}
                  className={
                    segBase +
                    " border-l border-[#D7DAE0]" +
                    (!isCsv ? " bg-ink text-white" : " bg-white text-[#5A616E]")
                  }
                >
                  Excel (.xls)
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-3.5 border border-[#EDEFF2] rounded-lg overflow-hidden">
              <div className="px-3 py-[7px] bg-[#FAFBFC] border-b border-[#EDEFF2] text-[10.5px] font-semibold tracking-[0.04em] uppercase text-[#9AA1AD]">
                Vista previa · columnas exportadas
              </div>
              <div className="overflow-x-auto scroll">
                <table className="w-full border-collapse text-[11.5px] whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-[#EDEFF2]">
                      {columns.map((c) => (
                        <th
                          key={c.key}
                          className="text-left px-2.5 py-1.5 font-mono text-[10px] font-semibold text-[#8B929E]"
                        >
                          {c.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.length === 0 ? (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="px-2.5 py-2 text-[#9AA1AD] italic"
                        >
                          Sin datos para exportar
                        </td>
                      </tr>
                    ) : (
                      preview.map((r, i) => (
                        <tr key={i} className="border-b border-[#F4F5F7] last:border-0">
                          {columns.map((c) => (
                            <td key={c.key} className="px-2.5 py-1.5 text-[#3A404D]">
                              {cell(r[c.key]) || "—"}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3.5">
              <span className="text-xs text-[#9AA1AD]">
                {countLabel} · {isCsv ? "formato CSV (UTF-8)" : "formato Excel (.xls)"}
              </span>
              <button
                onClick={handleDownload}
                disabled={rows.length === 0}
                className="flex items-center gap-[7px] bg-ink text-white px-4 py-2 rounded-[7px] text-[12.5px] font-semibold hover:bg-[#2A2E36] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={14} strokeWidth={2} />
                Descargar {isCsv ? "CSV" : "XLS"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
