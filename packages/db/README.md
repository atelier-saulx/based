# BasedDb

BasedDb is a powerful node graph based database solution that supports various
data types, references, edges, and operations. It also offers concurrency
handling, client-server architecture support, and more.

## Features

- Schema definition and management
- Data creation, querying, updating, and deletion
- Supported field types
  - `string`
  - `text`, locale aware multi-language [text](./README_Text.md)
  - `binary` strings
  - `timestamp`
  - numeric types: `number` (double-precision floating-point), `int8`, `uint8`, `int16`, `uint16`, `int32`, `uint64`
  - `boolean`
  - `alias`
  - `enum`
  - row and columnar vectors: `vector` and `colvec`
  - `cardinality` set
- References and edge properties for advanced data modeling
- Concurrency support for high-load scenarios
- Client-server design for distributed systems
- Checksum, analytics, and expiration features
- Async block based backups, i.e. only dirty blocks needs to be written on save

## Install

**Prerequisites:**

- recent GNU make
- gcc 14.2 on Linux or clang 17.0.0 on macOS
- zig 0.14.0
- npm & node.js v22.14.0 or newer

```bash
npm i
npm run get-napi # only need this the first time
npm run build
```

## Testing

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

Different flavours of test:

Only builds zig

```bash
npm run test-zig
```

Builds nothing only runs tests

```bash
npm run test-fast
```

## API Documentation

This documentation covers setup, basic CRUD, querying, graph relational traversal, and advanced performance practices for `@based/sdk/db`.

### 1. Setup & Schema Definition

The database requires a schema before most operations. The schema defines types, properties, locales, and constraints. BasedDb is a unique hybrid document store and graph database that extensively utilizes adjacency lists for high-speed references.

```typescript
import { BasedDb } from '@based/sdk/db' // Adjust import path as needed

// Instantiate the database
const db = new BasedDb({
  path: './db-directory', // Path to store database files
})

// Start the database
await db.start({ clean: true })

await db.setSchema({
  locales: {
    en: { required: true },
    nl: { fallback: ['en'] },
  },
  types: {
    user: {
      props: {
        name: 'string',
        // Alias is a fast secondary key on an RBTree. format enforces validation.
        email: { type: 'alias', format: 'email', required: true },
        age: 'uint32',
        bio: 'text', // Multi-language localized text
        recentVisits: {
          // References with capped size for automatic FIFO truncation
          type: 'references',
          capped: 50,
          items: { ref: 'article' },
        },
        friends: {
          items: {
            ref: 'user',
            prop: 'friends', // Bidirectional link
            $friendshipLevel: 'uint8', // Edge property
          },
        },
        status: { type: 'enum', enum: ['active', 'inactive', 'pending'] },
        embedding: { type: 'vector', size: 1536, baseType: 'float32' },
      },
      hooks: {
        // Native DB-layer execution hooks
        create: (payload) => {
          if (payload.age < 18) throw new Error('Must be 18+')
        },
      },
    },
    article: {
      props: {
        title: 'text',
        body: 'text',
      },
    },
  },
})
```

### 2. Mutations (Create, Update, Delete)

Mutations in BasedDb are highly synchronized and batched on the same engine tick.

#### Create & Tmp IDs

When you `create`, it instantly returns a `Tmp ID`. These IDs can be manipulated or bound synchronously without awaiting the engine to `.drain()`.

```typescript
// Create a new node. Returns the auto-generated unsigned integer ID.
const userId = await db.create('user', {
  name: 'Alice',
  email: 'alice@example.com',
})

// Using references and edges
const charlieId = await db.create('user', {
  name: 'Charlie',
  email: 'charlie@example.com',
  friends: [
    { id: userId, $friendshipLevel: 5 }, // Linking via edge property
  ],
})
```

#### Update

```typescript
// Update specific fields
await db.update('user', userId, { age: 31, status: 'active' })

// Update using payload id
await db.update('user', { id: userId, age: 32 })

// Atomic increment/decrement
await db.update('user', userId, { age: { increment: 1 } })

// Update references (list) - add, delete, update edge props
await db.update('user', charlieId, {
  friends: {
    add: [newFriendId],
    delete: [oldFriendId],
    update: [{ id: userId, $friendshipLevel: 10 }],
  },
})

// Replace an entire reference list
await db.update('user', charlieId, { friends: [userId] })
```

#### Upsert

Intelligently update if the node exists or create it if it doesn't, based on an `alias` field defined in the schema.

```typescript
await db.upsert('user', {
  email: 'alice@example.com', // Must be an 'alias' property in the schema
  name: 'Alice Smith',
  age: 33,
})
```

#### Delete

Deleting nodes natively manages tearing down bi-directional connections in the graph adjacency list. For strictly coupled records, use `dependent: true` in the schema to enact cascading engine-level deletes.

```typescript
await db.delete('user', userId)
```

#### Expiration (TTL)

Instead of relying on application-level background workers to prune data, allow the engine to expire it natively.

```typescript
db.expire('user', userId, 600) // Automatically wipes the entity in 10 minutes (600s)
```

### 3. Querying & Adjacency List Traversal

The `.query()` method starts building an execution request.

**Core Rule:** Always query _through_ the known ID of a reference rather than scanning the target collection and filtering (which behaves as a slow `O(N)` scan). Direct ID lookups bypass filtering entirely (`O(log N)`).

```typescript
// Direct ID lookup (BEST)
db.query('user', userId)

// Explicit IDs array (Highly optimized instant direct engine scan)
db.query('user', [812739, 918237, 102938])

// Alias lookup (RBTree fast secondary index)
db.query('user', { email: 'alice@example.com' })

// Query all matching the type (Typically bounded by filters)
db.query('user')
```

#### `.include(...fields)`

Specifies which fields to traverse and return. Supports nested sub-queries and extracting metadata or specific language locales.

```typescript
// Include explicit fields
await db.query('user', userId).include('name', 'age').get()

// Include nested fields via adjacency list (Walking the graph)
await db
  .query('user', userId)
  .include(
    (s) => s('friends').include('name', '$friendshipLevel'), // Includes Edge property
  )
  .get()

// Explicit Language Targeting
await db.query('user', userId).include('bio.en').get()

// Partial Text Loading (Truncating massive payloads directly at the C-layer)
await db.query('article').include('title', 'body', { end: 50 }).get()

// Requesting Metadata directly instead of the raw value body
await db.query('article').include('body', { meta: true }).get()
```

#### `.filter(field, operator, value, options?)`

Evaluate and eliminate records. You should **always place your most restrictive filters first** to reduce the evaluation pipeline early.

Operators: `=`, `!=`, `>`, `<`, `>=`, `<=`, `includes` (or `has`), `like`, `exists`.

```typescript
// Constant Equality
await db.query('user').filter('status', '=', 'active').get()

// SIMD Optimized Array Operations (Vectorized OR lookup - Extremely Fast)
await db.query('user').filter('role', '=', [1, 2, 3]).get()

// Value Comparison
await db.query('user').filter('age', '>=', 18).get()

// Fast Boolean evaluation
await db.query('user').filter('isActive').get()

// Filtering inside Graph Traversals
await db
  .query('user', userId)
  .include((s) =>
    s('friends').filter('$friendshipLevel', '>', 5).include('name'),
  )
  .get()
```

#### `.sort(field, direction?)`

**Performance Note:** Sorting a top-level collection uses a stored physical index. Sorting _references_ via `.include()` is computed entirely _on-the-fly_ and bears heavy performance implications for large lists.

Always prefer sorting by `id` rather than a `createdAt` timestamp. `id` inherently represents chronological insertion order and guarantees an instant linear engine traversal.

```typescript
// Top-level instant indexed linear traversal
await db.query('user').sort('id', 'desc').get()

// Ascending sort via index
await db.query('user').sort('name', 'asc').get()
```

#### `.search(term, fields, options?)`

Utilizes a highly optimized Hamming distance algorithm for full-text queries (exceptional for catching typos). Text spaces act as logical AND operators.

```typescript
// Full-text search across multiple fields (Space behaves as logical AND)
await db.query('article').search('italy nigeria', 'title', 'body').get()

// Configured text search with specific weighting
await db.query('article').search('giraffe', { title: 1, body: 0.5 }).get()

// Vector Search natively supports Euclidean distance, Cosine Similarity, etc.
const embedding = new Float32Array([...])
await db.query('data')
  .search(embedding, 'embedding', { fn: 'cosineSimilarity', score: 0.8 })
  .get()
```

#### `.range(start, end)`

Returns records bound between two integer indices for fast pagination offsets.

```typescript
await db.query('user').sort('id', 'desc').range(0, 25).get() // Items 0 through 24
await db.query('user').sort('id', 'desc').range(25, 50).get() // Items 25 through 49
```

### 4. Advanced Features

#### Aggregations & Group By

BasedDb natively supports `sum()`, `count()`, `avg()`, `min()`, `max()`, `stddev()`, `var()`, and `harmonicMean()`.

```typescript
// Count matching records instantly without fetching
const activeCount = await db
  .query('user')
  .filter('isActive', '=', true)
  .count()
  .get()

// Aggregate and logically group by a distinct property
const regionalAverages = await db
  .query('vote')
  .avg('score')
  .groupBy('region')
  .get()

// Relational Sub-Query Accumulation (Instant count of graph relations)
const userSummary = await db
  .query('user', userId)
  .include((q) => q('friends').count())
  .get()
```

#### Cardinality (HyperLogLog++)

Track the estimated number of uniquely occurring elements without large list memory bloat by defining the `cardinality` schema type.

```typescript
// Mutating cardinality bumps the set with distinct new values
await db.update('analytics', eventId, { uniqueUsers: ['UserA', 'UserB'] })

// Querying automatically resolves down to the approximated integer count
const result = await db.query('analytics', eventId).include('uniqueUsers').get()
```

#### Subscriptions

Subscriptions hook directly into the database engine's evaluation tree without relying on polling cycles.

```typescript
const unsubscribe = db.query('project', projectId).subscribe((data) => {
  console.log('Push update received:', data.toObject())
})

// Teardown the listener
unsubscribe()
```

#### Error Handling and Validation

The engine validates transactions strictly against your defined schema. Operations circumventing `min`, `max`, `maxBytes`, `format`, types, or making structural request errors will synchronously throw highly predictable exceptions out of the C-bindings layer.

```typescript
try {
  await db.update('user', 99999999, { status: 'invalid' })
} catch (error) {
  if (error.message.includes('does not exist')) {
    // Escalate NotExists securely
  } else if (error.message.includes('Invalid value')) {
    // Escalate Type / Format / Range Bound breaches
  }
}
```

#### Persistence Operations

```typescript
await db.save() // Manually trigger a dataset save
await db.drain() // Await pending background modifications flushing
await db.stop() // Graceful operational shutdown
await db.destroy() // Total instance teardown
```
