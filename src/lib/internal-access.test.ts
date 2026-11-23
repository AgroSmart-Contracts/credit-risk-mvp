import { afterEach, describe, expect, it, vi } from "vitest";
import middleware from "../../middleware";

const call = (auth?: string) => middleware(new Request("https://internal.test/assets/InternalApp.js", { headers: auth ? { authorization: auth } : {} }));
const basic = (u: string, p: string) => `Basic ${btoa(`${u}:${p}`)}`;

afterEach(() => vi.unstubAllEnvs());

describe("internal site lock", () => {
  it("fails closed when it is not configured", async () => {
    vi.stubEnv("INTERNAL_ACCESS_USER", "");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "");
    expect((await call(basic("a", "b"))).status).toBe(503);
  });
  it("rejects missing, malformed and wrong credentials, and accepts the right ones", async () => {
    vi.stubEnv("INTERNAL_ACCESS_USER", "team");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "a-long-test-password");
    expect((await call()).status).toBe(401);
    expect((await call("Basic %%%")).status).toBe(401);
    expect((await call(basic("team", "wrong"))).status).toBe(401);
    const ok = await call(basic("team", "a-long-test-password"));
    expect(ok.headers.get("x-middleware-next")).toBe("1");
  });
});
