import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { SecurityService } from "../../application/ports";

export class CryptoSecurityService implements SecurityService {
  constructor(private readonly pepper: string) {
    if (!pepper.trim()) throw new Error("TOKEN_PEPPER is required");
  }

  generateToken(): string {
    return randomBytes(32).toString("base64url");
  }

  generateOtp(): string {
    return String(randomInt(100000, 1000000));
  }

  hash(value: string): string {
    return createHash("sha256").update(`${this.pepper}:${value}`).digest("hex");
  }

  matches(value: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(value), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
