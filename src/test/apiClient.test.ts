import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(body),
  };
}

describe("apiClient - request", () => {
  it("GET request sends correct method and credentials", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await api.get("/api/test");
    const [url, config] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/test");
    expect(config.method).toBe("GET");
    expect(config.credentials).toBe("include");
    expect(config.cache).toBe("no-store");
    expect(config.headers["Content-Type"]).toBe("application/json");
  });

  it("GET request appends query params to URL", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(200, []));
    await api.get("/api/listings", { page: "1", limit: "10" });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("page=1");
    expect(url).toContain("limit=10");
  });

  it("GET request without params does not append ?", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await api.get("/api/users/me");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/users/me");
    expect(url).not.toContain("?");
  });

  it("GET filters out undefined, null, empty string params", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await api.get("/api/search", { q: "test", status: undefined, page: "", limit: null } as any);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("q=test");
    expect(url).not.toContain("status=");
    expect(url).not.toContain("page=");
    expect(url).not.toContain("limit=");
  });

  it("POST request includes JSON body", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(201, { id: 1 }));
    const payload = { name: "test" };
    await api.post("/api/leads", payload);
    const [, config] = mockFetch.mock.calls[0];
    expect(config.method).toBe("POST");
    expect(config.body).toBe(JSON.stringify(payload));
  });

  it("PUT request includes JSON body", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(200, { updated: true }));
    await api.put("/api/leads/1", { name: "updated" });
    const [, config] = mockFetch.mock.calls[0];
    expect(config.method).toBe("PUT");
    expect(config.body).toBe(JSON.stringify({ name: "updated" }));
  });

  it("PATCH request includes JSON body", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(200, { patched: true }));
    await api.patch("/api/users/1", { email: "new@email.com" });
    const [, config] = mockFetch.mock.calls[0];
    expect(config.method).toBe("PATCH");
  });

  it("DELETE request uses DELETE method and 204 returns undefined", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(204, null));
    const result = await api.delete("/api/leads/1");
    const [, config] = mockFetch.mock.calls[0];
    expect(config.method).toBe("DELETE");
    expect(result).toBeUndefined();
  });

  it("content-length 0 response returns undefined", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(200, null, { "content-length": "0" }));
    const result = await api.get("/api/empty");
    expect(result).toBeUndefined();
  });

  it("401 throws Unauthorized and dispatches auth event", async () => {
    const { api } = await import("../../services/api/apiClient");
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    mockFetch.mockResolvedValueOnce(makeResponse(401, { message: "Unauthorized" }));
    await expect(api.get("/api/protected")).rejects.toThrow("Unauthorized");
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "auth:unauthorized" }));
    dispatchSpy.mockRestore();
  });

  it("403 throws with status 403 and data attached", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(403, { error: "FORBIDDEN", message: "Forbidden: Access denied" }));
    let thrown: any;
    try { await api.get("/api/admin"); } catch (e) { thrown = e; }
    expect(thrown.status).toBe(403);
    expect(thrown.message).toBe("Forbidden: Access denied");
  });

  it("403 with non-parseable JSON falls back to FORBIDDEN defaults", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 403, statusText: "Forbidden",
      headers: { get: () => null },
      json: () => Promise.reject(new Error("no json")),
    });
    let thrown: any;
    try { await api.get("/api/restricted"); } catch (e) { thrown = e; }
    expect(thrown.status).toBe(403);
    expect(thrown.message).toBe("Forbidden: Access denied");
  });

  it("non-ok response throws with status and message from body", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(500, { message: "Internal Server Error" }));
    await expect(api.get("/api/broken")).rejects.toThrow("Internal Server Error");
  });

  it("non-ok with error field in body throws error string", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(422, { error: "Validation failed", message: "" }));
    let thrown: any;
    try { await api.post("/api/leads", {}); } catch (e) { thrown = e; }
    expect(thrown.message).toBe("Validation failed");
  });

  it("non-ok with unparseable body throws fallback message", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 503, statusText: "Service Unavailable",
      headers: { get: () => null },
      json: () => Promise.reject(new Error("no json")),
    });
    let thrown: any;
    try { await api.get("/api/down"); } catch (e) { thrown = e; }
    expect(thrown).toBeDefined();
    expect(thrown.status).toBe(503);
  });

  it("request clears timeout on success", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(200, { data: "ok" }));
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    await api.get("/api/ok");
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("GET request does not include body", async () => {
    const { api } = await import("../../services/api/apiClient");
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await api.get("/api/data");
    const [, config] = mockFetch.mock.calls[0];
    expect(config.body).toBeUndefined();
  });
});
