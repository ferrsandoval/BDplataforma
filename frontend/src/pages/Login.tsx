import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { login } from "../lib/api";
import { setToken } from "../lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = await login(username, password);
      setToken(token);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Usuario o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mb-4">
            <Shield size={28} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-white tracking-[0.01em]">ProfilerMX</h1>
          <p className="text-[13px] text-[#7C818C] mt-1">Investigación de deudores</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] p-6 space-y-4">
          <div>
            <label htmlFor="username" className="block text-[13px] font-medium text-[#3A404D] mb-1.5">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-[#D7DAE0] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="Ingresa tu usuario"
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[13px] font-medium text-[#3A404D] mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-[#D7DAE0] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="Ingresa tu contraseña"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-[#98342F] bg-[#F7ECEA] border border-[#E6C6C2] px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-ink text-white text-sm font-semibold rounded-lg hover:bg-[#2A2E36] transition-colors disabled:opacity-50"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="text-center text-[11px] text-[#54595F] mt-6 tracking-[0.02em]">v2.0 · EasyDevs</p>
      </div>
    </div>
  );
}
