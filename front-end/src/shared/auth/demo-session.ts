import type { User } from "../api/types";

export type ActorType = "REQUESTER" | "APPROVER";

export interface DemoSession {
  actorType: ActorType;
  user: User;
}

export const DEMO_REQUESTER: User = {
  id: "requester-demo",
  identity: "900100200",
  name: "Solicitante Demo",
  email: "solicitante@amm.demo",
  role: "REQUESTER",
};

const STORAGE_KEY = "amm-demo-session-v1";

export function getDemoSession(storage: Storage = window.localStorage): DemoSession | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<DemoSession>;
    if (
      (value.actorType !== "REQUESTER" && value.actorType !== "APPROVER")
      || !value.user
      || typeof value.user.id !== "string"
      || typeof value.user.name !== "string"
      || typeof value.user.email !== "string"
      || typeof value.user.role !== "string"
    ) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return value as DemoSession;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveDemoSession(session: DemoSession, storage: Storage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearDemoSession(storage: Storage = window.localStorage): void {
  storage.removeItem(STORAGE_KEY);
}

export function homeFor(session: DemoSession): string {
  return session.actorType === "REQUESTER" ? "/requests" : "/approvals";
}
