import { describe, expect, it, vi } from "vitest";
import type { CreatePurchaseRequestProps } from "../domain/entities/types/purchase-request.interface";
import { InMemoryBackend } from "../infrastructure/in-memory/in-memory-backend";
import { CryptoSecurityService } from "../infrastructure/security/crypto-security-service";
import { PurchaseApprovalService } from "./purchase-approval-service";

function input(): CreatePurchaseRequestProps {
  return {
    requesterId: "requester-1", requesterIdentity: "900", requesterName: "Sofía",
    requesterEmail: "sofia@example.com", title: "Licencias", description: "Renovación anual", amount: 5_000_000,
    approvers: [
      { approverId: "u1", approverIdentity: "1", approverName: "Ana", approverEmail: "ana@example.com", role: "FINANCE" },
      { approverId: "u2", approverIdentity: "2", approverName: "Bruno", approverEmail: "bruno@example.com", role: "LEGAL" },
      { approverId: "u3", approverIdentity: "3", approverName: "Carla", approverEmail: "carla@example.com", role: "OPERATIONS" },
    ],
  };
}

function getToken(link?: string): string {
  if (!link) throw new Error("Invitation link missing");
  return new URL(link).searchParams.get("token") ?? "";
}

function setup() {
  const backend = new InMemoryBackend();
  const audit = { log: vi.fn() };
  const clock = { now: () => new Date("2026-08-17T12:00:00Z") };
  const service = new PurchaseApprovalService({
    requests: backend.requests, tokens: backend.tokens, sessions: backend.sessions, mails: backend.mails,
    evidenceGenerator: backend.evidenceGenerator, evidenceStorage: backend.evidenceStorage,
    security: new CryptoSecurityService("test-pepper"), clock, audit,
    approverAppUrl: "https://app.example.com",
  });
  return { backend, service, audit };
}

describe("PurchaseApprovalService", () => {
  it("runs the full approval flow and produces evidence", async () => {
    const { service } = setup();
    const created = await service.createRequest(input());
    expect(await service.listRequests("requester-1")).toHaveLength(1);
    expect((await service.listMockMail()).filter((mail) => mail.type === "INVITATION")).toHaveLength(3);

    const tokens = (await service.listMockMail())
      .filter((mail) => mail.type === "INVITATION")
      .map((mail) => getToken(mail.link));

    for (const [index, token] of tokens.entries()) {
      await service.requestOtp(token);
      const otp = (await service.listMockMail()).find((mail) => mail.type === "OTP")?.otp ?? "";
      const access = await service.validateOtp(token, otp);
      expect(access.request.title).toBe("Licencias");
      const result = await service.submitDecision(access.sessionId, "APPROVE");
      expect(result.status).toBe(index === 2 ? "COMPLETED" : "PENDING");
    }

    const final = await service.getRequest(created.id, "requester-1");
    expect(final.approvals.every((approval) => approval.status === "SIGNED")).toBe(true);
    await expect(service.getEvidenceUrl(final.id, "requester-1")).resolves.toContain("evidence%2F");
  });

  it("rejects a request and denies requester data to another user", async () => {
    const { service } = setup();
    const created = await service.createRequest(input());
    await expect(service.getRequest(created.id, "other-user")).rejects.toThrow("not found");
    const token = getToken((await service.listMockMail()).find((mail) => mail.type === "INVITATION")?.link);
    await service.requestOtp(token);
    const otp = (await service.listMockMail()).find((mail) => mail.type === "OTP")?.otp ?? "";
    const access = await service.validateOtp(token, otp);
    const rejected = await service.submitDecision(access.sessionId, "REJECT");

    expect(rejected.status).toBe("REJECTED");
    expect(rejected.approvals.filter((approval) => approval.status === "CANCELLED")).toHaveLength(2);
    await expect(service.getEvidenceUrl(created.id, "requester-1")).rejects.toThrow("not available");
    await expect(service.requestOtp(token)).rejects.toThrow("no longer available");
  });

  it("rejects invalid OTPs and audits the fifth failed attempt", async () => {
    const { service, audit } = setup();
    await service.createRequest(input());
    const token = getToken((await service.listMockMail()).find((mail) => mail.type === "INVITATION")?.link);
    await service.requestOtp(token);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.validateOtp(token, "000000")).rejects.toThrow("OTP is invalid");
    }
    expect(audit.log).toHaveBeenCalledWith("OTP_FIVE_FAILED_ATTEMPTS", expect.any(Object));
    await expect(service.validateOtp("invalid", "000000")).rejects.toThrow("token is invalid");
    await expect(service.submitDecision("invalid", "APPROVE")).rejects.toThrow("session has expired");
  });
});
