import type { PurchaseRequest } from "../domain/entities/purchase-request";
import type { PurchaseRequestSnapshot } from "../domain/entities/types/purchase-request.interface";

export interface StoredPurchaseRequest {
  request: PurchaseRequest;
  version: number;
}

export interface PurchaseRequestRepository {
  create(request: PurchaseRequest): Promise<void>;
  findById(requestId: string): Promise<StoredPurchaseRequest | null>;
  listByRequester(requesterId: string): Promise<PurchaseRequest[]>;
  save(request: PurchaseRequest, expectedVersion: number): Promise<void>;
}

export interface ApprovalTokenRecord {
  tokenHash: string;
  requestId: string;
  approvalId: string;
  approverEmail: string;
  tokenExpiresAt: Date;
  otpHash?: string;
  otpExpiresAt?: Date;
  failedAttempts: number;
}

export interface ApprovalTokenRepository {
  put(record: ApprovalTokenRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<ApprovalTokenRecord | null>;
  save(record: ApprovalTokenRecord): Promise<void>;
}

export interface ApprovalSessionRecord {
  sessionHash: string;
  requestId: string;
  approvalId: string;
  expiresAt: Date;
}

export interface ApprovalSessionRepository {
  put(record: ApprovalSessionRecord): Promise<void>;
  findByHash(sessionHash: string): Promise<ApprovalSessionRecord | null>;
  delete(sessionHash: string): Promise<void>;
}

export interface MailMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  type: "INVITATION" | "OTP";
  sentAt: Date;
  link?: string;
  otp?: string;
}

export interface MailRepository {
  put(message: MailMessage): Promise<void>;
  list(): Promise<MailMessage[]>;
}

export interface EvidenceGenerator {
  generate(snapshot: PurchaseRequestSnapshot): Promise<Uint8Array>;
}

export interface EvidenceStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  getDownloadUrl(key: string): Promise<string>;
}

export interface SecurityService {
  generateToken(): string;
  generateOtp(): string;
  hash(value: string): string;
  matches(value: string, expectedHash: string): boolean;
}

export interface Clock {
  now(): Date;
}

export interface AuditLogger {
  log(event: string, data: Record<string, unknown>): void;
}
