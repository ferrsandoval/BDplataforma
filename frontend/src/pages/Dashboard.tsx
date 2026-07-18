import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Download, ChevronRight, Trash2, Filter } from "lucide-react";
import { listProfiles, getStats, deleteProfile } from "../lib/api";
import { formatDate, statusLabel } from "../lib/utils";
import StatusBadge from "../components/StatusBadge";
import ExportModal, { type ExportRow } from "../components/ExportModal";
import type { ProfileListItem, StatsResponse, ProfileStatus } from "../lib/types";

const LIMIT = 10;

const EXPORT_COLUMNS = [
  { key: "nombre", label: "Nombre" },
  { key: "curp", label: "CURP" },
  { key: "rfc", label: "RFC" },
  { key: "telefono", label: "Teléfono" },
  { key: "estado", label: "Estado" },
  { key: "fecha", label: "Fecha" },
];

function inputStr(input: Record<string, unknown> | undefined, key: string): string {
  const v = input?.[key];
  return typeof v === "string" ? v : "";
}

function toExportRow(p: ProfileListItem): ExportRow {
  return {
    nombre: inputStr(p.input, "nombre_completo"),
    curp: inputStr(p.input, "curp"),
    rfc: inputStr(p.input, "rfc"),
    telefono: inputStr(p.input, "telefono"),
    estado: statusLabel(p.status),
    fecha: formatDate(p.created_at),
  };
}

function todayLabel(): string {
  const d = new Date();
  const date = d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return `${date.charAt(0).toUpperCase()}${date.slice(1)} · ${time} hrs`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportRows, setExportRows] = useState<ExportRow[]>([]);

  const fetchProfiles = useCallback(async (params: { q: string; date_from: string; date_to: string; page: number }) => {
    setListLoading(true);
    try {
      const res = await listProfiles({
        page: params.page,
        limit: LIMIT,
        q: params.q,
        date_from: params.date_from,
        date_to: params.date_to,
      });
      setProfiles(res.items as ProfileListItem[]);
      setTotalPages(res.pages || 1);
      setTotal(res.total || 0);
    } finally {
      setListLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([
      fetchProfiles({ q: "", date_from: "", date_to: "", page: 1 }),
      getStats(),
    ])
      .then(([, statsRes]) => setStats(statsRes))
      .finally(() => setLoading(false));
  }, [fetchProfiles]);

  // Debounced refetch on filter change (skip the very first render)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      fetchProfiles({ q, date_from: dateFrom, date_to: dateTo, page });
    }, 300);
    return () => clearTimeout(t);
  }, [q, dateFrom, dateTo, page, fetchProfiles]);

  function resetPageAnd(fn: () => void) {
    setPage(1);
    fn();
  }

  async function handleDelete(requestId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("¿Eliminar este expediente?")) return;
    try {
      await deleteProfile(requestId);
      fetchProfiles({ q, date_from: dateFrom, date_to: dateTo, page });
      setStats(await getStats());
    } catch {
      alert("Error al eliminar");
    }
  }

  async function openExport() {
    // Fetch all matching rows (capped) so the export reflects the full filtered set.
    try {
      const res = await listProfiles({
        page: 1,
        limit: 1000,
        q,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setExportRows((res.items as ProfileListItem[]).map(toExportRow));
    } catch {
      setExportRows(profiles.map(toExportRow));
    }
    setExportOpen(true);
  }

  return (
    <div>
      {/* Sticky header */}
      <header className="sticky top-0 z-[5] border-b border-line px-[34px] py-[18px] flex items-center justify-between gap-5 backdrop-blur-md" style={{ background: "rgba(243,244,246,.9)" }}>
        <div>
          <h1 className="font-serif font-semibold text-[22px] text-ink m-0">Expedientes</h1>
          <p className="mt-1 text-[12.5px] text-[#727884]">{todayLabel()}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={15} className="absolute left-[11px] top-[9px] text-[#9AA1AD]" strokeWidth={2} />
            <input
              value={q}
              onChange={(e) => resetPageAnd(() => setQ(e.target.value))}
              placeholder="Buscar por nombre, CURP o RFC…"
              className="w-[280px] pl-8 pr-3 py-2 border border-[#D7DAE0] rounded-[7px] bg-white text-[13px] text-ink-soft outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={openExport}
            className="flex items-center gap-[7px] bg-white text-[#3A4150] border border-[#D7DAE0] px-3.5 py-2 rounded-[7px] text-[13px] font-semibold hover:bg-[#F7F8F9] transition-colors"
          >
            <Download size={15} strokeWidth={1.9} />
            Exportar
          </button>
          <button
            onClick={() => navigate("/nueva-busqueda")}
            className="flex items-center gap-[7px] bg-ink text-white px-[15px] py-[9px] rounded-[7px] text-[13px] font-semibold hover:bg-[#2A2E36] transition-colors"
          >
            <Plus size={15} strokeWidth={2.2} />
            Nueva investigación
          </button>
        </div>
      </header>

      <div className="px-[34px] pt-[26px] pb-11 max-w-[1200px]">
        {/* Metric tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line rounded-[10px] overflow-hidden mb-[26px]">
          <MetricTile label="Expedientes totales" value={loading ? "—" : String(stats?.total_searches ?? 0)} sub="registrados en el sistema" />
          <MetricTile
            label="Tiempo promedio"
            value={loading ? "—" : `${((stats?.avg_processing_time_ms ?? 0) / 1000).toFixed(1)}`}
            valueSuffix="s"
            sub="por investigación"
          />
          <MetricTile label="En proceso" value={loading ? "—" : String(stats?.in_process ?? 0)} sub="consultando fuentes" subColor="#315E86" />
          <MetricTile label="Concluidos hoy" value={loading ? "—" : String(stats?.completed_today ?? 0)} sub="en el día" subColor="#2F6B4F" />
        </div>

        {/* Table card */}
        <div className="bg-white border border-line rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-[15px] border-b border-line-soft">
            <div className="flex items-baseline gap-2.5">
              <h2 className="font-serif font-semibold text-[15px] text-ink m-0">Expedientes recientes</h2>
              {!listLoading && <span className="text-[12.5px] text-[#9AA1AD] tabular-nums">{total} resultados</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 border border-[#D7DAE0] rounded-[7px] px-2.5 py-1.5 bg-white">
                <Filter size={13} className="text-[#9AA1AD]" strokeWidth={2} />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => resetPageAnd(() => setDateFrom(e.target.value))}
                  className="border-0 outline-none text-[12.5px] text-[#5A616E] bg-transparent"
                />
                <span className="text-[#C4C9D2]">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => resetPageAnd(() => setDateTo(e.target.value))}
                  className="border-0 outline-none text-[12.5px] text-[#5A616E] bg-transparent"
                />
              </div>
              <button
                onClick={openExport}
                className="flex items-center gap-1.5 border border-[#D7DAE0] bg-white px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium text-[#5A616E] hover:bg-[#F7F8F9] transition-colors"
              >
                <Download size={13} strokeWidth={2} />
                Exportar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto scroll">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#FAFBFC] border-b border-line-soft">
                  <Th className="pl-5">Sujeto</Th>
                  <Th>RFC</Th>
                  <Th>Teléfono</Th>
                  <Th>Estado</Th>
                  <Th>Fecha</Th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {loading || listLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-[#F0F1F3]">
                      <td colSpan={6} className="px-5 py-3">
                        <div className="h-9 rounded-md bg-[#F1F3F5] animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : profiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-[#9AA1AD]">
                      {q || dateFrom || dateTo
                        ? "No se encontraron expedientes con los filtros aplicados."
                        : "No hay expedientes aún. Inicia una nueva investigación para comenzar."}
                    </td>
                  </tr>
                ) : (
                  profiles.map((p) => (
                    <tr
                      key={p.request_id}
                      onClick={() => navigate(`/perfil/${p.request_id}`)}
                      className="group border-b border-[#F0F1F3] cursor-pointer hover:bg-[#F7F8F9] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="font-semibold text-ink-soft">{inputStr(p.input, "nombre_completo") || "—"}</div>
                        <div className="font-mono text-[11.5px] text-[#9AA1AD] mt-0.5">{inputStr(p.input, "curp") || "—"}</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-[12px] text-[#5A616E]">{inputStr(p.input, "rfc") || "—"}</td>
                      <td className="px-3 py-3 font-mono text-[12px] text-[#5A616E]">{inputStr(p.input, "telefono") || "—"}</td>
                      <td className="px-3 py-3"><StatusBadge status={p.status as ProfileStatus} /></td>
                      <td className="px-3 py-3 text-[#727884] tabular-nums whitespace-nowrap">{formatDate(p.created_at)}</td>
                      <td className="pr-4 pl-1 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => handleDelete(p.request_id, e)}
                          title="Eliminar expediente"
                          className="p-1 rounded-md text-[#C4C9D2] opacity-0 group-hover:opacity-100 hover:text-[#98342F] hover:bg-[#F7ECEA] transition-all align-middle"
                        >
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={15} className="text-[#C4C9D2] inline-block align-middle ml-1" strokeWidth={2} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-[13px] border-t border-line-soft">
              <span className="text-[12.5px] text-[#9AA1AD]">Página {page} de {totalPages}</span>
              <div className="flex items-center gap-[5px]">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || listLoading}
                  className="px-[11px] py-1.5 border border-[#D7DAE0] rounded-[7px] bg-white text-[12.5px] text-[#5A616E] hover:bg-[#F7F8F9] disabled:text-[#B4BAC5] disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                >
                  Anterior
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p2 = start + i;
                  if (p2 > totalPages) return null;
                  return (
                    <button
                      key={p2}
                      onClick={() => setPage(p2)}
                      disabled={listLoading}
                      className={`w-[31px] h-[31px] rounded-[7px] text-[12.5px] font-semibold transition-colors ${
                        p2 === page
                          ? "bg-ink text-white"
                          : "border border-[#D7DAE0] bg-white text-[#5A616E] hover:bg-[#F7F8F9]"
                      }`}
                    >
                      {p2}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || listLoading}
                  className="px-[11px] py-1.5 border border-[#D7DAE0] rounded-[7px] bg-white text-[12.5px] text-[#5A616E] hover:bg-[#F7F8F9] disabled:text-[#B4BAC5] disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filename="expedientes-profilermx"
        columns={EXPORT_COLUMNS}
        rows={exportRows}
        countLabel={`${exportRows.length} expedientes`}
      />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-3 py-2.5 text-[10.5px] font-semibold tracking-[0.06em] uppercase text-[#9AA1AD] ${className}`}>
      {children}
    </th>
  );
}

function MetricTile({
  label,
  value,
  valueSuffix,
  sub,
  subColor = "#727884",
}: {
  label: string;
  value: string;
  valueSuffix?: string;
  sub: string;
  subColor?: string;
}) {
  return (
    <div className="bg-white px-[19px] py-[17px]">
      <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-[#8B929E]">{label}</div>
      <div className="font-serif font-semibold text-[28px] text-ink mt-[9px] tabular-nums">
        {value}
        {valueSuffix && <span className="text-[15px] text-[#9AA1AD]">{valueSuffix}</span>}
      </div>
      <div className="text-[12px] mt-[3px] font-medium" style={{ color: subColor }}>{sub}</div>
    </div>
  );
}
