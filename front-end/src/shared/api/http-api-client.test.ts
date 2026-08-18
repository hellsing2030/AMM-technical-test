import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpApiClient } from "./http-api-client";

describe("HttpApiClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends JSON requests to the configured API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "u1" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new HttpApiClient("https://api.example.com");

    await expect(client.listApprovers()).resolves.toEqual([{ id: "u1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/users?role=APPROVER",
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/json" }) }),
    );
  });

  it("surfaces API messages and downloads evidence", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "No autorizado" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://evidence.example/signed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new HttpApiClient("/api");

    await expect(client.listRequests()).rejects.toThrow("No autorizado");
    await expect(client.downloadEvidence("r/1")).resolves.toEqual({
      kind: "url",
      url: "https://evidence.example/signed",
      fileName: "evidencia-r-1.pdf",
    });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/requests/r%2F1/evidence.pdf", expect.any(Object));
  });
});
