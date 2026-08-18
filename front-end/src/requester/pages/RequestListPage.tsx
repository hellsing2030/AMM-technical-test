import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, getErrorMessage, type PurchaseRequestView } from "../../shared/api";
import { Alert, EmptyState, Loading } from "../../shared/ui/Feedback";
import { RequestCard } from "../../shared/ui/RequestCard";

export function RequestListPage() {
  const [requests, setRequests] = useState<PurchaseRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .listRequests()
      .then(setRequests)
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Consultando solicitudes…" />;

  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">Área del solicitante</p>
          <h1>Solicitudes de compra</h1>
          <p className="muted">Consulta el avance de cada aprobación y su evidencia.</p>
        </div>
        <Link className="button" to="/requests/new">Crear solicitud</Link>
      </header>

      {error && <Alert>{error}</Alert>}
      {!error && requests.length === 0 ? (
        <EmptyState title="Todavía no hay solicitudes">
          Crea la primera solicitud para iniciar el circuito de aprobación.
        </EmptyState>
      ) : (
        <div className="request-list">
          {requests.map((request) => <RequestCard key={request.id} request={request} />)}
        </div>
      )}
    </section>
  );
}
