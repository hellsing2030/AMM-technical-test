import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient, getErrorMessage, type User } from "../shared/api";
import {
  DEMO_REQUESTER,
  homeFor,
  saveDemoSession,
  type DemoSession,
} from "../shared/auth/demo-session";
import { Alert, Loading } from "../shared/ui/Feedback";

interface LoginPageProps {
  onLogin(session: DemoSession): void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [approvers, setApprovers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .listApprovers()
      .then(setApprovers)
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  const users = useMemo(() => [DEMO_REQUESTER, ...approvers], [approvers]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = users.find((candidate) => candidate.id === selectedId);
    if (!user) {
      setError("Selecciona una persona para continuar.");
      return;
    }

    const session: DemoSession = {
      actorType: user.id === DEMO_REQUESTER.id ? "REQUESTER" : "APPROVER",
      user,
    };
    saveDemoSession(session);
    onLogin(session);

    const requestedPath = searchParams.get("returnTo");
    const safeReturn = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : null;
    navigate(safeReturn ?? homeFor(session), { replace: true });
  }

  if (loading) return <Loading label="Preparando acceso por roles…" />;

  return (
    <section className="login-layout">
      <div className="login-copy">
        <p className="eyebrow">Acceso por responsabilidades</p>
        <h1>Ingresa al flujo que te corresponde</h1>
        <p className="muted">
          El solicitante administra compras. Cada aprobador consulta únicamente su bandeja y
          confirma las decisiones mediante OTP.
        </p>
      </div>

      <form className="panel login-card" onSubmit={submit}>
        <h2>Selecciona tu usuario</h2>
        <p className="muted">
          Acceso demostrativo por nombre. La autenticación productiva se reemplazará por Cognito o SSO.
        </p>
        {error && <Alert>{error}</Alert>}
        <div className="field">
          <label htmlFor="demo-user">Nombre y responsabilidad</label>
          <select
            id="demo-user"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            required
          >
            <option value="">Selecciona una persona</option>
            <optgroup label="Solicitante">
              <option value={DEMO_REQUESTER.id}>{DEMO_REQUESTER.name} — Solicitante</option>
            </optgroup>
            <optgroup label="Aprobadores">
              {approvers.map((user) => (
                <option key={user.id} value={user.id}>{user.name} — {user.role}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <button className="button" type="submit" disabled={!selectedId}>Ingresar</button>
      </form>
    </section>
  );
}
