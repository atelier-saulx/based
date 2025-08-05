# Getting started with BasedDB

## 1. Start the database

```js
import { BasedDb } from '@based/db'

const db = new BasedDb({ path: './data' })
await db.start({ clean: true })
```

## 2. Define a schema

```js
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

```js
const id = await db.create('user', {
  name: 'Ada',
  email: 'ada@lovelace.dev',
  age: 36,
})

const ada = await db
  .query('user', id)
  .include('name', 'age')
  .get()
  .then((r) => r.node())

console.log(ada) // { id: 1, name: 'Ada', age: 36 }
```

## 4. Explore further

- [Schema reference](db/schema)
- [Filtering & sorting](db/filtering)
- [Real-time subscriptions](db/examples)
- [Aggregations](db/aggregate)
