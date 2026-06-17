import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import NewSearch from "./pages/NewSearch";
import Profile from "./pages/Profile";
import ExampleProfile from "./pages/ExampleProfile";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
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
