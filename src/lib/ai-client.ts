export type AiTask = { title: string; priority?: string; estimate?: number | null };

export type AiOutcome =
  | { ok: true; result?: string; tasks?: AiTask[] }
  | { ok: false; error: string; notConfigured: boolean; cancelled?: boolean };

const fail = (error: string, extra: { notConfigured?: boolean; cancelled?: boolean } = {}): AiOutcome => ({
  ok: false,
  error,
  notConfigured: Boolean(extra.notConfigured),
  ...(extra.cancelled ? { cancelled: true } : {}),
});

export async function requestAi(body: Record<string, unknown>, signal?: AbortSignal): Promise<AiOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (error) {
    if (signal?.aborted || (error as Error)?.name === "AbortError") return fail("Cancelled", { cancelled: true });
    return fail("AI request failed. Check your connection and try again.");
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return fail("AI returned an unreadable response. Try again.");
  }

  if (!response.ok) {
    const notConfigured = data?.code === "not_configured" || data?.code === "model_required";
    return fail(String(data?.error || "AI is unavailable. Configure a provider in Settings."), { notConfigured });
  }
  if (Array.isArray(data.tasks)) return { ok: true, tasks: data.tasks };
  return { ok: true, result: String(data.result ?? data.answer ?? "") };
}
