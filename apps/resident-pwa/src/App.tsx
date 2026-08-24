import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Login from "./pages/Login";
import Approvals from "./pages/Approvals";
import Invite from "./pages/Invite";
import Inbox from "./pages/Inbox";

function Shell() {
  const { me } = useAuth();
  if (!me) return <Login />;
  return (
    <div style={{ paddingBottom: 70 }}>
      <h1 style={{ fontSize: "1.05rem", opacity: 0.8 }}>Hi, {me.fullName || "neighbour"} 👋</h1>
      <Routes>
        <Route path="/" element={<Approvals />} />
        <Route path="/invite" element={<Invite />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <nav className="nav">
        <NavLink to="/" end>Approvals</NavLink>
        <NavLink to="/invite">Invite</NavLink>
        <NavLink to="/inbox">Inbox</NavLink>
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
