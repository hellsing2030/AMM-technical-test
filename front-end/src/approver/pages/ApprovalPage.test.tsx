import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalAccess, PurchaseRequestView } from "../../shared/api/types";
import { ApprovalPage } from "./ApprovalPage";

const apiMock = vi.hoisted(() => ({
  requestOtp: vi.fn(),
  validateOtp: vi.fn(),
  submitDecision: vi.fn(),
}));

vi.mock("../../shared/api", () => ({
  apiClient: apiMock,
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : "Error inesperado"),
}));

const request: PurchaseRequestView = {
  id: "r1",
  requesterId: "requester",
  requesterIdentity: "900",
  requesterName: "Sofía",
  requesterEmail: "sofia@test.com",
  title: "Licencias de software",
  description: "Renovación anual",
  amount: 3_500_000,
  status: "PENDING",
  createdAt: "2026-08-17T12:00:00.000Z",
  approvals: [{
    id: "a1",
    approverId: "u1",
    approverIdentity: "1",
    approverName: "Ana",
    approverEmail: "ana@test.com",
    role: "FINANCE",
    status: "PENDING",
    createdAt: "2026-08-17T12:00:00.000Z",
  }],
};

const access: ApprovalAccess = {
  sessionId: "session-1",
  request,
  approvalId: "a1",
  expiresAt: "2026-08-17T12:10:00.000Z",
};

describe("ApprovalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.requestOtp.mockResolvedValue(undefined);
    apiMock.validateOtp.mockResolvedValue(access);
    apiMock.submitDecision.mockResolvedValue({ ...request, status: "COMPLETED" });
  });

  it("keeps purchase data hidden until OTP validation and submits approval", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/approve?token=secure-token"]}><ApprovalPage /></MemoryRouter>);

    expect(screen.queryByText("Licencias de software")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Solicitar OTP" }));
    await user.type(await screen.findByLabelText("Código de seis dígitos"), "123456");
    await user.click(screen.getByRole("button", { name: "Validar y ver detalle" }));

    expect(await screen.findByText("Licencias de software")).toBeInTheDocument();
    expect(screen.getByText("Renovación anual")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aprobar compra" }));

    await waitFor(() => expect(apiMock.submitDecision).toHaveBeenCalledWith("session-1", "APPROVE"));
    expect(await screen.findByText(/decisión fue registrada/i)).toBeInTheDocument();
  });

  it("rejects malformed OTP without calling the API", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/approve?token=secure-token"]}><ApprovalPage /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Solicitar OTP" }));
    await user.type(await screen.findByLabelText("Código de seis dígitos"), "123");

    expect(screen.getByRole("button", { name: "Validar y ver detalle" })).toBeDisabled();
    expect(apiMock.validateOtp).not.toHaveBeenCalled();
  });

  it("does not expose a decision form when the token is missing", () => {
    render(<MemoryRouter initialEntries={["/approve"]}><ApprovalPage /></MemoryRouter>);
    expect(screen.getByText("Falta el token de aprobación")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Solicitar OTP" })).not.toBeInTheDocument();
  });
});
