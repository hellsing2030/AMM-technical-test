import {
  DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  ApprovalSessionRecord, ApprovalSessionRepository, ApprovalTokenRecord, ApprovalTokenRepository,
  MailMessage, MailRepository, PurchaseRequestRepository,
} from "../../application/ports";
import { PurchaseRequest } from "../../domain/entities/purchase-request";
import type { ApprovalSnapshot } from "../../domain/entities/types/approval.interfaces";
import type { PurchaseRequestSnapshot } from "../../domain/entities/types/purchase-request.interface";

interface PersistedApproval extends Omit<ApprovalSnapshot, "createdAt" | "decisionAt" | "cancelledAt"> {
  createdAt: string;
  decisionAt?: string;
  cancelledAt?: string;
}

interface PersistedRequest extends Omit<PurchaseRequestSnapshot, "approvals" | "createdAt" | "completedAt" | "rejectedAt"> {
  approvals: PersistedApproval[];
  createdAt: string;
  completedAt?: string;
  rejectedAt?: string;
}

interface RequestItem {
  PK: string; SK: "REQUEST"; GSI1PK: string; GSI1SK: string;
  entityType: "REQUEST"; version: number; snapshot: PersistedRequest;
}

export class DynamoBackend {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  readonly requests: PurchaseRequestRepository = {
    create: async (request) => {
      const snapshot = request.toSnapshot();
      await this.documentClient.send(new PutCommand({
        TableName: this.tableName,
        Item: this.requestItem(snapshot, 1),
        ConditionExpression: "attribute_not_exists(PK)",
      }));
    },
    findById: async (requestId) => {
      const response = await this.documentClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { PK: `REQUEST#${requestId}`, SK: "REQUEST" },
        ConsistentRead: true,
      }));
      if (!response.Item) return null;
      const item = response.Item as RequestItem;
      return { request: PurchaseRequest.restore(deserializeRequest(item.snapshot)), version: item.version };
    },
    listByRequester: async (requesterId) => {
      const response = await this.documentClient.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": `REQUESTER#${requesterId}` },
        ScanIndexForward: false,
      }));
      return (response.Items ?? []).map((raw) =>
        PurchaseRequest.restore(deserializeRequest((raw as RequestItem).snapshot)),
      );
    },
    save: async (request, expectedVersion) => {
      await this.documentClient.send(new PutCommand({
        TableName: this.tableName,
        Item: this.requestItem(request.toSnapshot(), expectedVersion + 1),
        ConditionExpression: "#version = :expectedVersion",
        ExpressionAttributeNames: { "#version": "version" },
        ExpressionAttributeValues: { ":expectedVersion": expectedVersion },
      }));
    },
  };

  readonly tokens: ApprovalTokenRepository = {
    put: async (record) => this.putToken(record),
    findByHash: async (tokenHash) => {
      const response = await this.documentClient.send(new GetCommand({
        TableName: this.tableName, Key: { PK: `TOKEN#${tokenHash}`, SK: "TOKEN" },
      }));
      if (!response.Item) return null;
      const item = response.Item;
      return {
        tokenHash, requestId: String(item.requestId), approvalId: String(item.approvalId),
        approverEmail: String(item.approverEmail), tokenExpiresAt: new Date(String(item.tokenExpiresAt)),
        failedAttempts: Number(item.failedAttempts),
        ...(item.otpHash ? { otpHash: String(item.otpHash) } : {}),
        ...(item.otpExpiresAt ? { otpExpiresAt: new Date(String(item.otpExpiresAt)) } : {}),
      };
    },
    save: async (record) => this.putToken(record),
  };

  readonly sessions: ApprovalSessionRepository = {
    put: async (record) => {
      await this.documentClient.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `SESSION#${record.sessionHash}`, SK: "SESSION", entityType: "SESSION",
          requestId: record.requestId, approvalId: record.approvalId,
          expiresAt: record.expiresAt.toISOString(), expiresAtEpoch: epoch(record.expiresAt),
        },
      }));
    },
    findByHash: async (sessionHash) => {
      const response = await this.documentClient.send(new GetCommand({
        TableName: this.tableName, Key: { PK: `SESSION#${sessionHash}`, SK: "SESSION" },
      }));
      if (!response.Item) return null;
      return {
        sessionHash, requestId: String(response.Item.requestId), approvalId: String(response.Item.approvalId),
        expiresAt: new Date(String(response.Item.expiresAt)),
      };
    },
    delete: async (sessionHash) => {
      await this.documentClient.send(new DeleteCommand({
        TableName: this.tableName, Key: { PK: `SESSION#${sessionHash}`, SK: "SESSION" },
      }));
    },
  };

  readonly mails: MailRepository = {
    put: async (message) => {
      await this.documentClient.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: "MAILBOX", SK: `${message.sentAt.toISOString()}#${message.id}`, entityType: "MAIL",
          id: message.id, to: message.to, subject: message.subject, body: message.body,
          type: message.type, sentAt: message.sentAt.toISOString(),
          ...(message.link ? { link: message.link } : {}), ...(message.otp ? { otp: message.otp } : {}),
        },
      }));
    },
    list: async () => {
      const response = await this.documentClient.send(new QueryCommand({
        TableName: this.tableName, KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "MAILBOX" }, ScanIndexForward: false, Limit: 100,
      }));
      return (response.Items ?? []).map((item) => ({
        id: String(item.id), to: String(item.to), subject: String(item.subject), body: String(item.body),
        type: item.type as MailMessage["type"], sentAt: new Date(String(item.sentAt)),
        ...(item.link ? { link: String(item.link) } : {}), ...(item.otp ? { otp: String(item.otp) } : {}),
      }));
    },
  };

  private requestItem(snapshot: PurchaseRequestSnapshot, version: number): RequestItem {
    return {
      PK: `REQUEST#${snapshot.id}`, SK: "REQUEST", GSI1PK: `REQUESTER#${snapshot.requesterId}`,
      GSI1SK: snapshot.createdAt.toISOString(), entityType: "REQUEST", version,
      snapshot: serializeRequest(snapshot),
    };
  }

  private async putToken(record: ApprovalTokenRecord): Promise<void> {
    await this.documentClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `TOKEN#${record.tokenHash}`, SK: "TOKEN", entityType: "TOKEN",
        requestId: record.requestId, approvalId: record.approvalId, approverEmail: record.approverEmail,
        tokenExpiresAt: record.tokenExpiresAt.toISOString(), expiresAtEpoch: epoch(record.tokenExpiresAt),
        failedAttempts: record.failedAttempts,
        ...(record.otpHash ? { otpHash: record.otpHash } : {}),
        ...(record.otpExpiresAt ? { otpExpiresAt: record.otpExpiresAt.toISOString() } : {}),
      },
    }));
  }
}

function epoch(date: Date): number { return Math.floor(date.getTime() / 1000); }

function serializeRequest(snapshot: PurchaseRequestSnapshot): PersistedRequest {
  const { approvals, createdAt, completedAt, rejectedAt, ...data } = snapshot;
  return {
    ...data, createdAt: createdAt.toISOString(),
    ...(completedAt ? { completedAt: completedAt.toISOString() } : {}),
    ...(rejectedAt ? { rejectedAt: rejectedAt.toISOString() } : {}),
    approvals: approvals.map((approval) => {
      const { createdAt, decisionAt, cancelledAt, ...data } = approval;
      return {
        ...data, createdAt: createdAt.toISOString(),
        ...(decisionAt ? { decisionAt: decisionAt.toISOString() } : {}),
        ...(cancelledAt ? { cancelledAt: cancelledAt.toISOString() } : {}),
      };
    }),
  };
}

function deserializeRequest(snapshot: PersistedRequest): PurchaseRequestSnapshot {
  const { approvals, createdAt, completedAt, rejectedAt, ...data } = snapshot;
  return {
    ...data, createdAt: new Date(createdAt),
    ...(completedAt ? { completedAt: new Date(completedAt) } : {}),
    ...(rejectedAt ? { rejectedAt: new Date(rejectedAt) } : {}),
    approvals: approvals.map((approval) => {
      const { createdAt, decisionAt, cancelledAt, ...data } = approval;
      return {
        ...data, createdAt: new Date(createdAt),
        ...(decisionAt ? { decisionAt: new Date(decisionAt) } : {}),
        ...(cancelledAt ? { cancelledAt: new Date(cancelledAt) } : {}),
      };
    }),
  };
}
