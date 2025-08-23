# Getting started with BasedDB

## 1. Start the database

```ts
import { BasedDb } from '@based/db'

const db = new BasedDb({ path: './data' })
await db.start({ clean: true })
```

## 2. Define a schema

```ts
await db.setSchema({
  types: {
    user: {
      props: {
        name: 'string',
        email: { type: 'alias', required: true },
        age: 'uint32',
      },
    },
  },
})
```

## 3. Create & query

```ts
const id = await db.create('user', {
  name: 'Ada',
  email: 'ada@lovelace.dev',
  age: 36,
})

const ada = await db.query('user', id).include('name', 'age').get().toObject()

console.log(ada) // { id: 1, name: 'Ada', age: 36 }
```

## 4. Explore further

- [Schema reference](/schema)
- [Filtering & sorting](db/filtering)
- [Real-time subscriptions](db/examples)
- [Aggregations](db/aggregate)
