import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { PurchaseApprovalService } from "../../application/purchase-approval-service";
import { InMemoryBackend } from "../../infrastructure/in-memory/in-memory-backend";
import { CryptoSecurityService } from "../../infrastructure/security/crypto-security-service";
import { createHttpHandler } from "./handler";

function setup() {
  const backend = new InMemoryBackend();
  const service = new PurchaseApprovalService({
    requests: backend.requests, tokens: backend.tokens, sessions: backend.sessions, mails: backend.mails,
    evidenceGenerator: backend.evidenceGenerator, evidenceStorage: backend.evidenceStorage,
    security: new CryptoSecurityService("pepper"), clock: { now: () => new Date("2026-08-17T12:00:00Z") },
    audit: { log: vi.fn() }, approverAppUrl: "https://app.example.com",
  });
  return createHttpHandler(service);
}

function event(method: string, path: string, body?: unknown, requesterId?: string): APIGatewayProxyEvent {
  return {
    httpMethod: method, path, body: body === undefined ? null : JSON.stringify(body),
    headers: requesterId ? { "x-requester-id": requesterId } : {},
    multiValueHeaders: {}, queryStringParameters: null, multiValueQueryStringParameters: null,
    pathParameters: null, stageVariables: null, requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: path, isBase64Encoded: false,
  };
}

const body = {
  requesterId: "requester-1", requesterIdentity: "900", requesterName: "Sofía", requesterEmail: "sofia@example.com",
  title: "Equipos", description: "Renovación", amount: 1000,
  approvers: [
    { approverId: "u1", approverIdentity: "1", approverName: "Ana", approverEmail: "a@example.com", role: "FINANCE" },
    { approverId: "u2", approverIdentity: "2", approverName: "Bruno", approverEmail: "b@example.com", role: "LEGAL" },
    { approverId: "u3", approverIdentity: "3", approverName: "Carla", approverEmail: "c@example.com", role: "OPERATIONS" },
  ],
};

describe("HTTP handler", () => {
  it("serves health, users, CORS and unknown routes", async () => {
    const handler = setup();
    expect((await handler(event("GET", "/health"))).statusCode).toBe(200);
    expect(JSON.parse((await handler(event("GET", "/users"))).body)).toHaveLength(5);
    expect((await handler(event("OPTIONS", "/requests"))).statusCode).toBe(204);
    expect((await handler(event("GET", "/missing"))).statusCode).toBe(404);
  });

  it("creates and queries requester data", async () => {
    const handler = setup();
    const createdResponse = await handler(event("POST", "/requests", body, "requester-1"));
    expect(createdResponse.statusCode).toBe(201);
    const created = JSON.parse(createdResponse.body) as { id: string };
    const list = await handler(event("GET", "/requests", undefined, "requester-1"));
    expect(JSON.parse(list.body)).toHaveLength(1);
    expect((await handler(event("GET", `/requests/${created.id}`, undefined, "requester-1"))).statusCode).toBe(200);
    expect((await handler(event("GET", "/requests"))).statusCode).toBe(401);
  });

  it("validates bodies and exposes the mock mailbox", async () => {
    const handler = setup();
    expect((await handler(event("POST", "/requests", { ...body, amount: -1 }, "requester-1"))).statusCode).toBe(400);
    await handler(event("POST", "/requests", body, "requester-1"));
    const mail = await handler(event("GET", "/mock-mail"));
    expect(JSON.parse(mail.body)).toHaveLength(3);
  });

  it("returns the signed evidence URL as JSON instead of redirecting the browser", async () => {
    const getEvidenceUrl = vi
      .spyOn(PurchaseApprovalService.prototype, "getEvidenceUrl")
      .mockResolvedValueOnce("https://evidence.example/signed");
    const handler = setup();

    const result = await handler(event("GET", "/requests/request-1/evidence.pdf", undefined, "requester-1"));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      url: "https://evidence.example/signed",
      expiresInSeconds: 60,
    });
    expect(getEvidenceUrl).toHaveBeenCalledWith("request-1", "requester-1");
    getEvidenceUrl.mockRestore();
  });
});
