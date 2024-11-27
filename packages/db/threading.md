# setup

main.js

```ts
type Block = {
  count: number
  start: number
  end: number
  worker: Worker
}

type Worker = {
  thread: WorkerThread
  blocks: Block[]
}

const blocks: Record<number, Block[]> = {}
const workers: Worker[] = []
```

worker.js
does both migrations and modifies

```ts

```

- [ ] create worker pool
- [ ] split folders

```
native/
  ...
src/
  server/
    csmt/
    incoming/
    ...
  migrate/
  modify/
  query/
  schema/
  ...
```
