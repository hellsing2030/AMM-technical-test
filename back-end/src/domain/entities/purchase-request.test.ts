import { describe, expect, it, vi } from "vitest";
import { ApprovalStatus } from "../enums/approval-status";
import { RequestStatus } from "../enums/request-status";
import { PurchaseRequest } from "./purchase-request";
import type { CreatePurchaseRequestProps } from "./types/purchase-request.interface";

function validInput(): CreatePurchaseRequestProps {
  return {
    requesterId: " requester-1 ", requesterIdentity: "90001", requesterName: "Sofía",
    requesterEmail: "SOFIA@EXAMPLE.COM", title: " Compra de equipos ",
    description: " Renovación de portátiles ", amount: 10_000_000,
    approvers: [
      { approverId: "u1", approverIdentity: "1", approverName: "Ana", approverEmail: "ANA@EXAMPLE.COM", role: " finance " },
      { approverId: "u2", approverIdentity: "2", approverName: "Bruno", approverEmail: "bruno@example.com", role: "legal" },
      { approverId: "u3", approverIdentity: "3", approverName: "Carla", approverEmail: "carla@example.com", role: "operations" },
    ],
  };
}

describe("PurchaseRequest", () => {
  it("creates a normalized pending request with three linked approvals", () => {
    const snapshot = PurchaseRequest.create(validInput()).toSnapshot();
    expect(snapshot.status).toBe(RequestStatus.PENDING);
    expect(snapshot.title).toBe("Compra de equipos");
    expect(snapshot.requesterEmail).toBe("sofia@example.com");
    expect(snapshot.approvals).toHaveLength(3);
    expect(snapshot.approvals.every((approval) => approval.requestId === snapshot.id)).toBe(true);
    expect(snapshot.approvals.map((approval) => approval.role)).toEqual(["FINANCE", "LEGAL", "OPERATIONS"]);
  });

  it.each([
    ["empty title", (input: CreatePurchaseRequestProps) => { input.title = " "; }, "Title is required"],
    ["empty description", (input: CreatePurchaseRequestProps) => { input.description = " "; }, "Description is required"],
    ["zero amount", (input: CreatePurchaseRequestProps) => { input.amount = 0; }, "Amount must be greater than zero"],
    ["invalid count", (input: CreatePurchaseRequestProps) => { input.approvers.pop(); }, "Exactly three approvers are required"],
    ["duplicate person", (input: CreatePurchaseRequestProps) => { input.approvers[1]!.approverId = "u1"; }, "Approvers must be different"],
    ["duplicate role", (input: CreatePurchaseRequestProps) => { input.approvers[1]!.role = " FINANCE "; }, "Approver roles must be different"],
  ])("rejects %s", (_name, mutate, message) => {
    const input = validInput(); mutate(input);
    expect(() => PurchaseRequest.create(input)).toThrow(message);
  });

  it("moves to generating evidence only after the third signature", () => {
    const request = PurchaseRequest.create(validInput());
    const [first, second, third] = request.toSnapshot().approvals;
    request.signApproval(first!.id); request.signApproval(second!.id);
    expect(request.status).toBe(RequestStatus.PENDING);
    request.signApproval(third!.id);
    expect(request.status).toBe(RequestStatus.GENERATING_EVIDENCE);
  });

  it("rejects and cancels only pending approvals", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-08-17T12:00:00Z"));
    try {
      const request = PurchaseRequest.create(validInput());
      const [signed, rejected] = request.toSnapshot().approvals;
      request.signApproval(signed!.id); request.rejectApproval(rejected!.id);
      const snapshot = request.toSnapshot();
      expect(snapshot.status).toBe(RequestStatus.REJECTED);
      expect(snapshot.rejectedAt).toEqual(new Date("2026-08-17T12:00:00Z"));
      expect(snapshot.approvals.map((approval) => approval.status)).toEqual([
        ApprovalStatus.SIGNED, ApprovalStatus.REJECTED, ApprovalStatus.CANCELLED,
      ]);
      expect(() => request.signApproval(signed!.id)).toThrow("Purchase request is not pending");
    } finally { vi.useRealTimers(); }
  });

  it("completes evidence and preserves data on restore", () => {
    const request = PurchaseRequest.create(validInput());
    request.toSnapshot().approvals.forEach((approval) => request.signApproval(approval.id));
    request.markEvidenceCompleted(" evidence/request.pdf ");
    const snapshot = request.toSnapshot();
    const restored = PurchaseRequest.restore(snapshot).toSnapshot();
    expect(restored.status).toBe(RequestStatus.COMPLETED);
    expect(restored.evidenceKey).toBe("evidence/request.pdf");
    expect(restored.id).toBe(snapshot.id);
    expect(restored.approvals.map((approval) => approval.id)).toEqual(snapshot.approvals.map((approval) => approval.id));
    expect(() => request.markEvidenceCompleted("again.pdf")).toThrow("not generating evidence");
  });

  it("rejects unknown approvals and empty evidence keys", () => {
    const request = PurchaseRequest.create(validInput());
    expect(() => request.signApproval("missing")).toThrow("Approval not found");
    request.toSnapshot().approvals.forEach((approval) => request.signApproval(approval.id));
    expect(() => request.markEvidenceCompleted(" ")).toThrow("Evidence key is required");
  });
});
