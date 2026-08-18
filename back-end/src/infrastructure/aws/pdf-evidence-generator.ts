import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EvidenceGenerator } from "../../application/ports";
import type { PurchaseRequestSnapshot } from "../../domain/entities/types/purchase-request.interface";

export class PdfEvidenceGenerator implements EvidenceGenerator {
  async generate(snapshot: PurchaseRequestSnapshot): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const page = document.addPage([612, 792]);
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    let y = 740;

    page.drawText("Evidencia de aprobación de compra", { x: 48, y, size: 18, font: bold, color: rgb(0.09, 0.14, 0.24) });
    y -= 38;
    const lines = [
      `Solicitud: ${snapshot.title}`, `ID: ${snapshot.id}`, `Solicitante: ${snapshot.requesterName}`,
      `Monto: COP ${snapshot.amount.toLocaleString("es-CO")}`, `Estado: ${snapshot.status}`,
      `Creada: ${snapshot.createdAt.toISOString()}`, "", "Aprobaciones:",
      ...snapshot.approvals.map((approval) =>
        `${approval.approverName} | ${approval.role} | ${approval.status} | ${approval.decisionAt?.toISOString() ?? "sin fecha"}`,
      ),
    ];
    for (const line of lines) {
      for (const part of wrap(line, 88)) {
        page.drawText(part, { x: 48, y, size: 10, font: line === "Aprobaciones:" ? bold : regular, color: rgb(0.12, 0.16, 0.24) });
        y -= 17;
      }
    }
    return document.save();
  }
}

function wrap(text: string, maxLength: number): string[] {
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxLength) {
      lines.push(current); current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines;
}
