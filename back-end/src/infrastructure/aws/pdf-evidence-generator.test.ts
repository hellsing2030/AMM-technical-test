import { describe, expect, it } from "vitest";
import { PurchaseRequest } from "../../domain/entities/purchase-request";
import { PdfEvidenceGenerator } from "./pdf-evidence-generator";

describe("PdfEvidenceGenerator", () => {
  it("creates a valid PDF document", async () => {
    const request = PurchaseRequest.create({
      requesterId: "r1", requesterIdentity: "900", requesterName: "Sofía", requesterEmail: "sofia@example.com",
      title: "Equipos", description: "Compra anual", amount: 1000,
      approvers: [
        { approverId: "u1", approverIdentity: "1", approverName: "Ana", approverEmail: "a@example.com", role: "FINANCE" },
        { approverId: "u2", approverIdentity: "2", approverName: "Bruno", approverEmail: "b@example.com", role: "LEGAL" },
        { approverId: "u3", approverIdentity: "3", approverName: "Carla", approverEmail: "c@example.com", role: "OPERATIONS" },
      ],
    });
    request.toSnapshot().approvals.forEach((approval) => request.signApproval(approval.id));
    const bytes = await new PdfEvidenceGenerator().generate(request.toSnapshot());
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain("%PDF");
    expect(bytes.length).toBeGreaterThan(500);
  });
});
