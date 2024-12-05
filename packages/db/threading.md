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

- [ ] create worker pool
- [ ] split folders
```

```ts
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

```ts
const thread1 = []
const thread2 = []
const thread3 = []
const thread4 = []

const thread = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4]

const worker = () => {}
```

#TODO

- receive a buffer A
- loop through buffer
