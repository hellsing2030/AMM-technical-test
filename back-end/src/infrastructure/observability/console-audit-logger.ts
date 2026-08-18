import type { AuditLogger } from "../../application/ports";

export class ConsoleAuditLogger implements AuditLogger {
  log(event: string, data: Record<string, unknown>): void {
    console.info(JSON.stringify({ kind: "AUDIT", event, at: new Date().toISOString(), ...data }));
  }
}

export const systemClock = { now: () => new Date() };
