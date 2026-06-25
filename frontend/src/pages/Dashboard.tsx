import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Clock, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { listProfiles, getStats, deleteProfile } from "../lib/api";
import { formatDate } from "../lib/utils";
import ProfileCard from "../components/ProfileCard";
import type { ProfileListItem, StatsResponse } from "../lib/types";

interface Filters {
  date_from: string;
  date_to: string;
}

const EMPTY_FILTERS: Filters = { date_from: "", date_to: "" };

export default function Dashboard() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 10;

  const fetchProfiles = useCallback(
    async (f: Filters, p: number) => {
      setListLoading(true);
      try {
        const res = await listProfiles({
          page: p,
          limit: LIMIT,
          date_from: f.date_from,
          date_to: f.date_to,
        });
        setProfiles(res.items as ProfileListItem[]);
        setTotalPages(res.pages || 1);
        setTotal(res.total || 0);
      } finally {
        setListLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    Promise.all([fetchProfiles(EMPTY_FILTERS, 1), getStats()])
      .then(([, statsRes]) => setStats(statsRes))
      .finally(() => setLoading(false));
  }, [fetchProfiles]);

  function applyFilters() {
    setAppliedFilters(filters);
    setPage(1);
    fetchProfiles(filters, 1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
    fetchProfiles(EMPTY_FILTERS, 1);
  }

  function goToPage(p: number) {
    setPage(p);
    fetchProfiles(appliedFilters, p);
  }

  async function handleDelete(requestId: string) {
    if (!window.confirm("¿Eliminar esta búsqueda?")) return;
    try {
      await deleteProfile(requestId);
      fetchProfiles(appliedFilters, page);
      const newStats = await getStats();
      setStats(newStats);
    } catch {
      alert("Error al eliminar");
    }
  }

  const hasActiveFilters =
    appliedFilters.date_from || appliedFilters.date_to;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panel principal</h1>
          <p className="text-sm text-slate-500 mt-1">{formatDate(new Date().toISOString())}</p>
        </div>
        <button
          onClick={() => navigate("/nueva-busqueda")}
          className="flex items-center gap-2 bg-[#0B2545] hover:bg-[#1a3d74] text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={18} />
          Nueva búsqueda
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <StatCard
          label="Total de búsquedas"
          value={loading ? "—" : String(stats?.total_searches ?? 0)}
          icon={<Users size={20} className="text-[#C9A85C]" />}
        />
        <StatCard
          label="Tiempo promedio de procesamiento"
          value={loading ? "—" : `${((stats?.avg_processing_time_ms ?? 0) / 1000).toFixed(1)}s`}
          icon={<Clock size={20} className="text-[#C9A85C]" />}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-700">
            Búsquedas recientes
            {!listLoading && total > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">{total} resultados</span>
            )}
          </h2>
        </div>

          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 self-center">
                <Filter size={13} />
                Filtrar
              </div>

              {/* Date from */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Desde</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A85C]"
                />
              </div>

              {/* Date to */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Hasta</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A85C]"
                />
              </div>

              <div className="flex items-end gap-2 pb-0.5">
                <button
                  onClick={applyFilters}
                  className="bg-[#0B2545] hover:bg-[#1a3d74] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Buscar
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X size={13} />
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
                {appliedFilters.date_from && (
                  <span className="inline-flex items-center gap-1 text-xs bg-[#0B2545]/10 text-[#0B2545] px-2 py-0.5 rounded-full">
                    Desde: {appliedFilters.date_from}
                  </span>
                )}
                {appliedFilters.date_to && (
                  <span className="inline-flex items-center gap-1 text-xs bg-[#0B2545]/10 text-[#0B2545] px-2 py-0.5 rounded-full">
                    Hasta: {appliedFilters.date_to}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Profile list */}
          {loading || listLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-200 animate-pulse" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              {hasActiveFilters
                ? "No se encontraron perfiles con los filtros aplicados."
                : "No hay búsquedas aún. Inicia una nueva búsqueda para comenzar."}
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.map((p) => (
                <ProfileCard key={p.request_id} profile={p} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-slate-500">
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || listLoading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                  Anterior
                </button>
                {/* Page number buttons (show up to 5 pages around current) */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p2 = start + i;
                  if (p2 > totalPages) return null;
                  return (
                    <button
                      key={p2}
                      onClick={() => goToPage(p2)}
                      disabled={listLoading}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        p2 === page
                          ? "bg-[#0B2545] text-white"
                          : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p2}
                    </button>
                  );
                })}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || listLoading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex items-center gap-4 ${
        highlight
          ? "bg-[#0B2545] border-[#0B2545] text-white"
          : "bg-white border-slate-200 text-slate-800"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          highlight ? "bg-white/10" : "bg-[#0B2545]/10"
        }`}
      >
        {icon}
      </div>
      <div>
        <div className={`text-2xl font-bold ${highlight ? "text-white" : "text-slate-900"}`}>
          {value}
        </div>
        <div className={`text-sm mt-0.5 ${highlight ? "text-slate-300" : "text-slate-500"}`}>
          {label}
        </div>
      </div>
    </div>
  );
}
