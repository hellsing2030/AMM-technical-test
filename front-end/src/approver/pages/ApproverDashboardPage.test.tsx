import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveDemoSession } from "../../shared/auth/demo-session";
import type { MockMail } from "../../shared/api/types";
import { ApproverDashboardPage } from "./ApproverDashboardPage";

const apiMock = vi.hoisted(() => ({ listMockMail: vi.fn() }));

vi.mock("../../shared/api", () => ({
  apiClient: apiMock,
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : "Error inesperado"),
}));

const mails: MockMail[] = [
  {
    id: "invite-ana",
    to: "ana@test.com",
    subject: "Solicitud de aprobación: Portátiles",
    body: "Tienes una compra pendiente.",
    type: "INVITATION",
    sentAt: "2026-08-17T12:00:00.000Z",
    link: "/approve?token=ana-token",
  },
  {
    id: "otp-ana",
    to: "ana@test.com",
    subject: "Código OTP",
    body: "Válido durante tres minutos.",
    type: "OTP",
    sentAt: "2026-08-17T12:01:00.000Z",
    otp: "123456",
  },
  {
    id: "invite-bruno",
    to: "bruno@test.com",
    subject: "Solicitud de aprobación: Servidores",
    body: "Otra compra.",
    type: "INVITATION",
    sentAt: "2026-08-17T12:00:00.000Z",
    link: "/approve?token=bruno-token",
  },
];

describe("ApproverDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveDemoSession({
      actorType: "APPROVER",
      user: { id: "ana", identity: "1", name: "Ana", email: "ana@test.com", role: "FINANCE" },
    });
    apiMock.listMockMail.mockResolvedValue(mails);
  });

  it("shows only the signed-in approver invitations and OTPs", async () => {
    render(<MemoryRouter><ApproverDashboardPage /></MemoryRouter>);

    expect(await screen.findByText("Solicitud de aprobación: Portátiles")).toBeInTheDocument();
    expect(screen.getByText("123456")).toBeInTheDocument();
    expect(screen.queryByText("Solicitud de aprobación: Servidores")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir aprobación" })).toHaveAttribute("href", "/approve?token=ana-token");
  });

  it("refreshes the approver inbox", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ApproverDashboardPage /></MemoryRouter>);
    await screen.findByText("Solicitud de aprobación: Portátiles");
    await user.click(screen.getByRole("button", { name: "Actualizar bandeja" }));
    expect(apiMock.listMockMail).toHaveBeenCalledTimes(2);
  });
});
