import { describe, expect, it, vi } from "vitest";
import { MockApiClient } from "./mock-api-client";
import type { CreatePurchaseRequestInput, User } from "./types";

function inputFrom(users: User[]): CreatePurchaseRequestInput {
  return {
    requesterId: "requester-1",
    requesterIdentity: "90001",
    requesterName: "Sofía Solicitante",
    requesterEmail: "SOFIA@EXAMPLE.COM",
    title: "  Computadores nuevos  ",
    description: "  Renovación del equipo de desarrollo  ",
    amount: 12_000_000,
    approvers: users.slice(0, 3).map((user) => ({
      approverId: user.id,
      approverIdentity: user.identity,
      approverName: user.name,
      approverEmail: user.email,
      role: user.role,
    })),
  };
}

function tokenFromLink(link?: string): string {
  if (!link) throw new Error("Missing invitation link");
  return new URL(link, "http://localhost").searchParams.get("token") ?? "";
}

describe("MockApiClient", () => {
  it("completes the three-approver flow and exposes evidence", async () => {
    const client = new MockApiClient(window.localStorage);
    const users = await client.listApprovers();
    const request = await client.createRequest(inputFrom(users));

    expect(request.title).toBe("Computadores nuevos");
    expect(request.requesterEmail).toBe("sofia@example.com");
    expect(request.approvals).toHaveLength(3);
    expect(await client.listRequests()).toHaveLength(1);
    expect((await client.getRequest(request.id)).status).toBe("PENDING");

    const invitationTokens = (await client.listMockMail())
      .filter((mail) => mail.type === "INVITATION")
      .map((mail) => tokenFromLink(mail.link));

    for (const [index, token] of invitationTokens.entries()) {
      await client.requestOtp(token);
      const otpMail = (await client.listMockMail())[0];
      expect(otpMail?.type).toBe("OTP");
      await expect(client.validateOtp(token, "000000")).rejects.toThrow("no es correcto");
      const access = await client.validateOtp(token, otpMail?.otp ?? "");
      const updated = await client.submitDecision(access.sessionId, "APPROVE");
      expect(updated.status).toBe(index === 2 ? "COMPLETED" : "PENDING");
    }

    const completed = await client.getRequest(request.id);
    expect(completed.approvals.every((approval) => approval.status === "SIGNED")).toBe(true);
    expect(completed.evidenceKey).toContain(request.id);
    expect((await client.downloadEvidence(request.id)).type).toBe("application/pdf");
  });

  it("rejects a request and cancels the other pending approvals", async () => {
    const client = new MockApiClient(window.localStorage);
    const request = await client.createRequest(inputFrom(await client.listApprovers()));
    const invitation = (await client.listMockMail()).find((mail) => mail.type === "INVITATION");
    const token = tokenFromLink(invitation?.link);
    await client.requestOtp(token);
    const otp = (await client.listMockMail())[0]?.otp ?? "";
    const access = await client.validateOtp(token, otp);

    const rejected = await client.submitDecision(access.sessionId, "REJECT");

    expect(rejected.status).toBe("REJECTED");
    expect(rejected.approvals.filter((approval) => approval.status === "REJECTED")).toHaveLength(1);
    expect(rejected.approvals.filter((approval) => approval.status === "CANCELLED")).toHaveLength(2);
    await expect(client.downloadEvidence(request.id)).rejects.toThrow("aún no está disponible");
    await expect(client.requestOtp(token)).rejects.toThrow("ya no está disponible");
  });

  it("validates input, tokens, OTP lifecycle and reset", async () => {
    const client = new MockApiClient(window.localStorage);
    const users = await client.listApprovers();
    const badInput = inputFrom(users);
    badInput.approvers = [badInput.approvers[0]!];
    await expect(client.createRequest(badInput)).rejects.toThrow("exactamente tres");

    const duplicateInput = inputFrom(users);
    duplicateInput.approvers[1] = duplicateInput.approvers[0]!;
    await expect(client.createRequest(duplicateInput)).rejects.toThrow("deben ser diferentes");
    await expect(client.getRequest("missing")).rejects.toThrow("no encontrada");
    await expect(client.requestOtp("missing")).rejects.toThrow("no es válido");

    const request = await client.createRequest(inputFrom(users));
    const token = tokenFromLink((await client.listMockMail())[0]?.link);
    await expect(client.validateOtp(token, "123456")).rejects.toThrow("Primero");

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-17T12:00:00Z"));
      await client.requestOtp(token);
      const otp = (await client.listMockMail())[0]?.otp ?? "";
      vi.advanceTimersByTime(3 * 60 * 1000 + 1);
      await expect(client.validateOtp(token, otp)).rejects.toThrow("expiró");
    } finally {
      vi.useRealTimers();
    }

    expect(await client.listRequests()).toHaveLength(1);
    client.reset();
    expect(await client.listRequests()).toEqual([]);
    expect(request.id).toBeTruthy();
  });
});
