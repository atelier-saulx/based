# BasedDb

BasedDb is a powerful database solution that supports various data types, references, edges, and operations. It also offers concurrency handling, client-server architecture support, and more.

## Features

- Schema definition and management
- Data creation, querying, updating, and deletion
- Support for strings, numbers, booleans, binaries, aliases, enums, and cardinality
- Edges and references for advanced data modeling
- Concurrency support for high-load scenarios
- Client-server design for distributed systems
- Checksum, analytics, and expiration features

## Install

**Prerequisites:**

- recent GNU make
- gcc with recent enough C23 support
- zig 0.13.0
- npm & node.js, v20.11.1 or newer

```bash
npm i
npm run get-napi // only need this the first time
npm run build
```

## Running tests

Run all tests + ldb + build c, zig and js

```bash
npm run test
```

Run specific test file - does substring matching

```bash
npm run test -- range.js
```

Run specific test file & run specific test

```bash
npm run test -- range.js:range
```

Different flavours of test

Only builds zig

```bash
npm run test-zig
```

Builds nothing only runs tests

```bash
npm run test-fast
```

## Getting Started

To get started with BasedDb, follow these steps:

1. Install the package
2. Define your schema
3. Start the database
4. Perform operations like create, query, update, and delete

```ts
const db = new BasedDb({
  path: '/persistent-file-path',
})
```

## Schema Definition

Define your schema using the `putSchema` method. Here is an example:

```typescript
await db.putSchema({
  types: {
    user: {
      name: 'string',
      age: 'number',
      email: 'alias',
      isNice: 'boolean',
      roles: ['admin', 'editor', 'viewer'],
      file: 'binary',
      bestFriend: {
        ref: 'user',
        prop: 'bestFriend',
      },
      friends: {
        items: {
          ref: 'user',
          prop: 'friends',
        },
      },
    },
    article: {
      body: 'string',
      myUniqueValuesCount: 'cardinality',
      contributors: {
        type: 'references',
        items: {
          ref: 'user',
          prop: 'articles',
          $role: ['writer', 'editor'],
        },
      },
    },
    page: {
      name: 'string',
      clients: {
        items: {
          ref: '_client',
          prop: 'pages',
          $viewers: 'uint8',
        },
      },
      activeViewers: {
        type: 'uint32',
        path: 'clients.$viewers.#sum',
        history: {
          interval: 'second',
        },
      },
    },
    _client: {
      name: 'string',
    },
  },
})
```

## Data Operations

### Create

Create new records using the `create` method:

```typescript
const userId = await db.create('user', {
  name: 'youzi',
  email: 'youzi@example.com',
  isNice: true,
  roles: 'admin',
})
```

### Query & Filters

Query records using the `query` method:

```typescript
const results = await db
  .query('user')
  .filter('isNice', '=', true)
  .filter('name', '=', 'youzi')
  .get()
  .toObject()
```

### Update

Update records using the `update` method:

```typescript
await db.update('user', userId, {
  roles: 'editor',
})
```

### Delete

Delete records using the `delete` method:

```typescript
await db.delete('user', userId)
```

## Advanced Features

### Copy

Copy records with transformations:

```typescript
await db.copy('edition', editionId, {
  copiedByYouzi: true,
  versionOf({ id }) {
    return id
  },
  name({ name }) {
    return name + ' (edition copy)'
  },
  sequences({ sequences }) {
    return sequences.map(({ id }) => {
      return db.copy('sequence', id, {
        copiedByYouzi: true,
        name({ name }) {
          return name + ' (sequence copy)'
        },
        pages({ pages }) {
          return pages.map(({ id }) =>
            db.copy('page', id, {
              copiedByYouzi: true,
              name({ name }) {
                return name + ' (page copy)'
              },
            }),
          )
        },
      })
    })
  },
})
```

### Concurrency

Concurrent write and read operations are supported. The example below shows multiple concurrent queries and creates. Handle concurrency carefully to avoid conflicts:

```typescript
let id = 0
let queries = 0
let refs = []
let timer = setTimeout(() => {
  timer = null
}, 5e3)

const query = async () => {
  queries++
  try {
    await db.query('user').include('friends').range(0, 1000_000).get()
  } catch (e) {
    console.error('err:', e)
  }
  queries--
}

while (timer) {
  let i = 100
  while (i--) {
    query()
  }
  while (timer && queries) {
    db.create('user', {
      friends: refs,
    })
    refs.push(++id)
    await db.drain()
    await setTimeoutAsync()
  }
}

clearTimeout(timer)
```

### Client-Server

Set up a client-server architecture:

```typescript
const server = new DbServer({
  path: t.tmp,
  onSchemaChange(schema) {
    client1.putLocalSchema(schema)
    client2.putLocalSchema(schema)
  },
})

await server.start({ clean: true })

const hooks: DbClientHooks = {
  async putSchema(schema, fromStart, transformFns) {
    return server.putSchema(schema, fromStart, transformFns)
  },
  async flushModify(buf) {
    const offsets = server.modify(buf)
    return { offsets }
  },
  async getQueryBuf(buf) {
    return server.getQueryBuf(buf)
  },
}

const client1 = new DbClient({ hooks })
const client2 = new DbClient({ hooks })

await client1.putSchema({
  types: {
    user: {
      name: 'string',
    },
  },
})

const youzi = await client1.create('user', { name: 'youzi' })
const jamez = await client1.create('user', { name: 'jamez' })

deepEqual(await client1.query('user').get().toObject(), [
  { id: 1, name: 'youzi' },
  { id: 2, name: 'jamez' },
])
```

### Checksum

Include checksum in queries:

```typescript
await db.query('article').include('*', '_checksum')
```

### Cardinality

Use cardinality for unique value counts:

```typescript
await db.putSchema({
  types: {
    article: {
      myUniqueValuesCount: 'cardinality',
    },
  },
})

const myArticle = await db.create('article', {
  myUniqueValuesCount: 'myCoolValue',
})
```

### Boolean

Handle boolean properties:

```typescript
await db.putSchema({
  types: {
    user: {
      props: {
        isNice: 'boolean',
      },
    },
  },
})

db.create('user', {})
db.create('user', { isNice: true })
db.create('user', { isNice: false })

await db.drain()

deepEqual((await db.query('user').get()).toObject(), [
  { id: 1, isNice: false },
  { id: 2, isNice: true },
  { id: 3, isNice: false },
])
```

### Binary

Handle binary data:

```typescript
await db.putSchema({
  types: {
    user: {
      props: {
        file: { type: 'binary' },
      },
    },
  },
})

db.create('user', {
  file: new Uint32Array([1, 2, 3, 4]),
})

await db.drain()

deepEqual((await db.query('user').get()).toObject(), [
  {
    id: 1,
    file: new Uint8Array(new Uint32Array([1, 2, 3, 4]).buffer),
  },
])
```

### Analytics

Perform analytics on data:

```typescript
await db.putSchema({
  types: {
    page: {
      name: 'string',
      clients: {
        items: {
          ref: '_client',
          prop: 'pages',
          $viewers: 'uint8',
        },
      },
      activeViewers: {
        type: 'uint32',
        path: 'clients.$viewers.#sum',
        history: {
          interval: 'second',
        },
      },
    },
  },
})

const client = await db.create('_client', {})
const page = await db.create('page', {
  clients: [
    {
      id: client,
      $viewers: { increment: 1 },
    },
  ],
})
```

### Alias

Use aliases for properties:

```typescript
await db.putSchema({
  types: {
    user: {
      props: {
        externalId: 'alias',
        potato: 'string',
      },
    },
  },
})

const user1 = db.create('user', {
  externalId: 'cool',
})

await db.drain()

deepEqual((await db.query('user', user1).get()).toObject(), {
  id: 1,
  externalId: 'cool',
  potato: '',
})
```
