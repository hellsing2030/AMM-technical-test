import { randomUUID } from "node:crypto";
import { ApprovalStatus } from "../enums/approval-status";
import {
  ApprovalSnapshot,
  CreateApprovalProps,
} from "./types/approval.interfaces";

export class Approval {
  private constructor(private readonly props: ApprovalSnapshot) {}

  static create(input: CreateApprovalProps): Approval {
    return new Approval({
      ...input,
      id: randomUUID(),
      status: ApprovalStatus.PENDING,
      createdAt: new Date(),
    });
  }

  static restore(snapshot: ApprovalSnapshot): Approval {
    return new Approval({ ...snapshot });
  }

  get id(): string {
    return this.props.id;
  }

  get requestId(): string {
    return this.props.requestId;
  }

  get approverId(): string {
    return this.props.approverId;
  }

  get status(): ApprovalStatus {
    return this.props.status;
  }

  sign(): void {
    this.ensureIsPending();

    this.props.status = ApprovalStatus.SIGNED;
    this.props.decisionAt = new Date();
  }

  reject(): void {
    this.ensureIsPending();

    this.props.status = ApprovalStatus.REJECTED;
    this.props.decisionAt = new Date();
  }

  cancel(): void {
    this.ensureIsPending();

    this.props.status = ApprovalStatus.CANCELLED;
    this.props.cancelledAt = new Date();
  }

  toSnapshot(): ApprovalSnapshot {
    return {
      ...this.props,
    };
  }

  private ensureIsPending(): void {
    if (this.props.status !== ApprovalStatus.PENDING) {
      throw new Error("Approval is not pending");
    }
  }
}
