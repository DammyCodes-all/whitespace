/**
 * Abortable waits for the orb runtime.
 *
 * Every leg runs under one AbortSignal: when it aborts, the pending
 * timers resolve instead of hanging, so a cancelled leg never outlives
 * the run that started it.
 */

export const ABORT = Symbol("abort");

export function sleep(ms: number, sig: AbortSignal) {
  return new Promise<void>((res) => {
    if (sig.aborted) return res();
    let id = 0;
    const onAbort = () => {
      window.clearTimeout(id);
      res();
    };
    id = window.setTimeout(
      () => {
        sig.removeEventListener("abort", onAbort);
        res();
      },
      Math.max(0, ms),
    );
    sig.addEventListener("abort", onAbort, { once: true });
  });
}

export function abortable<V>(p: Promise<V>, sig: AbortSignal) {
  return new Promise<V | undefined>((res) => {
    if (sig.aborted) return res(undefined);
    const onAbort = () => res(undefined);
    sig.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        sig.removeEventListener("abort", onAbort);
        res(v);
      },
      () => {
        sig.removeEventListener("abort", onAbort);
        res(undefined);
      },
    );
  });
}
