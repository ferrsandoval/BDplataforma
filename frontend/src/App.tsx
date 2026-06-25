import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { isAuthenticated } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewSearch from "./pages/NewSearch";
import Profile from "./pages/Profile";
import ExampleProfile from "./pages/ExampleProfile";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/nueva-busqueda" element={<NewSearch />} />
          <Route path="/perfil/:requestId" element={<Profile />} />
          <Route path="/ejemplo" element={<ExampleProfile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
