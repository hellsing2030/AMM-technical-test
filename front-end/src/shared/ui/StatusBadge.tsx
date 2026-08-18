import type { ApprovalStatus, RequestStatus } from "../api";

const STATUS_LABELS: Record<ApprovalStatus | RequestStatus, string> = {
  PENDING: "Pendiente",
  SIGNED: "Aprobada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  GENERATING_EVIDENCE: "Generando evidencia",
  COMPLETED: "Completada",
};

export function StatusBadge({ status }: { status: ApprovalStatus | RequestStatus }) {
  return <span className={`status status--${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}
