import { RequestStatus } from "../../enums/request-status";
import { Approval } from "../approval";
import { ApprovalSnapshot } from "./approval.interfaces";

export interface SelectedApprover {
  approverId: string;
  approverIdentity: string;
  approverName: string;
  approverEmail: string;
  role: string;
}

export interface CreatePurchaseRequestProps {
  requesterId: string;
  requesterIdentity: string;
  requesterName: string;
  requesterEmail: string;
  title: string;
  description: string;
  amount: number;
  approvers: SelectedApprover[];
}

export interface PurchaseRequestProps {
  id: string;

  requesterId: string;
  requesterIdentity: string;
  requesterName: string;
  requesterEmail: string;

  title: string;
  description: string;
  amount: number;

  status: RequestStatus;
  approvals: Approval[];

  createdAt: Date;

  evidenceKey?: string;
  completedAt?: Date;
  rejectedAt?: Date;
}

export interface PurchaseRequestSnapshot {
  id: string;

  requesterId: string;
  requesterIdentity: string;
  requesterName: string;
  requesterEmail: string;

  title: string;
  description: string;
  amount: number;

  status: RequestStatus;
  approvals: ApprovalSnapshot[];

  createdAt: Date;

  evidenceKey?: string;
  completedAt?: Date;
  rejectedAt?: Date;
}
