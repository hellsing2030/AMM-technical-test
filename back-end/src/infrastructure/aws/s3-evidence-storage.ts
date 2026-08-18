import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { EvidenceStorage } from "../../application/ports";

export class S3EvidenceStorage implements EvidenceStorage {
  constructor(private readonly client: S3Client, private readonly bucketName: string) {}

  async put(key: string, bytes: Uint8Array): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName, Key: key, Body: bytes, ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
    }));
  }

  getDownloadUrl(key: string): Promise<string> {
    const fileName = key.split("/").at(-1) || "evidencia.pdf";
    return getSignedUrl(this.client, new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
      ResponseContentType: "application/pdf",
    }), { expiresIn: 60 });
  }
}
