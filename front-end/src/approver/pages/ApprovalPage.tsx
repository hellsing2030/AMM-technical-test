import { type FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  apiClient,
  getErrorMessage,
  type ApprovalAccess,
  type Decision,
  type PurchaseRequestView,
} from "../../shared/api";
import { formatCurrency, formatDate } from "../../shared/format";
import { Alert } from "../../shared/ui/Feedback";
import { StatusBadge } from "../../shared/ui/StatusBadge";

type Step = "INTRO" | "OTP" | "DETAIL" | "DONE";

export function ApprovalPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [step, setStep] = useState<Step>("INTRO");
  const [otp, setOtp] = useState("");
  const [access, setAccess] = useState<ApprovalAccess>();
  const [result, setResult] = useState<PurchaseRequestView>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ownApproval = useMemo(
    () => access?.request.approvals.find((approval) => approval.id === access.approvalId),
    [access],
  );

  async function requestOtp() {
    setLoading(true);
    setError("");
    try {
      await apiClient.requestOtp(token);
      setOtp("");
      setStep("OTP");
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  async function validateOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError("Ingresa un código de seis dígitos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const validatedAccess = await apiClient.validateOtp(token, otp);
      setAccess(validatedAccess);
      setStep("DETAIL");
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  async function decide(decision: Decision) {
    if (!access) return;
    setLoading(true);
    setError("");
    try {
      setResult(await apiClient.submitDecision(access.sessionId, decision));
      setStep("DONE");
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <section className="otp-layout panel">
        <p className="eyebrow">Enlace inválido</p>
        <h1>Falta el token de aprobación</h1>
        <p className="muted">Abre el enlace completo recibido por correo. El detalle de la compra permanece protegido.</p>
        <Link className="button button--secondary" to="/mock-mail">Ir al correo simulado</Link>
      </section>
    );
  }

  return (
    <section className="otp-layout">
      <header className="page-header">
        <div>
          <p className="eyebrow">Área del aprobador</p>
          <h1>Decisión de compra</h1>
          <p className="muted">Verifica tu identidad antes de consultar los detalles.</p>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}

      {step === "INTRO" && (
        <article className="panel">
          <h2>Solicita tu código de seguridad</h2>
          <p className="muted">Enviaremos un OTP al correo asociado con este enlace. Será válido durante tres minutos.</p>
          <button className="button" type="button" disabled={loading} onClick={() => void requestOtp()}>
            {loading ? "Enviando…" : "Solicitar OTP"}
          </button>
        </article>
      )}

      {step === "OTP" && (
        <form className="panel" onSubmit={validateOtp}>
          <h2>Ingresa el código OTP</h2>
          <p className="muted">En modo demostración puedes consultarlo en el correo simulado.</p>
          <div className="field">
            <label htmlFor="otp">Código de seis dígitos</label>
            <input id="otp" className="otp-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
          </div>
          <div className="button-row" style={{ marginTop: 20 }}>
            <button className="button" type="submit" disabled={loading || otp.length !== 6}>{loading ? "Validando…" : "Validar y ver detalle"}</button>
            <button className="button button--secondary" type="button" disabled={loading} onClick={() => void requestOtp()}>Reenviar OTP</button>
            <Link className="text-link" to="/approvals" target="_blank" rel="noreferrer">Ver OTP en mi bandeja</Link>
          </div>
        </form>
      )}

      {step === "DETAIL" && access && ownApproval && (
        <article className="panel">
          <Alert kind="success">Identidad validada. Esta sesión vence {formatDate(access.expiresAt)}.</Alert>
          <div className="request-card__heading">
            <div>
              <p className="eyebrow">{ownApproval.role}</p>
              <h2>{access.request.title}</h2>
            </div>
            <StatusBadge status={access.request.status} />
          </div>
          <div className="detail-list">
            <div className="detail-item"><span>Monto</span><strong>{formatCurrency(access.request.amount)}</strong></div>
            <div className="detail-item"><span>Solicitante</span><strong>{access.request.requesterName}</strong></div>
            <div className="detail-item field--full"><span>Descripción</span><p>{access.request.description}</p></div>
          </div>
          <div className="decision-card">
            <h3>Registra tu decisión</h3>
            <p className="muted">La decisión no podrá modificarse después de enviarla.</p>
            <div className="button-row">
              <button className="button" type="button" disabled={loading} onClick={() => void decide("APPROVE")}>{loading ? "Procesando…" : "Aprobar compra"}</button>
              <button className="button button--danger" type="button" disabled={loading} onClick={() => void decide("REJECT")}>Rechazar compra</button>
            </div>
          </div>
        </article>
      )}

      {step === "DONE" && result && (
        <article className="panel">
          <Alert kind="success">Tu decisión fue registrada correctamente.</Alert>
          <h2>Proceso actualizado</h2>
          <p>Estado de la solicitud: <StatusBadge status={result.status} /></p>
          <p className="muted">Ya puedes cerrar esta ventana. El solicitante verá el cambio en su panel.</p>
        </article>
      )}
    </section>
  );
}
