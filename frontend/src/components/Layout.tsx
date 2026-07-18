import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutGrid, Search, Shield, LogOut } from "lucide-react";
import { cn } from "../lib/utils";
import { clearToken } from "../lib/auth";

export default function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-[246px] flex-shrink-0 bg-ink text-[#C9CCD2] flex flex-col sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 pt-[22px] pb-[18px] border-b border-white/[0.06] flex items-center gap-[11px]">
          <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
            <Shield size={17} className="text-white" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <div className="font-serif font-semibold text-base tracking-[0.01em] text-white">
              ProfilerMX
            </div>
            <div className="text-[10.5px] text-[#7C818C] tracking-[0.02em]">
              Investigación de deudores
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          <div className="text-[10px] font-semibold tracking-[0.11em] uppercase text-[#61666F] px-3 pt-1.5 pb-1.5">
            Operación
          </div>
          <NavItem to="/dashboard" icon={<LayoutGrid size={16} strokeWidth={1.8} />} label="Expedientes" />
          <NavItem to="/nueva-busqueda" icon={<Search size={16} strokeWidth={1.8} />} label="Nueva investigación" />
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-2.5 py-[7px]">
            <div className="w-[31px] h-[31px] rounded-md bg-[#2A2E36] flex items-center justify-center font-mono font-medium text-xs text-[#A7ACB6]">
              OP
            </div>
            <div className="leading-[1.25] min-w-0">
              <div className="text-[12.5px] font-semibold text-[#DADCE0] truncate">Operador OP-001</div>
              <div className="text-[10.5px] text-[#71767F]">Sesión activa</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-[11px] w-full px-2.5 py-2 mt-[3px] rounded-[7px] text-[12.5px] font-medium text-[#8B909A] hover:bg-white/[0.05] hover:text-[#EDEEF0] transition-colors"
          >
            <LogOut size={15} strokeWidth={1.8} />
            Cerrar sesión
          </button>
          <div className="px-2.5 pt-2 pb-0.5 text-[10px] text-[#54595F] tracking-[0.02em]">
            v2.0 · EasyDevs
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 h-screen overflow-auto scroll">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-[11px] w-full px-3 py-[9px] rounded-[7px] text-[13px] font-medium transition-colors",
          isActive
            ? "bg-white/[0.07] text-white shadow-[inset_2px_0_0_#34506B]"
            : "text-[#9096A0] hover:bg-white/[0.05] hover:text-[#EDEEF0]"
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
