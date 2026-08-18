import { describe, expect, it } from "vitest";
import {
  clearDemoSession,
  DEMO_REQUESTER,
  getDemoSession,
  homeFor,
  saveDemoSession,
  type DemoSession,
} from "./demo-session";

describe("demo session", () => {
  it("stores, restores and clears a requester session", () => {
    const session: DemoSession = { actorType: "REQUESTER", user: DEMO_REQUESTER };
    saveDemoSession(session);

    expect(getDemoSession()).toEqual(session);
    expect(homeFor(session)).toBe("/requests");

    clearDemoSession();
    expect(getDemoSession()).toBeNull();
  });

  it("rejects malformed storage and routes approvers to their dashboard", () => {
    window.localStorage.setItem("amm-demo-session-v1", "not-json");
    expect(getDemoSession()).toBeNull();

    const approver: DemoSession = {
      actorType: "APPROVER",
      user: { id: "a1", identity: "1", name: "Ana", email: "ana@test.com", role: "FINANCE" },
    };
    expect(homeFor(approver)).toBe("/approvals");
  });
});
