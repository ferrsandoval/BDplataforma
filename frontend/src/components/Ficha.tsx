import { ChevronLeft, Printer, Download, Shield } from "lucide-react";
import type { EnrichedProfile } from "../lib/types";
import { statusLabel, formatDate } from "../lib/utils";
import { buildDossier, contactabilidad, totalFindings } from "../lib/profileView";

function inputStr(input: Record<string, unknown> | undefined, key: string): string {
  const v = input?.[key];
  return typeof v === "string" && v ? v : "—";
}

export default function Ficha({ profile, onBack }: { profile: EnrichedProfile; onBack: () => void }) {
  const shortId = profile.request_id.slice(-4).toUpperCase();
  const dossier = buildDossier(profile);
  const contact = contactabilidad(profile);
  const operador =
    (typeof profile.input?.operador_id === "string" && profile.input.operador_id) || "OP-001";

  const Field = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div>
      <div className="text-[10px] tracking-[0.05em] uppercase text-[#9AA1AD]">{label}</div>
      <div className="font-mono text-[12.5px] mt-0.5" style={{ color: color ?? "#1D2127" }}>{value}</div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#E7E9ED" }}>
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-[5] bg-ink text-white px-[34px] py-3 flex items-center gap-3.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 border border-white/20 bg-transparent px-3 py-[7px] rounded-[7px] text-[12.5px] font-medium text-[#DADCE0] hover:bg-white/5 transition-colors"
        >
          <ChevronLeft size={15} strokeWidth={2} />
          Volver
        </button>
        <span className="text-[13px] text-[#B7BCC5]">Vista previa · Ficha del expediente</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 border border-white/20 bg-transparent text-[#DADCE0] px-[13px] py-[7px] rounded-[7px] text-[12.5px] font-medium hover:bg-white/5 transition-colors"
          >
            <Printer size={14} strokeWidth={2} />
            Imprimir
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-accent text-white px-3.5 py-[7px] rounded-[7px] text-[12.5px] font-semibold hover:bg-accent-strong transition-colors"
          >
            <Download size={14} strokeWidth={2} />
            Descargar PDF
          </button>
        </div>
      </div>

      {/* Sheet */}
      <div className="px-5 pt-8 pb-16 flex justify-center">
        <div className="print-sheet w-[816px] max-w-full bg-white shadow-[0_4px_24px_rgba(20,22,28,.12)] px-[60px] py-14">
          {/* Doc header */}
          <div className="flex items-start justify-between border-b-2 border-ink pb-4">
            <div className="flex items-center gap-[11px]">
              <div className="w-[34px] h-[34px] rounded-md bg-accent flex items-center justify-center">
                <Shield size={18} className="text-white" strokeWidth={2} />
              </div>
              <div>
                <div className="font-serif font-semibold text-[19px] text-ink">ProfilerMX</div>
                <div className="text-[10.5px] tracking-[0.03em] text-[#727884]">
                  Ficha de investigación de deudor
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-[11px] text-[#5A616E] leading-[1.6]">
              <div>Exp. {shortId}</div>
              <div>{formatDate(profile.created_at)}</div>
              <div>Operador {operador}</div>
            </div>
          </div>

          {/* Subject */}
          <div className="mt-6">
            <div className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-[#8B929E] mb-2">
              Sujeto investigado
            </div>
            <div className="font-serif font-semibold text-2xl text-ink">
              {inputStr(profile.input, "nombre_completo")}
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-3.5 mt-4">
              <Field label="CURP" value={inputStr(profile.input, "curp")} />
              <Field label="RFC" value={inputStr(profile.input, "rfc")} />
              <Field label="Teléfono" value={inputStr(profile.input, "telefono")} />
              <Field label="Estado" value={statusLabel(profile.status)} />
              <Field label="Registros hallados" value={String(totalFindings(profile))} />
              <Field label="Contactabilidad" value={contact.level} color={contact.color} />
            </div>
          </div>

          {/* Synthesis */}
          {profile.ai_summary && (
            <div className="mt-6 border-l-[3px] border-accent pl-4 py-0.5">
              <div className="text-[10.5px] font-semibold tracking-[0.06em] uppercase text-accent mb-1.5">
                Síntesis
              </div>
              <p className="m-0 text-[12.5px] leading-[1.6] text-[#3A404D]">{profile.ai_summary}</p>
            </div>
          )}

          {/* Findings table */}
          {dossier.length > 0 && (
            <div className="mt-[26px]">
              <div className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-[#8B929E] mb-2.5">
                Registros e investigación
              </div>
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b-[1.5px] border-[#D7DAE0]">
                    <th className="text-left pr-2 py-[7px] text-[10px] tracking-[0.05em] uppercase text-[#9AA1AD] w-[150px]">Tipo</th>
                    <th className="text-left px-2 py-[7px] text-[10px] tracking-[0.05em] uppercase text-[#9AA1AD]">Hallazgo</th>
                    <th className="text-left pl-2 py-[7px] text-[10px] tracking-[0.05em] uppercase text-[#9AA1AD] w-20">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.map((d, i) => (
                    <tr key={i} className="border-b border-[#EDEFF2] align-top">
                      <td className="pr-2 py-2.5 text-ink-soft font-semibold">{d.type}</td>
                      <td className="px-2 py-2.5 text-[#3A404D] leading-[1.5]">{d.desc}</td>
                      <td className="pl-2 py-2.5 text-[#727884]">{d.origin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="mt-[34px] pt-3.5 border-t border-[#D7DAE0] flex justify-between items-center">
            <span className="text-[10px] text-[#9AA1AD] tracking-[0.03em]">
              Documento confidencial · ProfilerMX · Uso restringido a operadores autorizados
            </span>
            <span className="font-mono text-[10px] text-[#9AA1AD]">Pág. 1 / 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
