import type {
  ApprovalSessionRecord, ApprovalSessionRepository, ApprovalTokenRecord, ApprovalTokenRepository,
  EvidenceGenerator, EvidenceStorage, MailMessage, MailRepository, PurchaseRequestRepository,
} from "../../application/ports";
import { PurchaseRequest } from "../../domain/entities/purchase-request";
import type { PurchaseRequestSnapshot } from "../../domain/entities/types/purchase-request.interface";

interface StoredAggregate { snapshot: PurchaseRequestSnapshot; version: number }

export class InMemoryBackend {
  private readonly requestData = new Map<string, StoredAggregate>();
  private readonly tokenData = new Map<string, ApprovalTokenRecord>();
  private readonly sessionData = new Map<string, ApprovalSessionRecord>();
  private readonly mailData: MailMessage[] = [];
  private readonly evidenceData = new Map<string, Uint8Array>();

  readonly requests: PurchaseRequestRepository = {
    create: async (request) => {
      if (this.requestData.has(request.id)) throw new Error("Purchase request already exists");
      this.requestData.set(request.id, { snapshot: structuredClone(request.toSnapshot()), version: 1 });
    },
    findById: async (requestId) => {
      const stored = this.requestData.get(requestId);
      return stored
        ? { request: PurchaseRequest.restore(structuredClone(stored.snapshot)), version: stored.version }
        : null;
    },
    listByRequester: async (requesterId) => [...this.requestData.values()]
      .filter((stored) => stored.snapshot.requesterId === requesterId)
      .sort((left, right) => right.snapshot.createdAt.getTime() - left.snapshot.createdAt.getTime())
      .map((stored) => PurchaseRequest.restore(structuredClone(stored.snapshot))),
    save: async (request, expectedVersion) => {
      const stored = this.requestData.get(request.id);
      if (!stored || stored.version !== expectedVersion) throw new Error("Purchase request was updated concurrently");
      this.requestData.set(request.id, {
        snapshot: structuredClone(request.toSnapshot()), version: expectedVersion + 1,
      });
    },
  };

  readonly tokens: ApprovalTokenRepository = {
    put: async (record) => { this.tokenData.set(record.tokenHash, structuredClone(record)); },
    findByHash: async (hash) => {
      const record = this.tokenData.get(hash);
      return record ? structuredClone(record) : null;
    },
    save: async (record) => { this.tokenData.set(record.tokenHash, structuredClone(record)); },
  };

  readonly sessions: ApprovalSessionRepository = {
    put: async (record) => { this.sessionData.set(record.sessionHash, structuredClone(record)); },
    findByHash: async (hash) => {
      const record = this.sessionData.get(hash);
      return record ? structuredClone(record) : null;
    },
    delete: async (hash) => { this.sessionData.delete(hash); },
  };

  readonly mails: MailRepository = {
    put: async (message) => { this.mailData.unshift(structuredClone(message)); },
    list: async () => structuredClone(this.mailData),
  };

  readonly evidenceGenerator: EvidenceGenerator = {
    generate: async (snapshot) => new TextEncoder().encode(`Evidence for ${snapshot.id}`),
  };

  readonly evidenceStorage: EvidenceStorage = {
    put: async (key, bytes) => { this.evidenceData.set(key, Uint8Array.from(bytes)); },
    getDownloadUrl: async (key) => {
      if (!this.evidenceData.has(key)) throw new Error("Evidence not found");
      return `https://evidence.example/${encodeURIComponent(key)}`;
    },
  };
}
