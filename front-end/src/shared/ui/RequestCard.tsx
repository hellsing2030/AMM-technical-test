import { Link } from "react-router-dom";
import type { PurchaseRequestView } from "../api";
import { formatCurrency, formatDate } from "../format";
import { StatusBadge } from "./StatusBadge";

export function RequestCard({ request }: { request: PurchaseRequestView }) {
  return (
    <article className="request-card">
      <div>
        <div className="request-card__heading">
          <h2>{request.title}</h2>
          <StatusBadge status={request.status} />
        </div>
        <p className="muted">Creada {formatDate(request.createdAt)}</p>
      </div>
      <div className="request-card__footer">
        <strong>{formatCurrency(request.amount)}</strong>
        <Link className="text-link" to={`/requests/${request.id}`}>
          Ver detalle →
        </Link>
      </div>
    </article>
  );
}
