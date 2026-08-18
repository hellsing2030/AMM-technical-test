import { ApprovalStatus } from "../enums/approval-status";
import { Approval } from "./approval";
import { describe, it, expect } from "vitest";
import { type ApprovalSnapshot } from "./types/approval.interfaces";

const expectApprovalStatus = (
  status: ApprovalStatus,
  snapshot: ApprovalSnapshot,
) => {
  expect(snapshot.id).toEqual(expect.any(String));
  expect(snapshot.status).toBe(status);
  expect(snapshot.createdAt).toBeInstanceOf(Date);
};

function createApproval(): Approval {
  return Approval.create({
    requestId: "request-123",
    approverId: "user-456",
    approverIdentity: "1020304050",
    approverName: "Ana Pérez",
    approverEmail: "ana@example.com",
    role: "FINANCE",
  });
}

describe("Approval", () => {
  it("creates an approval in PENDING status", () => {
    const approval = createApproval();

    const snapshot = approval.toSnapshot();

    expectApprovalStatus(ApprovalStatus.PENDING, snapshot);

    expect(snapshot.decisionAt).toBeUndefined();
    expect(snapshot.cancelledAt).toBeUndefined();
  });

  it("signs a pending approval", () => {
    const approval = createApproval();

    approval.sign();

    const snapshot = approval.toSnapshot();

    expectApprovalStatus(ApprovalStatus.SIGNED, snapshot);
    expect(snapshot.decisionAt).toBeInstanceOf(Date);
    expect(snapshot.cancelledAt).toBeUndefined();
  });

  it("rejects a pending approval", () => {
    const approval = createApproval();

    approval.reject();

    const snapshot = approval.toSnapshot();

    expectApprovalStatus(ApprovalStatus.REJECTED, snapshot);
    expect(snapshot.decisionAt).toBeInstanceOf(Date);
    expect(snapshot.cancelledAt).toBeUndefined();
  });

  it("cancels a pending approval", () => {
    const approval = createApproval();
    approval.cancel();

    const snapshot = approval.toSnapshot();

    expectApprovalStatus(ApprovalStatus.CANCELLED, snapshot);
    expect(snapshot.decisionAt).toBeUndefined();
    expect(snapshot.cancelledAt).toBeInstanceOf(Date);
  });

  it("does not allow an approval to be signed twice", () => {
    const approval = createApproval();

    approval.sign();

    expect(() => approval.sign()).toThrow("Approval is not pending");
  });

  it("It does not allow a cancellation to be executed in a state other than PENDING.", () => {
    const approval = createApproval();

    approval.sign();

    expect(() => approval.cancel()).toThrow("Approval is not pending");
  });

  it("does not allow reject a non-pending approval", () => {
    const approval = createApproval();

    approval.sign();

    expect(() => approval.reject()).toThrow("Approval is not pending");
  });

  it("getters correct return verification", () => {
    const approval = createApproval();
    const snapshot = approval.toSnapshot();

    expect(approval.id).toBe(snapshot.id);
    expect(approval.requestId).toBe(snapshot.requestId);
    expect(approval.approverId).toBe(snapshot.approverId);
    expect(approval.status).toBe(ApprovalStatus.PENDING);
  });
});
