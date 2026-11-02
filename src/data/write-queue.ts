/**
 * Serializes every database write. expo-sqlite runs each exclusive transaction on its own
 * connection without a busy timeout, so two overlapping writers (e.g. a catalog refresh and a
 * visit save) would fail with "database is locked". Reads are not queued (WAL lets them run).
 *
 * Do not call one queued function from inside another queued task: it would wait on itself.
 */
let tail: Promise<unknown> = Promise.resolve();

export function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  // Keep the chain alive after failures; callers still see their own rejection.
  tail = run.catch(() => undefined);
  return run;
}
