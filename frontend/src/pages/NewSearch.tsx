import SearchForm from "../components/SearchForm";

export default function NewSearch() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Nueva búsqueda</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ingresa los datos del sujeto para iniciar el proceso de enriquecimiento.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="mb-5 pb-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Datos del sujeto
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Todos los campos son obligatorios. El titular ha otorgado consentimiento informado previo.
          </p>
        </div>
        <SearchForm />
      </div>

      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
        <strong>Aviso de privacidad:</strong> El uso de esta plataforma está restringido a operadores
        autorizados. La consulta de datos personales requiere consentimiento escrito previo del titular,
        el cual debe estar registrado en el sistema externo de consentimientos.
      </div>
    </div>
  );
}
