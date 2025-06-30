Workers
=======

Worker internals in this dir.

- `DbWorker` is an abstract class that can be extended to create a new worker type.
- `worker.ts` shared worker thread initialization code run at the startup of each worker thread.
- `[type]_worker.ts` worker specific source files should contain the code executed in the worker threads.
