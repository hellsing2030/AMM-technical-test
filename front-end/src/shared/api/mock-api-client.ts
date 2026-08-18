import { ApiError } from "./api-error";
import type {
  ApiClient,
  ApprovalAccess,
  ApprovalView,
  CreatePurchaseRequestInput,
  Decision,
  EvidenceDownload,
  MockMail,
  PurchaseRequestView,
  User,
} from "./types";

const STORAGE_KEY = "amm-purchase-approval-demo-v1";
const OTP_LIFETIME_MS = 3 * 60 * 1000;
const SESSION_LIFETIME_MS = 10 * 60 * 1000;

interface TokenRecord {
  token: string;
  requestId: string;
  approvalId: string;
  otp?: string;
  otpExpiresAt?: string;
  failedAttempts: number;
}

interface SessionRecord {
  id: string;
  requestId: string;
  approvalId: string;
  expiresAt: string;
}

interface MockState {
  requests: PurchaseRequestView[];
  mails: MockMail[];
  tokens: TokenRecord[];
  sessions: SessionRecord[];
}

const DEMO_USERS: User[] = [
  { id: "approver-finance", identity: "10010001", name: "Ana Finanzas", email: "ana.finanzas@amm.demo", role: "FINANCE" },
  { id: "approver-operations", identity: "10010002", name: "Carlos Operaciones", email: "carlos.operaciones@amm.demo", role: "OPERATIONS" },
  { id: "approver-management", identity: "10010003", name: "María Gerencia", email: "maria.gerencia@amm.demo", role: "MANAGEMENT" },
  { id: "approver-legal", identity: "10010004", name: "Luis Legal", email: "luis.legal@amm.demo", role: "LEGAL" },
  { id: "approver-procurement", identity: "10010005", name: "Laura Compras", email: "laura.compras@amm.demo", role: "PROCUREMENT" },
];

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function emptyState(): MockState {
  return { requests: [], mails: [], tokens: [], sessions: [] };
}

export class MockApiClient implements ApiClient {
  constructor(private readonly storage: Storage = window.localStorage) {}

  async listApprovers(): Promise<User[]> {
    return structuredClone(DEMO_USERS);
  }

  async createRequest(input: CreatePurchaseRequestInput): Promise<PurchaseRequestView> {
    this.validateRequest(input);
    const state = this.readState();
    const now = new Date().toISOString();
    const requestId = createId();

    const approvals: ApprovalView[] = input.approvers.map((approver) => ({
      id: createId(),
      ...approver,
      role: approver.role.trim().toUpperCase(),
      status: "PENDING",
      createdAt: now,
    }));

    const request: PurchaseRequestView = {
      id: requestId,
      requesterId: input.requesterId,
      requesterIdentity: input.requesterIdentity,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail.toLowerCase(),
      title: input.title.trim(),
      description: input.description.trim(),
      amount: input.amount,
      status: "PENDING",
      approvals,
      createdAt: now,
    };

    for (const approval of approvals) {
      const token = createId();
      state.tokens.push({
        token,
        requestId,
        approvalId: approval.id,
        failedAttempts: 0,
      });
      state.mails.unshift({
        id: createId(),
        to: approval.approverEmail,
        subject: `Solicitud de aprobación: ${request.title}`,
        body: `Tienes una solicitud de compra pendiente como ${approval.role}.`,
        type: "INVITATION",
        sentAt: now,
        link: `/approve?token=${encodeURIComponent(token)}`,
      });
    }

    state.requests.unshift(request);
    this.writeState(state);
    return structuredClone(request);
  }

  async listRequests(): Promise<PurchaseRequestView[]> {
    return structuredClone(this.readState().requests);
  }

  async getRequest(requestId: string): Promise<PurchaseRequestView> {
    return structuredClone(this.findRequest(this.readState(), requestId));
  }

  async requestOtp(token: string): Promise<void> {
    const state = this.readState();
    const tokenRecord = this.findToken(state, token);
    const request = this.findRequest(state, tokenRecord.requestId);
    const approval = this.findApproval(request, tokenRecord.approvalId);

    if (request.status !== "PENDING" || approval.status !== "PENDING") {
      throw new ApiError("Esta aprobación ya no está disponible", 409);
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    tokenRecord.otp = otp;
    tokenRecord.otpExpiresAt = new Date(Date.now() + OTP_LIFETIME_MS).toISOString();
    tokenRecord.failedAttempts = 0;
    state.mails.unshift({
      id: createId(),
      to: approval.approverEmail,
      subject: "Código OTP para aprobar una compra",
      body: "Tu código es válido durante tres minutos.",
      type: "OTP",
      otp,
      sentAt: new Date().toISOString(),
    });
    this.writeState(state);
  }

  async validateOtp(token: string, otp: string): Promise<ApprovalAccess> {
    const state = this.readState();
    const tokenRecord = this.findToken(state, token);

    if (!tokenRecord.otp || !tokenRecord.otpExpiresAt) {
      throw new ApiError("Primero debes solicitar un código OTP", 400);
    }
    if (Date.parse(tokenRecord.otpExpiresAt) <= Date.now()) {
      throw new ApiError("El código OTP expiró. Solicita uno nuevo", 410);
    }
    if (tokenRecord.otp !== otp.trim()) {
      tokenRecord.failedAttempts += 1;
      this.writeState(state);
      throw new ApiError("El código OTP no es correcto", 401);
    }

    const session: SessionRecord = {
      id: createId(),
      requestId: tokenRecord.requestId,
      approvalId: tokenRecord.approvalId,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS).toISOString(),
    };
    state.sessions.push(session);
    delete tokenRecord.otp;
    delete tokenRecord.otpExpiresAt;
    this.writeState(state);

    return {
      sessionId: session.id,
      request: structuredClone(this.findRequest(state, session.requestId)),
      approvalId: session.approvalId,
      expiresAt: session.expiresAt,
    };
  }

  async submitDecision(sessionId: string, decision: Decision): Promise<PurchaseRequestView> {
    const state = this.readState();
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      throw new ApiError("La sesión de aprobación expiró", 401);
    }

    const request = this.findRequest(state, session.requestId);
    const approval = this.findApproval(request, session.approvalId);
    if (request.status !== "PENDING" || approval.status !== "PENDING") {
      throw new ApiError("La solicitud ya recibió una decisión", 409);
    }

    const now = new Date().toISOString();
    if (decision === "REJECT") {
      approval.status = "REJECTED";
      approval.decisionAt = now;
      request.status = "REJECTED";
      request.rejectedAt = now;
      request.approvals.forEach((item) => {
        if (item.status === "PENDING") {
          item.status = "CANCELLED";
          item.cancelledAt = now;
        }
      });
    } else {
      approval.status = "SIGNED";
      approval.decisionAt = now;
      if (request.approvals.every((item) => item.status === "SIGNED")) {
        request.status = "COMPLETED";
        request.completedAt = now;
        request.evidenceKey = `evidence/${request.id}.pdf`;
      }
    }

    state.sessions = state.sessions.filter((item) => item.id !== sessionId);
    this.writeState(state);
    return structuredClone(request);
  }

  async listMockMail(): Promise<MockMail[]> {
    return structuredClone(this.readState().mails);
  }

  async downloadEvidence(requestId: string): Promise<EvidenceDownload> {
    const request = this.findRequest(this.readState(), requestId);
    if (request.status !== "COMPLETED" || !request.evidenceKey) {
      throw new ApiError("La evidencia aún no está disponible", 409);
    }

    const signedBy = request.approvals.map((approval) => approval.approverName).join(", ");
    return {
      kind: "blob",
      blob: new Blob(
        [`Evidencia de aprobación\nSolicitud: ${request.title}\nAprobadores: ${signedBy}`],
        { type: "application/pdf" },
      ),
      fileName: `evidencia-${request.id}.pdf`,
    };
  }

  reset(): void {
    this.storage.removeItem(STORAGE_KEY);
  }

  private validateRequest(input: CreatePurchaseRequestInput): void {
    if (!input.title.trim() || !input.description.trim()) {
      throw new ApiError("Título y descripción son obligatorios");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ApiError("El monto debe ser mayor que cero");
    }
    if (input.approvers.length !== 3) {
      throw new ApiError("Debes seleccionar exactamente tres aprobadores");
    }

    const userIds = input.approvers.map((item) => item.approverId);
    const roles = input.approvers.map((item) => item.role.trim().toUpperCase());
    if (new Set(userIds).size !== 3 || new Set(roles).size !== 3) {
      throw new ApiError("Los tres aprobadores y sus roles deben ser diferentes");
    }
  }

  private findRequest(state: MockState, requestId: string): PurchaseRequestView {
    const request = state.requests.find((item) => item.id === requestId);
    if (!request) throw new ApiError("Solicitud no encontrada", 404);
    return request;
  }

  private findToken(state: MockState, token: string): TokenRecord {
    const record = state.tokens.find((item) => item.token === token.trim());
    if (!record) throw new ApiError("El enlace de aprobación no es válido", 404);
    return record;
  }

  private findApproval(request: PurchaseRequestView, approvalId: string): ApprovalView {
    const approval = request.approvals.find((item) => item.id === approvalId);
    if (!approval) throw new ApiError("Aprobación no encontrada", 404);
    return approval;
  }

  private readState(): MockState {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    try {
      return JSON.parse(raw) as MockState;
    } catch {
      return emptyState();
    }
  }

  private writeState(state: MockState): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
