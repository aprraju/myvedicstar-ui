/** Bounded retries for transient failures during post-deployment verification. */
export async function fetchForSmoke(
  url: string | URL,
  init: RequestInit = {},
  options: {
    fetchImpl?: typeof fetch;
    attempts?: number;
    timeoutMs?: number;
    wait?: (ms: number) => Promise<void>;
  } = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const attempts = options.attempts ?? 3;
  const wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; ; attempt++) {
    try {
      const timeout = AbortSignal.timeout(options.timeoutMs ?? 10_000);
      const response = await fetchImpl(url, {
        ...init,
        signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
      });
      if (attempt === attempts || (response.status !== 429 && response.status < 500)) return response;
      await response.body?.cancel();
      console.log(`  retrying smoke request after HTTP ${response.status} (${attempt}/${attempts})`);
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (attempt === attempts) {
        const target = new URL(String(url));
        throw new Error(
          `Request to ${target.origin}${target.pathname} failed after ${attempt} attempts: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
      console.log(`  retrying smoke request after network failure (${attempt}/${attempts})`);
    }
    await wait(attempt * 1000);
  }
}
