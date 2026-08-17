import { ApprovalStatus } from "../../enums/approval-status";

export interface CreateApprovalProps {
  requestId: string;
  approverId: string;
  approverIdentity: string;
  approverName: string;
  approverEmail: string;
  role: string;
}

export interface ApprovalSnapshot extends CreateApprovalProps {
  id: string;
  status: ApprovalStatus;
  createdAt: Date;
  decisionAt?: Date;
  cancelledAt?: Date;
}
