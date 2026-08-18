import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PurchaseApprovalService } from "../application/purchase-approval-service";
import { DynamoBackend } from "../infrastructure/aws/dynamo-backend";
import { PdfEvidenceGenerator } from "../infrastructure/aws/pdf-evidence-generator";
import { S3EvidenceStorage } from "../infrastructure/aws/s3-evidence-storage";
import { ConsoleAuditLogger, systemClock } from "../infrastructure/observability/console-audit-logger";
import { CryptoSecurityService } from "../infrastructure/security/crypto-security-service";

export function createService(): PurchaseApprovalService {
  const tableName = requiredEnvironment("TABLE_NAME");
  const bucketName = requiredEnvironment("EVIDENCE_BUCKET");
  const pepper = requiredEnvironment("TOKEN_PEPPER");
  const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const dynamo = new DynamoBackend(documentClient, tableName);

  return new PurchaseApprovalService({
    requests: dynamo.requests,
    tokens: dynamo.tokens,
    sessions: dynamo.sessions,
    mails: dynamo.mails,
    evidenceGenerator: new PdfEvidenceGenerator(),
    evidenceStorage: new S3EvidenceStorage(new S3Client({}), bucketName),
    security: new CryptoSecurityService(pepper),
    clock: systemClock,
    audit: new ConsoleAuditLogger(),
    approverAppUrl: process.env.APPROVER_APP_URL ?? "http://localhost:3000",
  });
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}
