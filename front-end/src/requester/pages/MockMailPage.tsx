import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, getErrorMessage, type MockMail } from "../../shared/api";
import { formatDate } from "../../shared/format";
import { Alert, EmptyState, Loading } from "../../shared/ui/Feedback";

export function MockMailPage() {
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
  if (loading) return <Loading label="Abriendo buzón…" />;

  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">Herramienta de demostración</p>
          <h1>Correo simulado</h1>
          <p className="muted">Aquí aparecen los enlaces de aprobación y los códigos OTP.</p>
        </div>
        <button className="button button--secondary" type="button" onClick={() => void load()}>Actualizar</button>
      </header>

      {error && <Alert>{error}</Alert>}
      {!error && mails.length === 0 ? (
        <EmptyState title="El buzón está vacío">Crea una solicitud para generar las invitaciones.</EmptyState>
      ) : (
        <div className="mail-list">
          {mails.map((mail) => (
            <article className="mail-card" key={mail.id}>
              <div className="mail-card__header">
                <div>
                  <p className="eyebrow">{mail.type === "OTP" ? "Código OTP" : "Invitación"}</p>
                  <h2>{mail.subject}</h2>
                </div>
                <small className="muted">{formatDate(mail.sentAt)}</small>
              </div>
              <p><strong>Para:</strong> {mail.to}</p>
              <p className="muted">{mail.body}</p>
              {mail.otp && <code className="mail-code">{mail.otp}</code>}
              {mail.link && <p><Link className="button" to={mail.link}>Abrir solicitud</Link></p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
