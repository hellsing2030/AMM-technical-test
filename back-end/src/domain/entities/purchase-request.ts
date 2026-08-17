import { randomUUID } from "node:crypto";
import { ApprovalStatus } from "../enums/approval-status";
import { RequestStatus } from "../enums/request-status";
import { Approval } from "./approval";
import type {
  CreatePurchaseRequestProps,
  PurchaseRequestProps,
  PurchaseRequestSnapshot,
} from "./types/purchase-request.interface";

export class PurchaseRequest {
  private constructor(private readonly props: PurchaseRequestProps) {}

  static create(input: CreatePurchaseRequestProps): PurchaseRequest {
    const title = required(input.title, "Title is required");
    const description = required(input.description, "Description is required");
    const requesterId = required(input.requesterId, "Requester id is required");
    const requesterIdentity = required(input.requesterIdentity, "Requester identity is required");
    const requesterName = required(input.requesterName, "Requester name is required");
    const requesterEmail = required(input.requesterEmail, "Requester email is required").toLowerCase();

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }
    if (input.approvers.length !== 3) {
      throw new Error("Exactly three approvers are required");
    }

    const normalizedApprovers = input.approvers.map((approver) => ({
      approverId: required(approver.approverId, "Approver id is required"),
      approverIdentity: required(approver.approverIdentity, "Approver identity is required"),
      approverName: required(approver.approverName, "Approver name is required"),
      approverEmail: required(approver.approverEmail, "Approver email is required").toLowerCase(),
      role: required(approver.role, "Approver role is required").toUpperCase(),
    }));

    if (new Set(normalizedApprovers.map((approver) => approver.approverId)).size !== 3) {
      throw new Error("Approvers must be different");
    }
    if (new Set(normalizedApprovers.map((approver) => approver.role)).size !== 3) {
      throw new Error("Approver roles must be different");
    }

    const id = randomUUID();
    const approvals = normalizedApprovers.map((approver) =>
      Approval.create({ requestId: id, ...approver }),
    );

    return new PurchaseRequest({
      id,
      requesterId,
      requesterIdentity,
      requesterName,
      requesterEmail,
      title,
      description,
      amount: input.amount,
      status: RequestStatus.PENDING,
      approvals,
      createdAt: new Date(),
    });
  }

  static restore(snapshot: PurchaseRequestSnapshot): PurchaseRequest {
    const { approvals, ...requestData } = snapshot;
    return new PurchaseRequest({
      ...requestData,
      approvals: approvals.map((approval) => Approval.restore(approval)),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get status(): RequestStatus {
    return this.props.status;
  }

  signApproval(approvalId: string): void {
    this.ensureIsPending();
    this.findApproval(approvalId).sign();
    if (this.hasAllApprovalsSigned()) this.props.status = RequestStatus.GENERATING_EVIDENCE;
  }

  rejectApproval(approvalId: string): void {
    this.ensureIsPending();
    this.findApproval(approvalId).reject();
    this.cancelPendingApprovals();
    this.props.status = RequestStatus.REJECTED;
    this.props.rejectedAt = new Date();
  }

  markEvidenceCompleted(evidenceKey: string): void {
    if (this.props.status !== RequestStatus.GENERATING_EVIDENCE) {
      throw new Error("Purchase request is not generating evidence");
    }
    this.props.evidenceKey = required(evidenceKey, "Evidence key is required");
    this.props.completedAt = new Date();
    this.props.status = RequestStatus.COMPLETED;
  }

  toSnapshot(): PurchaseRequestSnapshot {
    const { approvals, ...requestData } = this.props;
    return { ...requestData, approvals: approvals.map((approval) => approval.toSnapshot()) };
  }

  private findApproval(approvalId: string): Approval {
    const approval = this.props.approvals.find((item) => item.id === approvalId.trim());
    if (!approval) throw new Error("Approval not found");
    return approval;
  }

  private ensureIsPending(): void {
    if (this.props.status !== RequestStatus.PENDING) throw new Error("Purchase request is not pending");
  }

  private hasAllApprovalsSigned(): boolean {
    return this.props.approvals.every((approval) => approval.status === ApprovalStatus.SIGNED);
  }

  private cancelPendingApprovals(): void {
    this.props.approvals.forEach((approval) => {
      if (approval.status === ApprovalStatus.PENDING) approval.cancel();
    });
  }
}

function required(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}
