import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { apiClient, getErrorMessage, type PurchaseRequestView } from "../../shared/api";
import { formatCurrency, formatDate } from "../../shared/format";
import { Alert, Loading } from "../../shared/ui/Feedback";
import { StatusBadge } from "../../shared/ui/StatusBadge";

export function RequestDetailPage() {
  const { requestId = "" } = useParams();
  const location = useLocation();
  const [request, setRequest] = useState<PurchaseRequestView>();
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiClient
      .getRequest(requestId)
      .then(setRequest)
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [requestId]);

  async function downloadEvidence() {
    if (!request) return;
    setDownloading(true);
    setError("");
    try {
      const download = await apiClient.downloadEvidence(request.id);
      const url = download.kind === "blob" ? URL.createObjectURL(download.blob) : download.url;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = download.fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      if (download.kind === "blob") URL.revokeObjectURL(url);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setDownloading(false);
    }
  }

  if (!request && !error) return <Loading label="Consultando detalle…" />;

  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">Detalle de solicitud</p>
          <h1>{request?.title || "Solicitud"}</h1>
        </div>
        <Link className="text-link" to="/requests">← Volver al listado</Link>
      </header>

      {Boolean((location.state as { created?: boolean } | null)?.created) && (
        <Alert kind="success">Solicitud creada. Los tres enlaces ya están disponibles en el correo simulado.</Alert>
      )}
      {error && <Alert>{error}</Alert>}

      {request && (
        <div className="detail-grid">
          <article className="panel">
            <div className="request-card__heading">
              <div>
                <p className="muted">Estado general</p>
                <StatusBadge status={request.status} />
              </div>
              <strong>{formatCurrency(request.amount)}</strong>
            </div>
            <div className="detail-list">
              <div className="detail-item"><span>Solicitante</span><strong>{request.requesterName}</strong></div>
              <div className="detail-item"><span>Creación</span><strong>{formatDate(request.createdAt)}</strong></div>
              <div className="detail-item field--full"><span>Descripción</span><p>{request.description}</p></div>
              {request.completedAt && <div className="detail-item"><span>Finalización</span><strong>{formatDate(request.completedAt)}</strong></div>}
              {request.rejectedAt && <div className="detail-item"><span>Rechazo</span><strong>{formatDate(request.rejectedAt)}</strong></div>}
            </div>
            {request.status === "COMPLETED" && (
              <button className="button" type="button" onClick={downloadEvidence} disabled={downloading}>
                {downloading ? "Descargando…" : "Descargar evidencia PDF"}
              </button>
            )}
          </article>

          <aside>
            <h2>Aprobaciones</h2>
            <div className="approval-list">
              {request.approvals.map((approval) => (
                <article className="approval-card" key={approval.id}>
                  <div className="approval-card__top">
                    <div>
                      <h3>{approval.approverName}</h3>
                      <p className="muted">{approval.role}</p>
                    </div>
                    <StatusBadge status={approval.status} />
                  </div>
                  <small className="muted">
                    {approval.decisionAt ? `Decisión: ${formatDate(approval.decisionAt)}` : approval.cancelledAt ? `Cancelada: ${formatDate(approval.cancelledAt)}` : "Sin decisión"}
                  </small>
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
