import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const req = (path: string, secret?: string) =>
  new NextRequest(`http://localhost:3000${path}`, secret === undefined ? {} : { headers: { "x-internal-secret": secret } });

const isPassThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

afterEach(() => vi.unstubAllEnvs());

describe("middleware", () => {
  it("rejects API calls with no header when a secret is configured", async () => {
    vi.stubEnv("INTERNAL_SECRET", "s3cret");
    const res = middleware(req("/api/pages"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects API calls with the wrong secret", () => {
    vi.stubEnv("INTERNAL_SECRET", "s3cret");
    expect(middleware(req("/api/settings", "nope")).status).toBe(401);
  });

  it("allows API calls with the right secret", () => {
    vi.stubEnv("INTERNAL_SECRET", "s3cret");
    expect(isPassThrough(middleware(req("/api/ai", "s3cret")))).toBe(true);
  });

  it("protects the new settings and ai routes like every other route", () => {
    vi.stubEnv("INTERNAL_SECRET", "s3cret");
    for (const path of ["/api/settings", "/api/ai"]) expect(middleware(req(path)).status).toBe(401);
  });

  it("leaves attachment downloads unauthenticated", () => {
    vi.stubEnv("INTERNAL_SECRET", "s3cret");
    expect(isPassThrough(middleware(req("/api/attachments/abc")))).toBe(true);
  });

  it("does not gate non-API pages", () => {
    vi.stubEnv("INTERNAL_SECRET", "s3cret");
    expect(isPassThrough(middleware(req("/editor/123")))).toBe(true);
  });

  it("allows API calls without a secret in development", () => {
    vi.stubEnv("INTERNAL_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(isPassThrough(middleware(req("/api/pages")))).toBe(true);
  });

  it("fails closed in production when no secret is configured", async () => {
    vi.stubEnv("INTERNAL_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    const res = middleware(req("/api/pages"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Server misconfigured" });
  });
});
