new things

```ts
const create = [1..10]
const update = [11...20]

let i = create.length
let j = 0

while(i--) {
  const createId = create[j]
  for (; j < update.length; j++) {
    const updateId = update[j]
    if (createId === updateId) {
      // found it
      break
    }

    if (updateId > createId) {
      // insert it
    } else {
      // keep going
    }
  }
}
```

existing things

```ts
const create = [1, 3, 6, 70]
const update = [2, 3, 4, 90]

let i = create.length
let j = 0

for (; j < update.length; j++) {
  const updateId = update[j] // 2, 3, 4, 90
  while (i--) {
    const createId = create[i] // 70, 6, 3, 1, 0
    if (createdId > updateId) {
      continue
    }
    if (createdId === updateId) {
      break
    }

    insert(updateId, i)
    break
  }
}
```
