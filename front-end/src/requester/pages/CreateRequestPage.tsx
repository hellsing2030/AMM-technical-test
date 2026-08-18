import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  apiClient,
  getErrorMessage,
  type CreatePurchaseRequestInput,
  type User,
} from "../../shared/api";
import { DEMO_REQUESTER } from "../../shared/auth/demo-session";
import { Alert, Loading } from "../../shared/ui/Feedback";

export function CreateRequestPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedIds, setSelectedIds] = useState(["", "", ""]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .listApprovers()
      .then(setUsers)
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoadingUsers(false));
  }, []);

  const selectionError = useMemo(() => {
    if (selectedIds.some((id) => !id)) return "Selecciona exactamente tres aprobadores.";
    if (new Set(selectedIds).size !== 3) return "Los tres aprobadores deben ser personas diferentes.";
    const roles = selectedIds.map((id) => users.find((user) => user.id === id)?.role);
    if (roles.some((role) => !role) || new Set(roles).size !== 3) {
      return "Los tres aprobadores deben tener roles diferentes.";
    }
    return "";
  }, [selectedIds, users]);

  function updateApprover(index: number, userId: string) {
    setSelectedIds((current) => current.map((id, position) => (position === index ? userId : id)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!title.trim() || !description.trim()) {
      setError("Título y descripción son obligatorios.");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("El monto debe ser mayor que cero.");
      return;
    }
    if (selectionError) {
      setError(selectionError);
      return;
    }

    const selectedUsers = selectedIds.map((id) => users.find((user) => user.id === id));
    if (selectedUsers.some((user) => !user)) {
      setError("No fue posible resolver los aprobadores seleccionados.");
      return;
    }

    const input: CreatePurchaseRequestInput = {
      requesterId: DEMO_REQUESTER.id,
      requesterIdentity: DEMO_REQUESTER.identity,
      requesterName: DEMO_REQUESTER.name,
      requesterEmail: DEMO_REQUESTER.email,
      title,
      description,
      amount: numericAmount,
      approvers: selectedUsers.map((user) => ({
        approverId: user!.id,
        approverIdentity: user!.identity,
        approverName: user!.name,
        approverEmail: user!.email,
        role: user!.role,
      })),
    };

    setSubmitting(true);
    try {
      const request = await apiClient.createRequest(input);
      navigate(`/requests/${request.id}`, { state: { created: true } });
    } catch (reason) {
      setError(getErrorMessage(reason));
      setSubmitting(false);
    }
  }

  if (loadingUsers) return <Loading label="Cargando aprobadores…" />;

  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">Nueva solicitud</p>
          <h1>Solicitar una compra</h1>
          <p className="muted">La compra requerirá la decisión de tres roles diferentes.</p>
        </div>
        <Link className="text-link" to="/requests">← Volver</Link>
      </header>

      <form className="panel form-grid" onSubmit={handleSubmit} noValidate>
        {error && <div className="field--full"><Alert>{error}</Alert></div>}

        <div className="field field--full">
          <label htmlFor="title">Título</label>
          <input id="title" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Renovación de equipos" required />
        </div>
        <div className="field field--full">
          <label htmlFor="description">Descripción</label>
          <textarea id="description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explica qué se comprará y por qué" required />
        </div>
        <div className="field">
          <label htmlFor="amount">Monto en COP</label>
          <input id="amount" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="1500000" required />
        </div>
        <div className="field">
          <span className="field-label">Solicitante</span>
          <input value={`${DEMO_REQUESTER.name} · ${DEMO_REQUESTER.email}`} readOnly aria-label="Solicitante" />
        </div>

        <fieldset className="approver-selector">
          <legend className="field-label">Aprobadores requeridos</legend>
          {selectedIds.map((selectedId, index) => (
            <label className="approver-row" key={index}>
              <span className="approver-row__number">{index + 1}</span>
              <select aria-label={`Aprobador ${index + 1}`} value={selectedId} onChange={(event) => updateApprover(index, event.target.value)} required>
                <option value="">Selecciona una persona y su rol</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id} disabled={selectedIds.includes(user.id) && selectedId !== user.id}>
                    {user.name} — {user.role}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {selectedIds.some(Boolean) && selectionError && <span className="field-error">{selectionError}</span>}
        </fieldset>

        <div className="field--full button-row">
          <button className="button" disabled={submitting || Boolean(selectionError)} type="submit">
            {submitting ? "Creando…" : "Crear y notificar"}
          </button>
          <Link className="button button--secondary" to="/requests">Cancelar</Link>
        </div>
      </form>
    </section>
  );
}
