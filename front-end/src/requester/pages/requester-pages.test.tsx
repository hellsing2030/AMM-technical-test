import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MockMail, PurchaseRequestView, User } from "../../shared/api/types";
import { CreateRequestPage } from "./CreateRequestPage";
import { MockMailPage } from "./MockMailPage";
import { RequestDetailPage } from "./RequestDetailPage";
import { RequestListPage } from "./RequestListPage";

const apiMock = vi.hoisted(() => ({
  listApprovers: vi.fn(),
  createRequest: vi.fn(),
  listRequests: vi.fn(),
  getRequest: vi.fn(),
  downloadEvidence: vi.fn(),
  listMockMail: vi.fn(),
}));

vi.mock("../../shared/api", () => ({
  apiClient: apiMock,
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : "Error inesperado"),
}));

const users: User[] = [
  { id: "u1", identity: "1", name: "Ana", email: "ana@test.com", role: "FINANCE" },
  { id: "u2", identity: "2", name: "Bruno", email: "bruno@test.com", role: "LEGAL" },
  { id: "u3", identity: "3", name: "Carla", email: "carla@test.com", role: "OPERATIONS" },
];

const request: PurchaseRequestView = {
  id: "request-1",
  requesterId: "requester-demo",
  requesterIdentity: "900",
  requesterName: "Solicitante Demo",
  requesterEmail: "requester@test.com",
  title: "Compra de portátiles",
  description: "Equipos para ingeniería",
  amount: 9_000_000,
  status: "PENDING",
  createdAt: "2026-08-17T12:00:00.000Z",
  approvals: users.map((person, index) => ({
    id: `a${index}`,
    approverId: person.id,
    approverIdentity: person.identity,
    approverName: person.name,
    approverEmail: person.email,
    role: person.role,
    status: "PENDING",
    createdAt: "2026-08-17T12:00:00.000Z",
  })),
};

describe("requester pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.listApprovers.mockResolvedValue(users);
    apiMock.listRequests.mockResolvedValue([request]);
    apiMock.getRequest.mockResolvedValue(request);
    apiMock.createRequest.mockResolvedValue(request);
  });

  it("lists requests and links to their detail", async () => {
    render(<MemoryRouter><RequestListPage /></MemoryRouter>);
    expect(await screen.findByText("Compra de portátiles")).toBeInTheDocument();
    expect(screen.getByText(/9\.000\.000/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver detalle/i })).toHaveAttribute("href", "/requests/request-1");
  });

  it("creates a request with three different approvers", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/requests/new"]}>
        <Routes>
          <Route path="/requests/new" element={<CreateRequestPage />} />
          <Route path="/requests/:id" element={<p>Solicitud creada</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findAllByRole("option", { name: /Ana/ })).toHaveLength(3);
    await user.type(screen.getByLabelText("Título"), "Compra de portátiles");
    await user.type(screen.getByLabelText("Descripción"), "Equipos para ingeniería");
    await user.type(screen.getByLabelText("Monto en COP"), "9000000");
    await user.selectOptions(screen.getByLabelText("Aprobador 1"), "u1");
    await user.selectOptions(screen.getByLabelText("Aprobador 2"), "u2");
    await user.selectOptions(screen.getByLabelText("Aprobador 3"), "u3");
    await user.click(screen.getByRole("button", { name: "Crear y notificar" }));

    await waitFor(() => expect(apiMock.createRequest).toHaveBeenCalledOnce());
    expect(await screen.findByText("Solicitud creada")).toBeInTheDocument();
    expect(apiMock.createRequest.mock.calls[0]?.[0].approvers).toHaveLength(3);
  });

  it("shows request detail and hides evidence until completion", async () => {
    render(
      <MemoryRouter initialEntries={["/requests/request-1"]}>
        <Routes><Route path="/requests/:requestId" element={<RequestDetailPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Equipos para ingeniería")).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /descargar evidencia/i })).not.toBeInTheDocument();
  });

  it("renders invitation and OTP messages from mock mail", async () => {
    const mails: MockMail[] = [
      { id: "m1", to: "ana@test.com", subject: "Código OTP", body: "Válido 3 minutos", type: "OTP", otp: "123456", sentAt: "2026-08-17T12:00:00.000Z" },
      { id: "m2", to: "bruno@test.com", subject: "Invitación", body: "Aprueba", type: "INVITATION", link: "/approve?token=abc", sentAt: "2026-08-17T12:00:00.000Z" },
    ];
    apiMock.listMockMail.mockResolvedValue(mails);
    render(<MemoryRouter><MockMailPage /></MemoryRouter>);

    expect(await screen.findByText("123456")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir solicitud" })).toHaveAttribute("href", "/approve?token=abc");
  });
});
