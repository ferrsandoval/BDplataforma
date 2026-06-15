import { Outlet, NavLink } from "react-router-dom";
import { LayoutDashboard, Search, ShieldCheck } from "lucide-react";
import { cn } from "../lib/utils";

export default function Layout() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#0B2545] text-white flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-navy-800 flex items-center gap-3">
          <ShieldCheck className="text-[#C9A85C]" size={28} />
          <div>
            <div className="font-bold text-lg leading-tight">ProfilerMX</div>
            <div className="text-xs text-slate-400">Motor de Enriquecimiento</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem to="/dashboard" icon={<LayoutDashboard size={18} />} label="Panel principal" />
          <NavItem to="/nueva-busqueda" icon={<Search size={18} />} label="Nueva búsqueda" />
        </nav>

        <div className="px-6 py-4 border-t border-navy-800 text-xs text-slate-400">
          v1.0.0 — EasyDevs
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
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
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-[#C9A85C]/20 text-[#C9A85C]"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
