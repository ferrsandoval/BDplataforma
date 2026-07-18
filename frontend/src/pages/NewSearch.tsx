import { ChevronLeft, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SearchForm from "../components/SearchForm";

export default function NewSearch() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-[5] border-b border-line px-[34px] py-[18px] flex items-center gap-3.5 backdrop-blur-md"
        style={{ background: "rgba(243,244,246,.9)" }}
      >
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 border border-[#D7DAE0] bg-white px-3 py-[7px] rounded-[7px] text-[12.5px] font-medium text-[#5A616E] hover:bg-[#F7F8F9] transition-colors"
        >
          <ChevronLeft size={15} strokeWidth={2} />
          Expedientes
        </button>
        <div>
          <h1 className="font-serif font-semibold text-[22px] text-ink m-0">Nueva investigación</h1>
          <p className="mt-1 text-[12.5px] text-[#727884]">
            Ingresa los datos del sujeto para iniciar la investigación de deudor.
          </p>
        </div>
      </header>

      <div className="px-[34px] pt-[26px] pb-12 max-w-[720px]">
        <div className="bg-white rounded-[10px] border border-line overflow-hidden">
          <div className="px-[22px] py-[15px] border-b border-line-soft">
            <h2 className="font-serif font-semibold text-[15px] text-ink m-0">Datos del sujeto</h2>
            <p className="text-[12px] text-[#8B929E] mt-0.5">
              Ingresa al menos un dato. El titular ha otorgado consentimiento informado previo.
            </p>
          </div>
          <div className="px-[22px] py-[22px]">
            <SearchForm />
          </div>
        </div>

        {/* Confidential / privacy notice */}
        <div
          className="mt-4 rounded-[10px] px-[18px] py-[15px]"
          style={{ background: "#FAFAF7", border: "1px solid #E7E3D6" }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lock size={14} style={{ color: "#9A7B2E" }} strokeWidth={2} />
            <span className="text-[10.5px] font-semibold tracking-[0.05em] uppercase" style={{ color: "#8A6E28" }}>
              Aviso de privacidad
            </span>
          </div>
          <p className="m-0 text-[12px] leading-[1.55]" style={{ color: "#7A6A3E" }}>
            El uso de esta plataforma está restringido a operadores autorizados. La consulta de datos
            personales requiere consentimiento escrito previo del titular, registrado en el sistema
            externo de consentimientos.
          </p>
        </div>
      </div>
    </div>
  );
}
