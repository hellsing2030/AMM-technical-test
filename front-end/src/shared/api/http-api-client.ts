import { ApiError } from "./api-error";
import type {
  ApiClient,
  ApprovalAccess,
  CreatePurchaseRequestInput,
  Decision,
  MockMail,
  PurchaseRequestView,
  User,
} from "./types";

interface ErrorPayload {
  message?: string;
}

export class HttpApiClient implements ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly requesterId = "requester-demo",
  ) {}

  listApprovers(): Promise<User[]> {
    return this.request<User[]>("/users?role=APPROVER");
  }

  createRequest(input: CreatePurchaseRequestInput): Promise<PurchaseRequestView> {
    return this.request<PurchaseRequestView>("/requests", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  listRequests(): Promise<PurchaseRequestView[]> {
    return this.request<PurchaseRequestView[]>("/requests");
  }

  getRequest(requestId: string): Promise<PurchaseRequestView> {
    return this.request<PurchaseRequestView>(`/requests/${encodeURIComponent(requestId)}`);
  }

  async requestOtp(token: string): Promise<void> {
    await this.request<{ success: boolean }>("/approvals/request-otp", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  validateOtp(token: string, otp: string): Promise<ApprovalAccess> {
    return this.request<ApprovalAccess>("/approvals/validate-otp", {
      method: "POST",
      body: JSON.stringify({ token, otp }),
    });
  }

  submitDecision(sessionId: string, decision: Decision): Promise<PurchaseRequestView> {
    return this.request<PurchaseRequestView>("/approvals/decision", {
      method: "POST",
      body: JSON.stringify({ sessionId, decision }),
    });
  }

  listMockMail(): Promise<MockMail[]> {
    return this.request<MockMail[]>("/mock-mail");
  }

  async downloadEvidence(requestId: string): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/requests/${encodeURIComponent(requestId)}/evidence.pdf`,
      { headers: { Accept: "application/pdf", "X-Requester-Id": this.requesterId } },
    );

    if (!response.ok) {
      throw new ApiError("No fue posible descargar la evidencia", response.status);
    }

    return response.blob();
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requester-Id": this.requesterId,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      let payload: ErrorPayload = {};
      try {
        payload = (await response.json()) as ErrorPayload;
      } catch {
        // The API can return an empty or non-JSON error response.
      }

      throw new ApiError(payload.message || "La operación no pudo completarse", response.status);
    }

    return (await response.json()) as T;
  }
}
