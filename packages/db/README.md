# BasedDb

BasedDb is a powerful node graph based database solution that supports various
data types, references, edges, and operations. It also offers concurrency
handling, client-server architecture support, and more.

## Features

- Schema definition and management
- Data creation, querying, updating, and deletion
- Support for strings, locale aware text, numbers, booleans, binaries, aliases, enums, row and columnar vectors, and cardinality
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

This documentation is generated based on the features demonstrated in the \`./test\` directory.

### Setup

```typescript
import { BasedDb } from './src/index.js' // Adjust import path as needed

// Instantiate the database
const db = new BasedDb({
  path: './db-directory', // Path to store database files
  saveIntervalInSeconds: 1, // Optional: Auto-save interval (e.g., every second)
})

// Start the database (connects/loads existing or creates new)
// clean: true wipes data on start if path exists
await db.start({ clean: true })

// Define the database schema (required before most operations)
await db.setSchema({
  // Optional: Define locales for 'text' fields
  locales: {
    en: { required: true }, // 'en' is required
    nl: { fallback: ['en'] }, // 'nl' falls back to 'en' if missing
    fi: { fallback: ['en'] },
  },
  // Optional: Define properties directly on the root node
  props: {
    siteName: 'string',
    featuredItems: { items: { ref: 'product' } },
  },
  // Define data types
  types: {
    user: {
      props: {
        name: 'string', // Simple string
        email: { type: 'alias', required: true }, // Unique alias (indexed string)
        age: 'uint32', // Unsigned 32-bit integer
        score: { type: 'number', min: 0, max: 100, step: 0.5 }, // Float with validation
        isActive: 'boolean', // Boolean true/false
        createdAt: { type: 'timestamp', on: 'create' }, // Auto-set on creation
        updatedAt: { type: 'timestamp', on: 'update' }, // Auto-set on update/create
        bio: 'text', // Multi-language text
        friends: {
          // List of references
          items: {
            ref: 'user', // References 'user' type
            prop: 'friends', // Bidirectional link property
            $friendshipLevel: 'uint8', // Optional: Edge property
          },
        },
        bestFriend: {
          // Single reference
          ref: 'user',
          prop: 'bestFriendOf', // Bidirectional link
        },
        profilePicture: 'binary', // Raw binary data (Uint8Array)
        settings: 'json', // JSON object/array
        visits: 'cardinality', // HyperLogLog counter for unique values
        embedding: { type: 'vector', size: 5 }, // Fixed-size float vector (size from test)
        status: ['pending', 'active', 'inactive'], // Enum type
        countryCode: { type: 'string', maxBytes: 2 }, // String with max byte length
        nestedData: {
          // Nested object
          type: 'object',
          props: {
            value: 'string',
            nestedRef: { ref: 'product', prop: 'nestedUsers' },
          },
        },
        customValidated: {
          // Custom validation function
          type: 'number',
          validation: (v) => v % 2 === 0, // Must be an even number
        },
      },
    },
    product: {
      props: {
        title: 'text',
        price: 'number',
        nestedUsers: { items: { ref: 'user', prop: 'nestedData.nestedRef' } },
      },
    },
    // Other types from tests (e.g., payment, round, vote, contestant, dialog, article, etc.)
    // ...
  },
})
```

### Create

```typescript
// Create a new node
const userId = await db.create('user', {
  name: 'Alice',
  email: 'alice@example.com',
})
// userId is the numeric ID of the created node

// Create with references and edge properties
const friendId = await db.create('user', {
  name: 'Bob',
  email: 'bob@example.com',
})
const userWithFriendId = await db.create('user', {
  name: 'Charlie',
  email: 'charlie@example.com',
  friends: [{ id: friendId, $friendshipLevel: 5 }], // Reference Bob with edge data
  bestFriend: friendId, // Single reference
})

// Create text with specific locale
const dialogFi = await db.create('dialog', { fun: 'hauskaa' }, { locale: 'fi' })
```

### Read (Query)

The \`query\` method starts building a request to retrieve data.

```typescript
// Query by type and optionally ID(s) or alias
db.query('user') // Query all users (limited by default)
db.query('user', userId) // Query a single user by ID
db.query('user', [userId, friendId]) // Query multiple users by IDs
db.query('user', { alias: 'alice@example.com' }) // Query by unique alias
db.query() // Query root properties
```

#### \`.include(...fields)\`

Specifies which fields to return. Supports nested fields and edge properties.

```typescript
// Include specific fields
await db.query('user', userId).include('name', 'age').get()
// -> { id: userId, name: 'Alice', age: 30 }

// Include all direct fields (non-nested, non-reference)
await db.query('user', userId).include('*').get()
// -> { id: userId, name: 'Alice', email: '...', age: 30, ... } (no friends, bestFriend data)

// Include nested fields and reference fields
await db
  .query('user', userWithFriendId)
  .include('name', 'friends.name', 'bestFriend.email')
  .get()
// -> { id: ..., name: 'Charlie', friends: [{ id: ..., name: 'Bob' }], bestFriend: { id: ..., email: '...' } }

// Include specific language from a 'text' field
await db.query('user', userId).include('bio.en').get()
// -> { id: userId, bio: { en: 'Engineer' } }

// Include edge properties from a reference list
await db
  .query('user', userWithFriendId)
  .include('friends.$friendshipLevel')
  .get()
// -> { id: ..., friends: [{ id: ..., $friendshipLevel: 5 }] }
```

#### \`.filter(field, operator, value, options?)\`

Filters the results based on field values.

Operators:

- \`=\`: Equal to (works for most types, including exact string match).
- \`!=\`: Not equal to.
- \`>\`: Greater than (numbers, timestamps).
- \`<\`: Less than (numbers, timestamps).
- \`>=\`: Greater than or equal to.
- \`<=\`: Less than or equal to.
- \`has\`: Contains substring (case sensitive by default for \`string\`, \`text\`, could be case insentive passing option argument).
- \`like\`: Fuzzy search / similarity (for \`string\`, \`text\`, \`vector\`).

**Filter Examples:**

- **Equality (=)**
  Finds nodes where the field exactly matches the value.

  ```typescript
  // Find users named exactly 'Alice'
  await db.query('user').filter('name', '=', 'Alice').get()

  // Find users with age 30
  await db.query('user').filter('age', '=', 30).get()

  // Find users with a specific country code
  await db.query('user').filter('countryCode', '=', 'NL').get()

  // Find users with a specific vector (exact match)
  const queryVector = new Float32Array([
    /* ... */
  ])
  await db.query('user').filter('embedding', '=', queryVector).get()
  ```

- **Inequality (!=)**
  Finds nodes where the field does _not_ match the value.

  ```typescript
  // Find users not named 'Alice'
  await db.query('user').filter('name', '!=', 'Alice').get()

  // Find users whose status is not 'pending'
  await db.query('user').filter('status', '!=', 'pending').get()
  ```

- **Comparison (>, \`<, >=, <=)**
  Finds nodes based on numerical or timestamp comparisons.

  ```typescript
  // Find users older than 50
  await db.query('user').filter('age', '>', 50).get()

  // Find users with a score less than or equal to 75.5
  await db.query('user').filter('score', '<=', 75.5).get()

  // Find users created within the last 24 hours
  await db
    .query('user')
    .filter('createdAt', '>=', Date.now() - 86400000)
    .get()
  ```

- **String/Text Contains (has)**
  Finds nodes where a \`string\` or \`text\` field includes a substring. Case-insensitive by default.

  ```typescript
  // Find users whose name contains 'ali' (matches 'Alice', 'Ali', 'Salim', etc.)
  await db.query('user').filter('name', 'has', 'ali').get()

  // Find users whose name contains 'ALI' (case-sensitive)
  await db
    .query('user')
    .filter('name', 'has', 'ALI', { lowerCase: false })
    .get()

  // Find users whose bio (any language) contains 'engineer'
  await db.query('user').filter('bio', 'has', 'engineer').get()

  // Find users whose English bio contains 'dev'
  await db.query('user').filter('bio.en', 'has', 'dev').get()
  ```

- **Fuzzy Match / Similarity (like)**
  Finds nodes based on approximate matching for \`string\`, \`text\`, or \`vector\` types.

  ```typescript
  // Find users whose bio might contain a typo like 'engneer'
  await db.query('user').filter('bio', 'like', 'engneer').get()

  // Find users whose embedding vector is similar to queryVector (cosine similarity >= 0.8)
  const queryVector = new Float32Array([
    /* ... */
  ])
  await db
    .query('user')
    .filter('embedding', 'like', queryVector, { score: 0.8 })
    .get()

  // Find users whose embedding vector is similar (Euclidean distance <= 1.0)
  await db
    .query('user')
    .filter('embedding', 'like', queryVector, {
      fn: 'euclideanDistance',
      score: 1.0,
    })
    .get()
  ```

- **Boolean Filtering**
  Finds nodes based on a boolean field's value.

  ```typescript
  // Find active users (explicitly true)
  await db.query('user').filter('isActive', '=', true).get()

  // Find active users (shortcut for true)
  await db.query('user').filter('isActive').get()

  // Find inactive users
  await db.query('user').filter('isActive', false).get()
  ```

- **Enum Filtering**
  Finds nodes where an \`enum\` field matches a specific value.

  ```typescript
  // Find users with status 'active'
  await db.query('user').filter('status', '=', 'active').get()

  // Find users whose status is not 'pending'
  await db.query('user').filter('status', '!=', 'pending').get()
  ```

- **Filtering on Nested Fields**
  Uses dot notation to access fields within nested objects.

  ```typescript
  // Find users where nestedData.value is 'nested info'
  await db.query('user').filter('nestedData.value', '=', 'nested info').get()
  ```

- **Filtering on Reference Fields**
  Uses dot notation to filter based on fields of referenced nodes.

  ```typescript
  // Find users whose best friend is named 'Bob'
  await db.query('user').filter('bestFriend.name', '=', 'Bob').get()

  // Find users who have at least one friend older than 30
  await db.query('user').filter('friends.age', '>', 30).get()

  // Find users whose best friend's status is 'active'
  await db.query('user').filter('bestFriend.status', '=', 'active').get()
  ```

#### \`.sort(field, direction?)\`

Sorts the results by a specific field. \`direction\` can be \`'asc'\` (default) or \`'desc'\`.

```typescript
// Sort by age descending
await db.query('user').sort('age', 'desc').get()

// Sort by name ascending
await db.query('user').sort('name').get() // 'asc' is default

// Sort by text field (uses locale if provided)
await db.query('user').locale('nl').sort('bio').get()

// Sort by cardinality (HLL count)
await db.query('user').sort('visits', 'desc').get()

// Sort by alias
await db.query('article').sort('email', 'desc').get()

// Sort by timestamp
await db.query('event').sort('startTime').get()
```

#### \`.range(offset, limit)\`

Paginates the results.

```typescript
// Get users 11-20 sorted by name
await db.query('user').range(10, 10).sort('name').get()
```

#### \`.search(term, fieldOrWeights, options?)\`

Performs full-text or vector search, returning results sorted by relevance/similarity.

```typescript
// Full-text search for 'engineer' in 'name' and 'bio' fields
await db.query('user').search('engineer', 'name', 'bio').get()

// Full-text search with field weights
await db.query('user').search('engineer', { bio: 0.8, name: 0.2 }).get()

// Vector search (returns sorted by similarity)
const queryVector = new Float32Array([
  /* ... */
])
await db.query('user').search(queryVector, 'embedding', { score: 0.7 }).get()
```

#### \`.locale(langCode)\`

Specifies the language context for \`text\` fields in \`include\`, \`filter\`, and \`sort\`.

```typescript
// Get 'bio' in 'nl', falling back to 'en' if 'nl' is missing
await db.query('user', userId).locale('nl').include('bio').get()
// -> { id: userId, bio: 'Ingenieur' } (assuming 'nl' exists, else 'Engineer')

// Filter based on 'nl' text, return 'nl' text
await db
  .query('user')
  .locale('nl')
  .filter('bio', 'has', 'ingenieur')
  .include('bio')
  .get()
```

#### \`.get()\`

Executes the query and returns a \`BasedQueryResponse\` promise.

```typescript
const response = await db.query('user').include('name').get()

// Get results as plain objects
const userObjects = response.toObject() // Returns array or single object/null

// Get single node result directly (for single ID or alias queries)
const singleUserObject = await db
  .query('user', userId)
  .get()
  .then((res) => res.node()) // Returns single object or null
```

#### Combining Methods

Query methods can be chained together.

```typescript
const specificUsers = await db
  .query('user')
  .filter('age', '>', 25)
  .filter('status', '=', 'active')
  .sort('createdAt', 'desc')
  .range(0, 5)
  .include('name', 'email')
  .locale('en') // Optional: set locale context
  .get()
  .then((res) => res.toObject()) // Get plain objects
```

### Update

```typescript
// Update specific fields
await db.update('user', userId, { age: 31, isActive: false })

// Update using payload.id
await db.update('user', { id: userId, age: 32 })

// Atomic increment/decrement (number/timestamp)
await db.update('user', userId, {
  age: { increment: 1 },
  score: { decrement: 0.5 },
})

// Update references (single)
await db.update('user', userWithFriendId, { bestFriend: userId })

// Update references (list) - add, delete, update edge props
await db.update('user', userWithFriendId, {
  friends: {
    add: [userId],
    delete: [friendId],
    update: [{ id: userId, $friendshipLevel: 10 }],
  },
})

// Replace references (list)
await db.update('user', userWithFriendId, { friends: [userId] }) // Replaces entire list

// Clear references
await db.update('user', userWithFriendId, { friends: null, bestFriend: null })

// Update cardinality field
await db.update('user', userId, { visits: 'newSession' }) // Adds 'newSession' if unique

// Update root properties
await db.update({ siteName: 'My Awesome Site V2' })

// Update text with specific locale
await db.update(
  'dialog',
  dialogFi,
  { fun: 'vielä hauskempaa' },
  { locale: 'fi' },
)

// Update timestamp with string parsing
await db.update('user', userId, { updatedAt: 'now + 1h' }) // Relative time
```

### Upsert

Update if alias exists, otherwise create.

```typescript
await db.upsert('user', {
  alias: 'alice@example.com', // The alias to match
  name: 'Alice Smith', // Field to update or set on create
  age: 33, // Another field
})
```

### Delete

```typescript
// Delete a node by ID
await db.delete('user', userId)
```

### Persistence & Control

```typescript
// Manually trigger a save to disk
await db.save()

// Wait for pending modifications to be processed
await db.drain()
// or use the promise returned by isModified()
await db.isModified()

// Gracefully stop the database (saves pending changes)
await db.stop()

// Destroy the instance (call stop() first for graceful shutdown)
await db.destroy()

// Completely clear all data and schema (USE WITH CAUTION!)
await db.wipe()
```

### Validation

BasedDb automatically validates data against the schema on \`create\`, \`update\`, and \`upsert\`. It checks types, required fields, enums, number constraints (min, \`max\`, \`step\`), string constraints (maxBytes), vector size, references, aliases, locales, and custom validation functions. Invalid operations will throw an error.

```typescript
// Example: This would throw if 'invalid-status' is not in the enum
// await db.create('user', { status: 'invalid-status', email: 'fail@example.com' })

// Example: This would throw if score is > 100
// await db.update('user', userId, { score: 101 })

// Example: This would throw if the custom validation fails (e.g., not an even number)
// await db.create('user', { customValidated: 3, email: 'customfail@example.com' })
```

### Subscriptions (Client/Server Context)

Note: Subscriptions are primarily managed by a higher-level client/server setup.

```typescript
// Client-side subscription setup (simplified)
const closeSub = db
  .query('user')
  .filter('isActive')
  .include('name')
  .subscribe((data) => {
    console.log('Subscription update:', data.toObject())
  })

// To stop listening:
closeSub()
```

### Schema Updates (Client/Server Context)

Note: Schema updates in a client/server environment involve coordination.

```typescript
// Client initiates a schema update
await clientDb.setSchema({
  types: {
    /* ... new or modified schema ... */
  },
})
```

// Server processes and notifies clients.

### Aggregations

BasedDb support aggregate functions such as `sum('prop1','prop2')`, `count()`, etc and operations such as `groupBY('prop')`.
See the specific README [Aggregations](./README_Aggregate.md) for a detailed information on its usage and features.
