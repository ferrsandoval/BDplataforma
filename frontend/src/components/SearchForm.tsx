import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, CheckCircle, XCircle } from "lucide-react";
import { submitEnrichment } from "../lib/api";
import axios from "axios";
import { cn } from "../lib/utils";

interface FormState {
  nombre_completo: string;
  curp: string;
  rfc: string;
  telefono: string;
  operador_id: string;
}

const EMPTY: FormState = {
  nombre_completo: "",
  curp: "",
  rfc: "",
  telefono: "",
  operador_id: "OP-001",
};

interface CurpValidation {
  valid: boolean;
  errors: string[];
  data?: {
    fecha_nacimiento: string;
    edad_estimada: number;
    sexo: string;
    estado_nacimiento: string;
  };
}

function hasAtLeastOne(form: FormState): boolean {
  return !!(form.nombre_completo || form.curp || form.rfc || form.telefono);
}

function formatRfc(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9&]/g, "").slice(0, 13);
}

function formatCurp(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 18);
}

function formatPhone(v: string) {
  return v.replace(/[^0-9+\-\s()]/g, "").slice(0, 15);
}

export default function SearchForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curpVal, setCurpVal] = useState<CurpValidation | null>(null);
  const [curpChecking, setCurpChecking] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      let formatted = value;
      if (name === "curp") formatted = formatCurp(value);
      if (name === "rfc") formatted = formatRfc(value);
      if (name === "telefono") formatted = formatPhone(value);

      setForm((f) => ({ ...f, [name]: formatted }));
      if (error) setError(null);

      if (name === "curp") {
        setCurpVal(null);
        if (formatted.length === 18) {
          setCurpChecking(true);
          axios
            .get(`/api/curp/validate/${formatted}`)
            .then((r) => setCurpVal(r.data))
            .catch(() => setCurpVal(null))
            .finally(() => setCurpChecking(false));
        }
      }
    },
    [error]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasAtLeastOne(form)) {
      setError("Ingresa al menos un dato para iniciar la búsqueda.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await submitEnrichment(form);
      navigate(`/perfil/${res.request_id}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al iniciar la búsqueda. Intente de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = hasAtLeastOne(form) && !loading;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-xs text-slate-500">
        Ingresa al menos uno de los siguientes datos — entre más datos, mejores resultados.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Nombre completo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Nombre completo
          </label>
          <input
            name="nombre_completo"
            value={form.nombre_completo}
            onChange={handleChange}
            placeholder="Ej. Juan García López"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A85C] focus:border-transparent placeholder:text-slate-400"
          />
        </div>

        {/* CURP con validación inline */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">CURP</label>
          <div className="relative">
            <input
              name="curp"
              value={form.curp}
              onChange={handleChange}
              placeholder="18 caracteres"
              maxLength={18}
              className={cn(
                "w-full rounded-lg border px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#C9A85C] focus:border-transparent placeholder:text-slate-400 placeholder:font-sans",
                curpVal?.valid === true && "border-green-400 bg-green-50",
                curpVal?.valid === false && "border-red-400 bg-red-50",
                !curpVal && "border-slate-300"
              )}
            />
            {curpChecking && (
              <Loader2 size={14} className="absolute right-3 top-3 animate-spin text-slate-400" />
            )}
            {curpVal?.valid === true && !curpChecking && (
              <CheckCircle size={14} className="absolute right-3 top-3 text-green-500" />
            )}
            {curpVal?.valid === false && !curpChecking && (
              <XCircle size={14} className="absolute right-3 top-3 text-red-500" />
            )}
          </div>
          {curpVal?.valid === true && curpVal.data && (
            <p className="text-xs text-green-700 mt-1">
              {curpVal.data.sexo} · Nac. {curpVal.data.fecha_nacimiento} · {curpVal.data.estado_nacimiento}
            </p>
          )}
          {curpVal?.valid === false && (
            <p className="text-xs text-red-600 mt-1">{curpVal.errors[0]}</p>
          )}
        </div>

        {/* RFC */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">RFC</label>
          <input
            name="rfc"
            value={form.rfc}
            onChange={handleChange}
            placeholder="12 o 13 caracteres"
            maxLength={13}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#C9A85C] focus:border-transparent placeholder:text-slate-400 placeholder:font-sans"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Teléfono</label>
          <input
            name="telefono"
            value={form.telefono}
            onChange={handleChange}
            placeholder="10 dígitos"
            type="tel"
            maxLength={15}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A85C] focus:border-transparent placeholder:text-slate-400"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 bg-[#0B2545] hover:bg-[#1a3d74] text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Iniciando búsqueda…
          </>
        ) : (
          <>
            <Search size={18} />
            Iniciar búsqueda
          </>
        )}
      </button>
    </form>
  );
}
