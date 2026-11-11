// A tiny in-process job queue: runs at most `concurrency` async tasks at once and
// starts the rest in order as slots free up. Used for CPU-heavy ffmpeg work
// (video conversion, audio extraction for transcripts).
export function createJobQueue(concurrency) {
  const waiting = [];
  let running = 0;

  const startNext = () => {
    if (running >= concurrency || waiting.length === 0) return;
    const { task, resolve, reject } = waiting.shift();
    running += 1;
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        running -= 1;
        startNext();
      });
  };

  /** Queues `task` (an async function); resolves/rejects with its result. */
  return function run(task) {
    return new Promise((resolve, reject) => {
      waiting.push({ task, resolve, reject });
      startNext();
    });
  };
}
