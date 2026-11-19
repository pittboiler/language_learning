// A time limit for a call that might never answer. The speech check had none, so a stalled provider left
// "Listening back…" on screen for minutes (Jake, 2026-11-19). Used by the browser (lib/api.ts) and the server
// (app/api/asr), so both give up in good time and say so.

/** The error a missed deadline rejects with; its message is meant for the learner. */
export class DeadlineError extends Error {
  override name = "DeadlineError";
}

/** Run `work` with an AbortSignal. If it hasn't settled within `ms`, abort it and reject with `message`. */
export function withDeadline<T>(ms: number, message: string, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    // Reject first: aborting makes the work fail at once (an AbortError), and that must not win the race.
    timer = setTimeout(() => { reject(new DeadlineError(message)); ctl.abort(); }, ms);
  });
  return Promise.race([work(ctl.signal), late]).finally(() => clearTimeout(timer));
}
