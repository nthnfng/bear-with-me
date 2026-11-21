// Runs async jobs strictly one at a time, in the order they were enqueued.
// A failing job is reported but never blocks the jobs behind it. Pure: no browser imports.

export interface SerialQueue {
  enqueue<T>(job: () => Promise<T>): Promise<T | undefined>;
}

export function createSerialQueue(onError: (err: unknown) => void = console.error): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    enqueue<T>(job: () => Promise<T>): Promise<T | undefined> {
      const run = tail.then(job);
      const settled = run.catch((err) => {
        onError(err);
        return undefined;
      });
      tail = settled;
      return settled;
    },
  };
}
