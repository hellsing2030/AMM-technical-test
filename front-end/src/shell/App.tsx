import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  clearDemoSession,
  getDemoSession,
  homeFor,
  type ActorType,
  type DemoSession,
} from "../shared/auth/demo-session";
import { Loading } from "../shared/ui/Feedback";
import { LoginPage } from "./LoginPage";

const RequesterRoutes = lazy(() => import("requesterApp/RequesterRoutes"));
const ApproverRoutes = lazy(() => import("approverApp/ApproverRoutes"));

export function App() {
  const navigate = useNavigate();
  const [session, setSession] = useState<DemoSession | null>(() => getDemoSession());
  const isMock = typeof __APP_API_MODE__ === "undefined" || __APP_API_MODE__ === "mock";

  function logout() {
    clearDemoSession();
    setSession(null);
    navigate("/login", { replace: true });
  }

  const home = session ? homeFor(session) : "/login";

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to={home}>
          <span className="brand__mark">A</span>
          <span>AMM Compras</span>
        </Link>
        <nav aria-label="Navegación principal">
          {session?.actorType === "REQUESTER" && (
            <>
              <NavLink to="/requests">Solicitudes</NavLink>
              <NavLink to="/requests/new">Nueva solicitud</NavLink>
              {isMock && <NavLink to="/mock-mail">Correo simulado</NavLink>}
            </>
          )}
          {session?.actorType === "APPROVER" && <NavLink to="/approvals">Mis aprobaciones</NavLink>}
          {session && (
            <div className="identity-menu">
              <span><strong>{session.user.name}</strong><small>{session.actorType === "REQUESTER" ? "Solicitante" : session.user.role}</small></span>
              <button type="button" onClick={logout}>Salir</button>
            </div>
          )}
        </nav>
      </header>

      {session && (
        <div className="demo-banner">
          Acceso demostrativo por nombre activo.
          {isMock ? " Los datos permanecen únicamente en este navegador." : " Los datos operativos provienen de AWS."}
        </div>
      )}

      <main className="main-content">
        <Suspense fallback={<Loading label="Cargando módulo…" />}>
          <Routes>
            <Route path="/" element={<Navigate replace to={home} />} />
            <Route path="/login" element={session ? <Navigate replace to={home} /> : <LoginPage onLogin={setSession} />} />
            <Route path="/requests/*" element={<RoleRoute session={session} role="REQUESTER"><RequesterRoutes /></RoleRoute>} />
            <Route path="/mock-mail" element={<RoleRoute session={session} role="REQUESTER"><RequesterRoutes /></RoleRoute>} />
            <Route path="/approvals/*" element={<RoleRoute session={session} role="APPROVER"><ApproverRoutes /></RoleRoute>} />
            <Route path="/approve/*" element={<RoleRoute session={session} role="APPROVER"><ApproverRoutes /></RoleRoute>} />
            <Route path="*" element={session ? <NotFound home={home} /> : <Navigate replace to="/login" />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function RoleRoute({ children, role, session }: { children: ReactNode; role: ActorType; session: DemoSession | null }) {
  const location = useLocation();
  if (!session) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate replace to={`/login?returnTo=${encodeURIComponent(returnTo)}`} />;
  }
  if (session.actorType !== role) return <Navigate replace to={homeFor(session)} />;
  return children;
}

function NotFound({ home }: { home: string }) {
  return (
    <section className="empty-state">
      <p className="eyebrow">Error 404</p>
      <h1>Página no encontrada</h1>
      <Link className="button" to={home}>Volver al panel</Link>
    </section>
  );
}
