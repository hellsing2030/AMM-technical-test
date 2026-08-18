import { randomUUID } from "node:crypto";
import { ApprovalStatus } from "../domain/enums/approval-status";
import { PurchaseRequest } from "../domain/entities/purchase-request";
import type { CreatePurchaseRequestProps, PurchaseRequestSnapshot } from "../domain/entities/types/purchase-request.interface";
import { ConflictError, NotFoundError, UnauthorizedError } from "./errors";
import type {
  ApprovalSessionRepository,
  ApprovalTokenRepository,
  AuditLogger,
  Clock,
  EvidenceGenerator,
  EvidenceStorage,
  MailMessage,
  MailRepository,
  PurchaseRequestRepository,
  SecurityService,
} from "./ports";

const OTP_LIFETIME_MS = 3 * 60 * 1000;
const SESSION_LIFETIME_MS = 10 * 60 * 1000;
const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface PurchaseApprovalDependencies {
  requests: PurchaseRequestRepository;
  tokens: ApprovalTokenRepository;
  sessions: ApprovalSessionRepository;
  mails: MailRepository;
  evidenceGenerator: EvidenceGenerator;
  evidenceStorage: EvidenceStorage;
  security: SecurityService;
  clock: Clock;
  audit: AuditLogger;
  approverAppUrl: string;
}

export interface ApprovalAccessResult {
  sessionId: string;
  request: PurchaseRequestSnapshot;
  approvalId: string;
  expiresAt: Date;
}

export class PurchaseApprovalService {
  constructor(private readonly dependencies: PurchaseApprovalDependencies) {}

  async createRequest(input: CreatePurchaseRequestProps): Promise<PurchaseRequestSnapshot> {
    const request = PurchaseRequest.create(input);
    await this.dependencies.requests.create(request);
    const now = this.dependencies.clock.now();

    for (const approval of request.toSnapshot().approvals) {
      const token = this.dependencies.security.generateToken();
      await this.dependencies.tokens.put({
        tokenHash: this.dependencies.security.hash(token),
        requestId: request.id,
        approvalId: approval.id,
        approverEmail: approval.approverEmail,
        tokenExpiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
        failedAttempts: 0,
      });
      await this.dependencies.mails.put({
        id: randomUUID(),
        to: approval.approverEmail,
        subject: `Solicitud de aprobación: ${request.toSnapshot().title}`,
        body: `Tienes una solicitud pendiente como ${approval.role}.`,
        type: "INVITATION",
        sentAt: now,
        link: `${this.dependencies.approverAppUrl}/approve?token=${encodeURIComponent(token)}`,
      });
    }

    this.dependencies.audit.log("REQUEST_CREATED", { requestId: request.id, requesterId: input.requesterId });
    return request.toSnapshot();
  }

  async listRequests(requesterId: string): Promise<PurchaseRequestSnapshot[]> {
    const requests = await this.dependencies.requests.listByRequester(requesterId.trim());
    return requests.map((request) => request.toSnapshot());
  }

  async getRequest(requestId: string, requesterId: string): Promise<PurchaseRequestSnapshot> {
    const stored = await this.requireRequest(requestId);
    const snapshot = stored.request.toSnapshot();
    if (snapshot.requesterId !== requesterId.trim()) throw new NotFoundError("Purchase request not found");
    return snapshot;
  }

  async requestOtp(rawToken: string): Promise<void> {
    const token = await this.requireToken(rawToken);
    const stored = await this.requireRequest(token.requestId);
    const approval = stored.request.toSnapshot().approvals.find((item) => item.id === token.approvalId);
    if (!approval || approval.status !== ApprovalStatus.PENDING || stored.request.status !== "PENDING") {
      throw new ConflictError("This approval is no longer available");
    }

    const otp = this.dependencies.security.generateOtp();
    const now = this.dependencies.clock.now();
    token.otpHash = this.dependencies.security.hash(otp);
    token.otpExpiresAt = new Date(now.getTime() + OTP_LIFETIME_MS);
    token.failedAttempts = 0;
    await this.dependencies.tokens.save(token);
    await this.dependencies.mails.put({
      id: randomUUID(),
      to: token.approverEmail,
      subject: "Código OTP para aprobar una compra",
      body: "Tu código es válido durante tres minutos.",
      type: "OTP",
      sentAt: now,
      otp,
    });
  }

  async validateOtp(rawToken: string, otp: string): Promise<ApprovalAccessResult> {
    const token = await this.requireToken(rawToken);
    const now = this.dependencies.clock.now();
    if (!token.otpHash || !token.otpExpiresAt) throw new ConflictError("Request an OTP first");
    if (token.otpExpiresAt.getTime() <= now.getTime()) throw new UnauthorizedError("OTP has expired");
    if (!this.dependencies.security.matches(otp.trim(), token.otpHash)) {
      token.failedAttempts += 1;
      await this.dependencies.tokens.save(token);
      if (token.failedAttempts === 5) {
        this.dependencies.audit.log("OTP_FIVE_FAILED_ATTEMPTS", { requestId: token.requestId, approvalId: token.approvalId });
      }
      throw new UnauthorizedError("OTP is invalid");
    }

    delete token.otpHash;
    delete token.otpExpiresAt;
    await this.dependencies.tokens.save(token);
    const sessionId = this.dependencies.security.generateToken();
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
    await this.dependencies.sessions.put({
      sessionHash: this.dependencies.security.hash(sessionId),
      requestId: token.requestId,
      approvalId: token.approvalId,
      expiresAt,
    });
    const stored = await this.requireRequest(token.requestId);
    return { sessionId, request: stored.request.toSnapshot(), approvalId: token.approvalId, expiresAt };
  }

  async submitDecision(sessionId: string, decision: "APPROVE" | "REJECT"): Promise<PurchaseRequestSnapshot> {
    const sessionHash = this.dependencies.security.hash(sessionId.trim());
    const session = await this.dependencies.sessions.findByHash(sessionHash);
    const now = this.dependencies.clock.now();
    if (!session || session.expiresAt.getTime() <= now.getTime()) throw new UnauthorizedError("Approval session has expired");

    const stored = await this.requireRequest(session.requestId);
    if (decision === "APPROVE") stored.request.signApproval(session.approvalId);
    else stored.request.rejectApproval(session.approvalId);

    if (stored.request.status === "GENERATING_EVIDENCE") {
      const key = `evidence/${stored.request.id}.pdf`;
      const bytes = await this.dependencies.evidenceGenerator.generate(stored.request.toSnapshot());
      await this.dependencies.evidenceStorage.put(key, bytes);
      stored.request.markEvidenceCompleted(key);
    }

    try {
      await this.dependencies.requests.save(stored.request, stored.version);
    } catch (error) {
      throw new ConflictError(error instanceof Error ? error.message : "Concurrent request update");
    }
    await this.dependencies.sessions.delete(sessionHash);
    const snapshot = stored.request.toSnapshot();
    this.dependencies.audit.log(decision === "APPROVE" ? "APPROVAL_SIGNED" : "REQUEST_REJECTED", {
      requestId: snapshot.id, approvalId: session.approvalId,
    });
    if (snapshot.status === "COMPLETED") this.dependencies.audit.log("EVIDENCE_COMPLETED", { requestId: snapshot.id, evidenceKey: snapshot.evidenceKey });
    return snapshot;
  }

  async getEvidenceUrl(requestId: string, requesterId: string): Promise<string> {
    const request = await this.getRequest(requestId, requesterId);
    if (request.status !== "COMPLETED" || !request.evidenceKey) throw new ConflictError("Evidence is not available");
    return this.dependencies.evidenceStorage.getDownloadUrl(request.evidenceKey);
  }

  async listMockMail(): Promise<MailMessage[]> {
    return this.dependencies.mails.list();
  }

  private async requireRequest(requestId: string) {
    const stored = await this.dependencies.requests.findById(requestId.trim());
    if (!stored) throw new NotFoundError("Purchase request not found");
    return stored;
  }

  private async requireToken(rawToken: string) {
    const token = await this.dependencies.tokens.findByHash(this.dependencies.security.hash(rawToken.trim()));
    if (!token) throw new NotFoundError("Approval token is invalid");
    if (token.tokenExpiresAt.getTime() <= this.dependencies.clock.now().getTime()) throw new UnauthorizedError("Approval token has expired");
    return token;
  }
}
