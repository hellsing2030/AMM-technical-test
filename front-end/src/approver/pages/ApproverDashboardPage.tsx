import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, getErrorMessage, type MockMail } from "../../shared/api";
import { getDemoSession } from "../../shared/auth/demo-session";
import { formatDate } from "../../shared/format";
import { Alert, EmptyState, Loading } from "../../shared/ui/Feedback";

export function ApproverDashboardPage() {
  const session = getDemoSession();
  const [mails, setMails] = useState<MockMail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setMails(await apiClient.listMockMail());
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const ownMails = useMemo(
    () => mails.filter((mail) => mail.to.toLowerCase() === session?.user.email.toLowerCase()),
    [mails, session?.user.email],
  );
  const invitations = ownMails.filter((mail) => mail.type === "INVITATION");
  const otpMails = ownMails.filter((mail) => mail.type === "OTP");

  if (loading) return <Loading label="Consultando aprobaciones asignadas…" />;

  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">Área del aprobador</p>
          <h1>Mis aprobaciones</h1>
          <p className="muted">
            {session?.user.name} · {session?.user.role}. Abre una invitación para solicitar el OTP y decidir.
          </p>
        </div>
        <button className="button button--secondary" type="button" onClick={() => void load()}>
          Actualizar bandeja
        </button>
      </header>

      <Alert kind="info">
        Esta bandeja usa el correo simulado del ejercicio. En producción se alimentaría desde una
        consulta autenticada por usuario y las notificaciones se enviarían con SES.
      </Alert>
      {error && <Alert>{error}</Alert>}

      {!error && invitations.length === 0 ? (
        <EmptyState title="No tienes aprobaciones asignadas">
          El solicitante debe crear una compra seleccionando tu nombre y rol.
        </EmptyState>
      ) : (
        <div className="approval-inbox-grid">
          <div>
            <h2>Solicitudes asignadas</h2>
            <div className="mail-list">
              {invitations.map((mail) => (
                <article className="mail-card" key={mail.id}>
                  <div className="mail-card__header">
                    <div>
                      <p className="eyebrow">Pendiente de revisión</p>
                      <h3>{mail.subject}</h3>
                    </div>
                    <small className="muted">{formatDate(mail.sentAt)}</small>
                  </div>
                  <p className="muted">{mail.body}</p>
                  {mail.link && (
                    <a className="button" href={mail.link}>Abrir aprobación</a>
                  )}
                </article>
              ))}
            </div>
          </div>

          <aside>
            <h2>Códigos recientes</h2>
            {otpMails.length === 0 ? (
              <p className="muted">Cuando solicites un OTP aparecerá aquí.</p>
            ) : (
              <div className="mail-list">
                {otpMails.map((mail) => (
                  <article className="mail-card" key={mail.id}>
                    <p className="eyebrow">OTP · {formatDate(mail.sentAt)}</p>
                    <p className="muted">Válido durante tres minutos.</p>
                    {mail.otp && <code className="mail-code">{mail.otp}</code>}
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
