import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Login from "./pages/Login";
import Home from "./pages/Home";
import SpotRequest from "./pages/SpotRequest";
import CheckInOut from "./pages/CheckInOut";

function Shell() {
  const { me } = useAuth();
  if (!me) return <Login />;
  return (
    <div style={{ paddingBottom: 64 }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/entry" element={<CheckInOut />} />
        <Route path="/spot" element={<SpotRequest />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <nav className="nav">
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/entry">Entry/Exit</NavLink>
        <NavLink to="/spot">Spot Visitor</NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AuthProvider>
  );
}
