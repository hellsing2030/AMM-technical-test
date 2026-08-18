export type RequestStatus =
  | "PENDING"
  | "GENERATING_EVIDENCE"
  | "COMPLETED"
  | "REJECTED";

export type ApprovalStatus = "PENDING" | "SIGNED" | "REJECTED" | "CANCELLED";
export type Decision = "APPROVE" | "REJECT";

export interface User {
  id: string;
  identity: string;
  name: string;
  email: string;
  role: string;
}

export interface ApprovalView {
  id: string;
  approverId: string;
  approverIdentity: string;
  approverName: string;
  approverEmail: string;
  role: string;
  status: ApprovalStatus;
  createdAt: string;
  decisionAt?: string;
  cancelledAt?: string;
}

export interface PurchaseRequestView {
  id: string;
  requesterId: string;
  requesterIdentity: string;
  requesterName: string;
  requesterEmail: string;
  title: string;
  description: string;
  amount: number;
  status: RequestStatus;
  approvals: ApprovalView[];
  createdAt: string;
  evidenceKey?: string;
  completedAt?: string;
  rejectedAt?: string;
}

export interface SelectedApproverInput {
  approverId: string;
  approverIdentity: string;
  approverName: string;
  approverEmail: string;
  role: string;
}

export interface CreatePurchaseRequestInput {
  requesterId: string;
  requesterIdentity: string;
  requesterName: string;
  requesterEmail: string;
  title: string;
  description: string;
  amount: number;
  approvers: SelectedApproverInput[];
}

export interface ApprovalAccess {
  sessionId: string;
  request: PurchaseRequestView;
  approvalId: string;
  expiresAt: string;
}

export interface MockMail {
  id: string;
  to: string;
  subject: string;
  body: string;
  type: "INVITATION" | "OTP";
  sentAt: string;
  link?: string;
  otp?: string;
}

export type EvidenceDownload =
  | { kind: "url"; url: string; fileName: string }
  | { kind: "blob"; blob: Blob; fileName: string };

export interface ApiClient {
  listApprovers(): Promise<User[]>;
  createRequest(input: CreatePurchaseRequestInput): Promise<PurchaseRequestView>;
  listRequests(): Promise<PurchaseRequestView[]>;
  getRequest(requestId: string): Promise<PurchaseRequestView>;
  requestOtp(token: string): Promise<void>;
  validateOtp(token: string, otp: string): Promise<ApprovalAccess>;
  submitDecision(sessionId: string, decision: Decision): Promise<PurchaseRequestView>;
  listMockMail(): Promise<MockMail[]>;
  downloadEvidence(requestId: string): Promise<EvidenceDownload>;
}
