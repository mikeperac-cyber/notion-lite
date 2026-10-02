import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { requestAi } from "./ai-client";

const fetchMock = vi.fn();
const reply = (payload: unknown, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status }));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("requestAi", () => {
  it("posts the body to /api/ai and returns the result text", async () => {
    reply({ result: "Hello" });
    expect(await requestAi({ mode: "summarize", contextText: "x" })).toEqual({ ok: true, result: "Hello" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/ai");
    expect(JSON.parse(init.body)).toEqual({ mode: "summarize", contextText: "x" });
  });

  it("returns tasks for extract_tasks responses", async () => {
    reply({ tasks: [{ title: "A" }] });
    expect(await requestAi({ mode: "extract_tasks" })).toEqual({ ok: true, tasks: [{ title: "A" }] });
  });

  it("accepts chat-style answers", async () => {
    reply({ answer: "42" });
    expect(await requestAi({ mode: "chat" })).toEqual({ ok: true, result: "42" });
  });

  it.each(["not_configured", "model_required"])("flags %s so the UI can offer Settings", async code => {
    reply({ code, error: "Add a key" }, 409);
    expect(await requestAi({})).toEqual({ ok: false, error: "Add a key", notConfigured: true });
  });

  it("passes provider errors through without the Settings prompt", async () => {
    reply({ error: "AI provider returned 400: bad model" }, 502);
    expect(await requestAi({})).toEqual({ ok: false, error: "AI provider returned 400: bad model", notConfigured: false });
  });

  it("explains a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const outcome = await requestAi({});
    expect(outcome).toMatchObject({ ok: false, notConfigured: false });
    expect((outcome as any).error).toMatch(/connection/i);
  });

  it("reports an unreadable response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>oops</html>", { status: 200 }));
    expect(await requestAi({})).toMatchObject({ ok: false, error: expect.stringMatching(/unreadable/i) });
  });

  it("reports a cancelled request distinctly", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
    expect(await requestAi({}, controller.signal)).toMatchObject({ ok: false, cancelled: true });
  });
});
