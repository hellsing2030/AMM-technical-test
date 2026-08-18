import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z, ZodError } from "zod";
import { ApplicationError, UnauthorizedError } from "../../application/errors";
import { PurchaseApprovalService } from "../../application/purchase-approval-service";
import { createService } from "../../bootstrap/create-service";

const approverSchema = z.object({
  approverId: z.string().min(1), approverIdentity: z.string().min(1), approverName: z.string().min(1),
  approverEmail: z.string().email(), role: z.string().min(1),
});
const createRequestSchema = z.object({
  requesterId: z.string().min(1), requesterIdentity: z.string().min(1), requesterName: z.string().min(1),
  requesterEmail: z.string().email(), title: z.string().min(1), description: z.string().min(1),
  amount: z.number().positive(), approvers: z.array(approverSchema).length(3),
});
const tokenSchema = z.object({ token: z.string().min(1) });
const otpSchema = z.object({ token: z.string().min(1), otp: z.string().regex(/^\d{6}$/) });
const decisionSchema = z.object({ sessionId: z.string().min(1), decision: z.enum(["APPROVE", "REJECT"]) });

const DEMO_USERS = [
  { id: "approver-finance", identity: "10010001", name: "Ana Finanzas", email: "ana.finanzas@amm.demo", role: "FINANCE" },
  { id: "approver-operations", identity: "10010002", name: "Carlos Operaciones", email: "carlos.operaciones@amm.demo", role: "OPERATIONS" },
  { id: "approver-management", identity: "10010003", name: "María Gerencia", email: "maria.gerencia@amm.demo", role: "MANAGEMENT" },
  { id: "approver-legal", identity: "10010004", name: "Luis Legal", email: "luis.legal@amm.demo", role: "LEGAL" },
  { id: "approver-procurement", identity: "10010005", name: "Laura Compras", email: "laura.compras@amm.demo", role: "PROCUREMENT" },
];

type HttpHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

export function createHttpHandler(service: PurchaseApprovalService): HttpHandler {
  return async (event) => {
    const method = event.httpMethod.toUpperCase();
    const path = normalizePath(event.path);
    if (method === "OPTIONS") return response(204, undefined);

    try {
      if (method === "GET" && path === "/health") return response(200, { status: "ok", timestamp: new Date().toISOString() });
      if (method === "GET" && path === "/users") return response(200, DEMO_USERS);
      if (method === "POST" && path === "/requests") {
        const input = createRequestSchema.parse(parseBody(event));
        assertRequester(event, input.requesterId);
        return response(201, await service.createRequest(input));
      }
      if (method === "GET" && path === "/requests") {
        return response(200, await service.listRequests(requireRequester(event)));
      }
      const evidenceMatch = path.match(/^\/requests\/([^/]+)\/evidence\.pdf$/);
      if (method === "GET" && evidenceMatch?.[1]) {
        const url = await service.getEvidenceUrl(decodeURIComponent(evidenceMatch[1]), requireRequester(event));
        return response(200, { url, expiresInSeconds: 60 });
      }
      const requestMatch = path.match(/^\/requests\/([^/]+)$/);
      if (method === "GET" && requestMatch?.[1]) {
        return response(200, await service.getRequest(decodeURIComponent(requestMatch[1]), requireRequester(event)));
      }
      if (method === "POST" && path === "/approvals/request-otp") {
        const input = tokenSchema.parse(parseBody(event));
        await service.requestOtp(input.token);
        return response(200, { success: true });
      }
      if (method === "POST" && path === "/approvals/validate-otp") {
        const input = otpSchema.parse(parseBody(event));
        return response(200, await service.validateOtp(input.token, input.otp));
      }
      if (method === "POST" && path === "/approvals/decision") {
        const input = decisionSchema.parse(parseBody(event));
        return response(200, await service.submitDecision(input.sessionId, input.decision));
      }
      if (method === "GET" && path === "/mock-mail" && process.env.ENABLE_MOCK_MAIL !== "false") {
        return response(200, await service.listMockMail());
      }
      return response(404, { message: "Route not found" });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

let service: PurchaseApprovalService | undefined;
export const handler: HttpHandler = (event) => {
  service ??= createService();
  return createHttpHandler(service)(event);
};

function parseBody(event: APIGatewayProxyEvent): unknown {
  if (!event.body) return {};
  try { return JSON.parse(event.body) as unknown; }
  catch { throw new ApplicationError("Request body must be valid JSON", 400); }
}

function requireRequester(event: APIGatewayProxyEvent): string {
  const id = header(event, "x-requester-id")?.trim();
  if (!id) throw new UnauthorizedError("x-requester-id header is required");
  return id;
}

function assertRequester(event: APIGatewayProxyEvent, bodyRequesterId: string): void {
  if (requireRequester(event) !== bodyRequesterId.trim()) throw new UnauthorizedError("Requester identity does not match request body");
}

function header(event: APIGatewayProxyEvent, name: string): string | undefined {
  const entry = Object.entries(event.headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1] ?? undefined;
}

function normalizePath(path: string): string {
  const normalized = path.replace(/^\/Prod(?=\/)/, "").replace(/\/$/, "");
  return normalized || "/";
}

function response(statusCode: number, payload: unknown): APIGatewayProxyResult {
  return {
    statusCode, headers: { ...corsHeaders(), "Content-Type": "application/json" },
    body: payload === undefined ? "" : JSON.stringify(payload),
  };
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Requester-Id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

function errorResponse(error: unknown): APIGatewayProxyResult {
  if (error instanceof ApplicationError) return response(error.statusCode, { message: error.message });
  if (error instanceof ZodError) return response(400, { message: "Request validation failed", issues: error.issues });
  if (error instanceof Error && [
    "Title is required", "Description is required", "Amount must be greater than zero",
    "Exactly three approvers are required", "Approvers must be different", "Approver roles must be different",
  ].includes(error.message)) return response(400, { message: error.message });
  if (error instanceof Error && /not pending|not generating|Approval not found/.test(error.message)) {
    return response(409, { message: error.message });
  }
  console.error(JSON.stringify({ kind: "TECHNICAL_ERROR", message: error instanceof Error ? error.message : "Unknown error" }));
  return response(500, { message: "Internal server error" });
}
