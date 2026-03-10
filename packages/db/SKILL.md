---
name: using-based-db
description: Advanced patterns, query optimization, and best practices for integrating and querying @based/sdk/db in external projects
---

# @based/sdk/db Best Practices & Optimization Guidelines

This skill provides the standard conventions and optimization strategies for utilizing the `@based/sdk/db` package in external applications. It assumes the database lifecycle (start, stop, backup) is managed for you by the Based CLI or your project's internal orchestrator.

## 1. Strict AI Rules

<strict-ai-rules>

When acting as an AI assistant generating code against `@based/sdk/db`, you must strictly adhere to these rules:

> [!CAUTION]
> **No SQL Joins or Table Scans**
> Do not attempt to write SQL-style JOINs or foreign-key table scans (e.g., `filter('organizationId', '=', orgId)`). Always use the graph adjacency list via `.include()`.

- **NEVER** use `.filter('id', '=', id)`. **ALWAYS** use `db.query('collection', id)`.
- **NEVER** use `.or()` statements for the same field. **ALWAYS** pass an array (e.g., `.filter('role', '=', [1, 2])`).
- **NEVER** perform a linear table scan to find a single item if you already know its ID.
- **NEVER** perform a linear scan by filtering a collection based on a parent reference.
- **NEVER** sort unindexed reference arrays using `.sort()` within an `.include()` unless strictly required by the UI.
- **NEVER** build JavaScript loops for expirations; use `db.expire(type, id, ms)` natively instead.
- **ALWAYS** prefer sorting by `id` instead of a custom `createdAt` field.
- **ALWAYS** use `dependent: true` in the schema for cascading deletes instead of writing application-level loops.
- **ALWAYS** query _through_ the known ID of a reference rather than scanning the target collection and filtering.
- **NEVER** attempt to use `.join()`, `.where()`, or `.select()`. They do not exist.
- **NEVER** treat references as standard SQL foreign keys; they are graph adjacency lists.
- Nodes are assigned auto-generated unsigned integers for IDs (`u32`). **NEVER** generate UUIDs or string IDs manually when creating records.

</strict-ai-rules>

<api-surface>

## API Cheat Sheet

```typescript
// AI CHEAT SHEET: Allowed Query Builder Methods
// Do NOT invent methods like .where(), .join(), or .select()
db.query(type: string, idOrAlias?: string | number | object)
  .filter(field: string, operator: '=' | '!=' | '>' | '<' | 'includes' | 'exists', value: any, opts?: any)
  .include(...fields: (string | Function | object)[])
  .sort(field: string, direction: 'asc' | 'desc')
  .range(start: number, end: number)
  .get() // Always required to execute the query
```

</api-surface>

<schema-reference>

## 2. Schema & Data Model

`@based/sdk/db` is a unique hybrid between a table-based document store and a graph database (adjacency lists).

Because of this graph architecture, **references and edges are highly optimized**. Connecting nodes via ID references and traversing those references via `.include()` is significantly faster and more scalable than storing loose keys and relying on table-wide filters.

### The Master Example Schema

To contextualize the examples in this document, assume the following master schema configuration. It demonstrates the interplay between nested graph references, edges, cardinality, aliases, and localized text:

```typescript
import { BasedSchema } from '@based/schema'

// This schema is located in the based.schema.ts file usually located on the root of the project or in the folder schema/based.schema.ts
export const schema = {
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
        embedding: { type: 'vector', size: 5, baseType: 'float32' }, // Fixed-size float vector (size from test)
        status: { type: 'enum', enum: ['pending', 'active', 'inactive'] }, // Enum type
        countryCode: { type: 'string', maxBytes: 2 }, // String with max byte length
        nestedData: {
          // Nested object (flattened in DB automatically - zero performance impact)
          type: 'object',
          props: {
            value: 'string',
            nestedRef: { ref: 'product', prop: 'nestedUsers' },
          },
        },
        customValidated: {
          // Custom validation function
          type: 'number',
          // validation: (v) => v % 2 === 0, // Must be an even number (optional validation hook)
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
  },
} as const
```

</schema-reference>

<query-anti-patterns>

## 3. Core Query Performance Rules

> [!WARNING]
> **Anti-Pattern: Filtering by ID (O(N))**
> Never perform a linear table scan to find a single item if you already know its ID.
>
> ```typescript
> // ❌ BAD: This performs a full collection scan (O(N) operation)
> const project = await db.query('projects').filter('id', '=', projectId).get()
> ```

> [!TIP]
> **Best Practice: Direct ID Lookup (O(log N))**
> Lookups by a known Node ID bypass filtering entirely.
>
> ```typescript
> // ✅ GOOD: This uses the index directly (O(log N) operation)
> const project = await db.query('projects', projectId).get()
> ```

## 4. Query Execution & Filter Optimization

The order of your `.filter()` chain is strictly executed **exactly in the order you write it**. The database does not magically reorder filters under the hood.

### Filter Ordering Strategy

Always place your **most restrictive** filters first. You want to eliminate as many records as possible early in the chain so subsequent filters have less data to evaluate.

> [!TIP]
> **Best Practice: Restrictive Filters First**
>
> ```typescript
>
> // ✅ GOOD: Narrows down to active users first, then checks their region
> await db
>   .query('users')
>   .filter('isActive', '=', true) // Drops 80% of the dataset
>   .filter('region', '=', 'EU') // Only runs on the remaining 20%
>   .get()
> ```

> [!WARNING]
> **Anti-Pattern: Restrictive Filters Last**
>
> ```typescript
>
> // ❌ BAD: Checks every single user's region before checking if they are active
> await db
>   .query('users')
>   .filter('region', '=', 'EU')
>   .filter('isActive', '=', true)
>   .get()
> ```

### SIMD Optimized Array Operations

The query engine heavily utilizes ARM Neon SIMD (16-byte registers) instructions under the hood for array lookups.

Whenever you need to check if a field matches one of several values, **pass an array directly**. This compiles down into an ultra-fast vectorized `OR` comparison rather than executing multiple individual statements.

> [!TIP]
> **Best Practice: Array Filters over OR statements**
>
> ```typescript
>
> // ✅ GOOD: Runs a highly optimized SIMD check against the array
> const users = await db.query('users').filter('role', '=', [1, 2, 3]).get()
> ```

> [!WARNING]
> **Anti-Pattern: Sequential OR statements**
>
> ```typescript
>
> // ❌ BAD: Evaluates multiple discrete filters sequentially
> const users = await db
>   .query('users')
>   .filter('role', '=', 1)
>   .or('role', '=', 2)
>   .or('role', '=', 3)
>   .get()
> ```

</query-anti-patterns>

## 5. Traversing References (The Adjacency List Approach)

Given the database's graph nature, it automatically maintains bi-directional adjacency lists for `ref` and `references` field types. These lists act as high-speed indexes.

You should always query _through_ the known ID of a reference rather than scanning the target collection and filtering for that ID.

> [!WARNING]
> **Anti-Pattern: Filtering on Reference IDs (O(N))**
> Never perform a linear scan by filtering a collection based on a parent reference.
>
> ```typescript
>
> // ❌ BAD: This performs a full collection scan over all users
> // to see if their `organizationId` matches your target.
> const orgUsers = await db
>   .query('user')
>   .filter('organizationId', '=', orgId) // O(N) linear filter scan
>   .get()
> ```

> [!TIP]
> **Best Practice: Bi-Directional Adjacency Traversal (O(log N))**
> Because `organization` naturally has a graph relationship with `user`, you should query the known `organization` ID directly and `.include()` its children. This ensures the database merely walks its bi-directional pointers rather than scanning horizontal tables.
>
> ```typescript
>
> // ✅ GOOD: Instantly grabs the organization by ID (O(log N))
> // and populates the nested users instantly via the adjacency list.
> const org = await db
>   .query('organization', orgId)
>   .include((s) => s('users').include('*'))
>   .get()
>
> const orgUsers = org.users
> ```

### Nested Reference Strategy

If you have a schema where users reference workspaces, and those workspaces reference drones, you can walk the entire graph cleanly inside the query builder by querying the entry ID and nesting `.include()` statements:

```typescript
// Example: Fetching a single user, their attached workspaces,
// and any child drones belonging to those workspaces.
const result = await db
  .query('user', userId)
  .include((s) => s('workspaces').include((s) => s('drones').include('*')))
  .get()
```

### Aliases (RBTree)

Aliases are a completely different concept from references. An alias is simply a **secondary key** that gets indexed on a highly optimized RBTree. Use aliases when you need a single string lookup based on a unique non-ID key (like an email, slug, or foreign key equivalent).

```typescript
// Lookups via RBTree (Alias)
// Assuming "organizationId" is declared as type: 'alias' in the schema
const orgUsers = await db
  .query('user', {
    organizationId: org.id,
  })
  .get()
```

> [!TIP]
> **Performance Optimization**: While aliases (RBTree) are fast, utilizing the **direct ID** bypasses the alias RBTree entirely and accesses the internal dataset where IDs are stored in an array of RBTrees. Direct ID lookups are an **order of magnitude faster** than aliases. Always prefer storing and querying raw IDs in your data structures whenever possible.

```typescript
// ❌ SUB-OPTIMAL: Looking up via Alias when you already have the Node ID
// This must traverse the alias RBTree first to find the underlying ID
const myOrg = await db
  .query('organization', {
    slug: 'my-org',
  })
  .get()

// ✅ BEST: Direct ID lookup
// Hits the ID directly in the array of RBTrees instantly (Order of magnitude faster)
const myOrgFast = await db.query('organization', orgId).get()
```

## 6. Partial Text Loading (Previewing Large Strings)

When dealing with large text fields, you often only need a small chunk (e.g., a preview snippet for a list view). Sending massive strings across the JS boundary can cause memory bloat.

You can natively truncate these fields directly in the `.include()` statement using the `end` constraint.

```typescript
// ✅ GOOD: Only fetches the first 50 characters of the massive 'body' field
const articlePreviews = await db
  .query('article')
  .include('title', 'body', { end: 50 })
  .get()
```

### Limiting by Bytes

By default, the `end` property trims by visible characters. If you want a strict byte cutoff (useful for networking limits), you can specify `bytes: true`.

```typescript
const articlePreviews = await db
  .query('article')
  .include('body', {
    end: 200,
    bytes: true,
  })
  .get()
```

## 7. Mutations, Tmp IDs, and Asynchrony

For operations running concurrently or inside loops (like bulk imports):

- You **do not** need to `await Promise.all` for bulk mutations.
- When you call `db.create()`, it instantly returns a synchronous `Tmp ID`. Because the database buffers operations on the same tick, these Tmp IDs can be immediately manipulated or bound to other references. The database automatically batches these changes before flushing its internal buffer.
- Ensure to call `await db.drain()` before crucial reads if you have opted not to await mass mutation queues to guarantee consistency.

```typescript
// ✅ GOOD: Utilizing Tmp IDs to establish immediate graph relations
// without needing to `await` the parent's creation.
const ownerUser = db.create('user', {
  name: 'root',
})

// The `ownerUser` Tmp ID is instantly valid and bound on the same DB tick
const cpuNode = db.create('resource', {
  name: 'cpu',
  owner: ownerUser,
})

const keyboardNode = db.create('resource', {
  name: 'keyboard',
  owner: ownerUser,
})

// Ensure internal buffers flush to standard storage before continuing
await db.drain()
```

### Upserting (`db.upsert`)

Often you want to update a record if it exists or create it if it doesn't. `db.upsert()` takes a type and a payload containing an `alias` property. It will intelligently evaluate the database and apply the correct modification without needing a manual "check and create" pattern, preventing race conditions.

```typescript
// Finds the user by the 'email' alias. If they exist, it updates their name.
// If they do not, it creates a new user via a single engine-level command.
await db.upsert('user', {
  email: 'james@flapmail.com', // Must be an `alias` property in the schema
  name: 'James!',
})
```

### Deletion (`db.delete`)

Deleting nodes natively manages tearing down bi-directional connections in the graph adjacency list. Simply pass the type and the node ID.

```typescript
const userId = await db.create('user', { name: 'mr snurp' })
// Safely breaks all bi-directional references pointing to/from this user
await db.delete('user', userId)
```

## 8. Subscriptions (Reactivity)

Subscriptions hook directly into the database's evaluation tree without polling overhead.

```typescript
const unsubscribe = db.query('projects', projectId).subscribe((data) => {
  console.log('Project Updated:', data.toObject())
})

// Clean up when the UI component or listener goes out of scope
unsubscribe()
```

## 9. Edges (Relationship Properties)

In a graph database, the connections (references) between nodes can hold their own data. These are called **Edges**. In BasedDB, edge properties are always prefixed with a `$` (e.g., `$role`, `$rating`).

Edges are incredibly powerful because they allow you to store properties contextual to the relationship itself (like a user's role in a specific workspace) rather than polluting the user or workspace node directly.

### Mutating with Edges

When linking two nodes, pass an object containing the target `id` and the associated `$edge` properties.

```typescript
// ✅ GOOD: Assigning a "$role" edge when referencing the user
const articleId = await db.create('article', {
  name: 'Performance Guide',
  contributors: [
    {
      id: userId,
      $role: 'writer',
      $rating: 5,
    },
  ],
})
```

### Querying and Filtering on Edges

Edges are highly optimized internal relationship pointers. You can fetch them using the standard `.include()` syntax, or use them to filter references directly at the adjacency layer.

```typescript
// Example: Fetching an article and including only the contributors' $role
const articles = await db.query('article').include('contributors.$role').get()

// Example: Filtering references based on their edge data
const strictlyWriters = await db
  .query('article', articleId)
  .include((s) =>
    s('contributors').filter('$role', '=', 'writer').include('$role', 'name'),
  )
  .get()
```

## 10. Aggregations & Group By

`@based/sdk/db` supports advanced native aggregation capabilities across both top-level queries and relational sub-queries (via `.include()`). Supported aggregate functions include `sum()`, `count()`, `avg()`, `min()`, `max()`, `stddev()`, `var()`, and `harmonicMean()`.

You can also use `.groupBy()` to partition your aggregation results by a specific field.

### Top-Level Aggregations

Aggregations can be chained directly onto your query, allowing you to compute multiple aggregates across different fields in a single pass.

```typescript
// Sum across multiple properties
const totals = await db.query('vote').sum('NL', 'AU').get()

// Count filtered records
const activeCount = await db
  .query('vote')
  .filter('isActive', '=', true)
  .count()
  .get()

// Calculate population standard deviation
const deviation = await db
  .query('vote')
  .stddev('NL', { mode: 'population' })
  .get()
```

### Group By Partitioning

You can group your aggregated results by one or more fields.

```typescript
// Calculate average scores grouped by region
const regionalAverages = await db
  .query('vote')
  .avg('score')
  .groupBy('region')
  .get()
```

### Relational Sub-Query Accumulation

Aggregations seamlessly work inside graph traversals using `.include()`. This is incredibly powerful for retrieving a parent record and instantly accumulating statistics on its relations in the same query execution.

```typescript
// Fetch a sequence and exactly count its grouped regions
const sequenceStats = await db
  .query('sequence', sequenceId)
  .include((q) => q('votes').groupBy('region').count())
  .get()
```

## 11. Data Types & Cardinality

`@based/sdk/db` provides a rich set of native data types for strict schema enforcement and high-performance querying. Defining precise types allows the database to compact data efficiently and execute highly optimal comparisons (especially with numeric and vector types).

### Common Types

- **Primitives**: `string`, `text`, `boolean`, `timestamp`, `json`, `binary`.
- **Numerics**: Ensure you select the smallest capable type to save memory: `int8`, `uint8`, `int16`, `uint16`, `int32`, `uint32`, `number` (standard 64-bit float).
- **Enums**: `{ type: 'enum', enum: ['a', 'b', 'c'] }`
- **Vectors**: `{ type: 'vector', size: 1536, baseType: 'float32' }`
- **Alias**: `{ type: 'alias' }` (Fast secondary indices backed by RBTrees, as detailed earlier).

### String Formats (Validation)

The `string` and `alias` types support a built-in `format` option for highly optimized validation. Validating strings ensures malformed data is rejected zero-cost at the boundary. Supported string formats include `email`, `URL`, `IP`, `MACAddress`, `UUID`, `hexColor`, `code`, and dozens of other standard validator payloads.

```typescript
const schema = {
  types: {
    user: {
      email: { type: 'alias', format: 'email' },
      website: { type: 'string', format: 'URL' },
      deviceMac: { type: 'string', format: 'MACAddress' },
    },
  },
}
```

### Constraints and Bound Limits

When defining number or timestamp properties, you can explicitly define `min`, `max`, and `step` properties. Like formats, these reject bad payloads instantly without Javascript evaluation.

```typescript
const schema = {
  types: {
    product: {
      price: { type: 'number', min: 0.01, max: 10000, step: 0.01 },
      stock: { type: 'uint32', min: 0, max: 100000 },
    },
  },
}
```

### Graph Relations (`reference` & `references`)

Because `@based/sdk/db` operates heavily as a graph, defining pointers between nodes is crucial for traversing adjacency lists. The database handles the underlying bi-directional graph pointers automatically when these types are configured.

#### `reference` (Single Edge)

Used for 1-to-1 or N-to-1 relationships where a property firmly points to exactly **one** other Node ID.

```typescript
// Example: A child strongly pointing to a single parent
const schema = {
  types: {
    child: {
      parentID: {
        type: 'reference',
        ref: 'parent', // Target collection
        prop: 'children', // Reverse property on the parent
      },
    },
  },
}
```

#### `references` (Multiple Edges)

Used for 1-to-N or N-to-N relationships. Often implicitly declared using the `items` object, but can also be defined explicitly with `type: 'references'`.

```typescript
// Example: A parent pointing to an array of children
const schema = {
  types: {
    parent: {
      children: {
        type: 'references', // Optional, heavily implied by `items`
        items: {
          ref: 'child',
          prop: 'parentID',
        },
      },
    },
  },
}
```

### The `cardinality` Type (HyperLogLog++)

Cardinality is a specialized, highly efficient type used to estimate and track the **number of unique elements in a dataset** using the HyperLogLog algorithm. This is extremely useful for tracking unique visitors, view counts, or any uniquely occurring event without storing the full list of identifiers.

```typescript
// Define 'uniqueUsers' as a cardinality type in your schema
const schema = {
  types: {
    analyticsEdition: {
      editionId: 'alias',
      uniqueUsers: 'cardinality', // Tracks unique strings seamlessly
    },
  },
}
```

#### Mutating Cardinality Fields

To add to a cardinality field, simply push a scalar value or an array of values during an update or create. The database will process the array and only bump the cardinality counter for distinctly new values it hasn't seen yet.

```typescript
// Initial creation adds 2 unique users
const editionID = await db.create('analyticsEdition', {
  editionId: 'may-2026',
  uniqueUsers: ['Mr. Lemonade', 'Ms. Mustard'],
})

// Later, we update with an array of overlapping and new users.
// The db hashing will recognize 'Ms. Mustard' as already present.
await db.update('analyticsEdition', editionID, {
  uniqueUsers: ['Ms. Mustard', 'Madam Snurf'],
})
```

#### Querying Cardinality

When you `.include()` a cardinality field via a query, the returned value is simply the **estimated count** of unique items currently tracked in the set.

```typescript
const result = await db
  .query('analyticsEdition')
  .include('uniqueUsers') // Returns the unique count!
  .get()

// Example output: [{ id: 1, uniqueUsers: 3 }]
```

You can even run standard numeric filters against cardinality properties to find nodes exceeding a specific unique count threshold!

```typescript
const popularEditions = await db
  .query('analyticsEdition')
  .filter('uniqueUsers', '>', 5)
  .get()
```

### Fixed-Length Strings (High-Performance Allocations)

When dealing with small string values of a known maximum length (e.g. ISO Country Codes, Currency Symbols, short SKUs), you can pass the `maxBytes` modifier to a standard string type.

```typescript
const schema = {
  types: {
    transaction: {
      fromCountry: { type: 'string', maxBytes: 2 }, // e.g. "NL"
      currency: { type: 'string', maxBytes: 3 }, // e.g. "USD"
    },
  },
}
```

**Under the hood:** When `maxBytes` is smaller than 60 bytes (roughly 30 visible characters since standard DB encoding treats chars as 2 bytes), the database bypasses standard dynamic string pointers and instead pre-allocates a static vector array for the value.
This dramatically reduces memory fragmentation, avoids pointer de-referencing overhead, and makes read/write operations for these codes incredibly fast.

### Localized Text (`text`)

The `text` type natively handles internationalization without requiring manual JSON dictionaries or clunky fallback logic in your app code.

```typescript
const schema = {
  locales: {
    // Define global language fallbacks!
    en: { required: true },
    it: { fallback: 'en' },
    fi: { fallback: 'en' },
  },
  types: {
    dialog: {
      fun: { type: 'text' },
    },
  },
}
```

When creating or mutating a `text` node, you can pass an object keyed by language configuration, or you can pass a simple string and define the target language via the `{ locale: '...' }` option argument.

```typescript
// Explicitly mapping languages
const dialogId = await db.create('dialog', {
  fun: { en: 'Hello', it: 'Ciao', fi: 'Hei' },
})

// Setting the locale context for the entire mutation
const finnishDialogId = await db.create(
  'dialog',
  {
    fun: 'Hei',
  },
  { locale: 'fi' },
)
```

#### Querying & Fallbacks

You can dictate the behavior of your data boundary via the `.locale()` modifier in the query builder. The database automatically resolves to the requested string or walks the configured fallback tree if a translation is missing!

For example, if the schema falls back from `nl` -> `en`, and the Italian or English string exists while Dutch is missing, the database seamlessly returns the English string.

```typescript
// Fetch the Italian translation
const specific = await db.query('dialog').locale('it').include('fun').get()
// specific[0].fun -> 'Ciao'

// The DB intelligently respects fallbacks during filters and searches
const englishMatch = await db
  .query('dialog')
  .locale('nl') // Sets the context to Dutch, but falls back to English for searches
  .filter('fun', 'includes', 'Hello')
  .get()

// Or seamlessly fetch the whole translation payload
const explicitFetch = await db.query('dialog').include('fun').get()
// explicitFetch[0].fun -> { en: 'Hello', it: 'Ciao', fi: 'Hei' }
```

#### Explicit Language Targeting

If you don't want to rely on the global locale fallback context, you can explicitly target a specific language version of a text field using dot-notation (`field.lang`).

This bypasses the `.locale()` fallback resolution and directly accesses that explicit translation block.

```typescript
// Fetch ONLY the English translation, ignoring the global locale context
const exactFetch = await db.query('dialog').include('fun.en').get()

// Search explicitly within the English strings
const exactSearch = await db.query('dialog').search('Hello', 'fun.en').get()

// Filter explicitly against the Italian translation
const exactFilter = await db
  .query('dialog')
  .filter('fun.it', 'includes', 'Ciao')
  .get()
```

## 12. Schema Constraints & Automated Operations

`@based/sdk/db` has extremely powerful capabilities at the C-layer for maintaining data integrity automatically, bypassing the need for slow cron jobs or JS-level recursive loops.

### Capped Collections & References

You can automatically bound the size of top-level collections or reference arrays using `capped: <number>`. When the size limit is breached, the database handles FIFO (First-In-First-Out) truncation instantly. This is immensely useful for "Recent Activity" tracking without complex slice and cleanup logic.

```typescript
const schema = {
  types: {
    meas: {
      capped: 1000, // Only the latest 1000 measurements are ever kept
      props: { temperature: 'number' },
    },
    user: {
      props: {
        recentVisits: {
          type: 'references',
          capped: 50, // Old visits drop off seamlessly
          items: { ref: 'article' },
        },
      },
    },
  },
}
```

### Dependent References (Cascading Deletes)

`dependent: true` is an edge modifier that creates a hard cascading deletion constraint. If a parent node is deleted, the database engine will recursively and instantly delete the dependent child node. This entirely replaces the need to `db.query().get()` all children in JS and iterate `db.delete()` over them securely.

```typescript
const schema = {
  types: {
    page: {
      props: {
        // Deleting the attached Sequence will instantly delete this Page node
        sequence: { ref: 'sequence', prop: 'pages', dependent: true },
      },
    },
  },
}
```

### Expiration & TTL (Time-To-Live)

If you have highly volatile or temporary nodes (like cache objects, single-use tokens, or rate-limited sessions), do not build JS loops. Use `db.expire(type, id, ms)` natively.

```typescript
const tokenId = await db.create('sessionToken', { user: userId })

// Tell the engine to wipe this entity in 10 minutes (600_000ms)
db.expire('sessionToken', tokenId, 600000)
```

### Database Hooks (Native Middleware)

Schema hooks permit synchronous execution logic directly within the DB pipeline exactly when an operation occurs (`create`, `update`, `read`, `filter`, `include`, `aggregate`, `search`, `groupBy`). These run on the DB execution tick and effectively act as SQL CHECK constraints formatting middleware.

**CRITICAL RULE:** Hooks, particularly `read` hooks (since read responses are piped down to clients), **CANNOT** contain side-effects. Do not log, execute fetching, or mutate other scopes. Additionally, they must be highly optimized since they execute directly in the high-speed evaluation paths.

```typescript
const schema = {
  types: {
    user: {
      hooks: {
        // Blocks mutations instantly if logic fails
        create: (payload) => {
          if (payload.age < 21 && payload.city === 'Sandcity') {
            throw new Error('Minors not allowed in Sandcity') // Like a CHECK constraint
          }
        },
        // Mute or inject formats cleanly before returning data
        read: (result) => {
          if (result.private) {
            return { id: result.id, private: true } // Mask contents
          }
        },
      },
      props: {
        city: {
          type: 'string',
          hooks: {
            // Intercept and normalize the property value during an update
            update: (value) => {
              if (value === 'ignore') return undefined // Skip mutation
              return value.toLowerCase()
            },
          },
        },
      },
    },
  },
}
```

## 13. Advanced Query Capabilities

### Querying Explicit IDs

If you already have a set of known IDs and want to fetch their payloads, you can pass an array of IDs as the second argument to the `.query()` builder.

Because `@based/sdk/db` graphs natively store nodes against their IDs, this array lookup acts as an **incredibly fast, instant O(N) direct scan** across the engine without passing through any filter trees.

```typescript
// Extremely fast fetch of specific known User IDs
const users = await db
  .query('user', [812739, 918237, 102938])
  .include('name', 'email')
  .get()
```

### Metadata (`meta`)

Often, you want to know metadata about a specific field (like a large string or text object) without necessarily dragging the entire payload over the network. You can request this in the `.include()` statement.

```typescript
// Fetches the value AND metadata objects
const withMeta = await db.query('article').include('body', { meta: true }).get()

/*
{
  id: 1,
  body: {
    value: 'Some long text...',
    checksum: 1734243019581653,
    size: 190677,
    crc32: 826951513,
    compressed: true
  }
}
*/

// Fetch ONLY the metadata (skips loading the actual value)
const onlyMeta = await db
  .query('article')
  .include('body', { meta: 'only' })
  .get()
```

### Text/String Search (Hamming Distance)

The `.search()` operator is incredibly fast because it utilizes a Hamming distance algorithm under the hood.

Because it relies on Hamming distance (counting character substitutions), it is excellent at finding **typos** (e.g. `hollo` will match `hello`), but it performs poorly if the user skips or adds letters which throw off the alignment (e.g. `hllo` matching `hello`).

```typescript
const typosWelcome = await db
  .query('dialog')
  .search('finland', 'fun') // Looks inside the 'fun' text field
  .include('fun')
  .get()

// Note: Search results automatically append a `$searchScore` property to the result object
```

### Search Operators (Spaces = `AND`)

When searching vectors of text, any spaces (` `) inside the search term explicitly behave as **logical `AND` operators**.

The database will only return records where **both** terms are found (while still respecting fuzzy-matching distances). This makes broad searches highly effective.

```typescript
// Look for results that contain BOTH 'italy' AND 'nigeria' Across the specified fields.
const broadSearch = await db
  .query('article')
  .search('italy nigeria', 'body', 'title')
  .get()

// Or configure explicit weighting/distances per field
const configuredSearch = await db
  .query('article')
  .search('giraffe first', { body: 0, title: 1 })
  .get()
```

### Vector Search

Since `@based/sdk/db` natively supports `vector` data types, you can pass a `Float32Array` directly into the `.search()` engine. The search calculates nearest neighbors using built-in distance functions.

Supported distance functions (`fn` parameter) include:

- `euclideanDistance` (Default)
- `cosineSimilarity`
- `dotProduct`
- `manhattanDistance`

```typescript
const embedding = new Float32Array([-5.1, 2.9, 0.8, 7.9, 3.1])

// Perform an optimized vector search using Cosine Similarity
const vectorMatches = await db
  .query('data')
  .search(embedding, 'embeddingField', { fn: 'cosineSimilarity', score: 1 })
  .get()
```

### Filter Options (e.g., `lowerCase`)

While `.filter()` is typically used for exact match and comparisons, standard query operations like `'includes'` natively support configuration opts as the final parameter.

The most common use-case is ensuring case-insensitivity:

```typescript
const match = await db
  .query('article')
  .filter('headline', 'includes', 'hello world', { lowerCase: true })
  .get()
```

### Pagination with `.range(start, end)`

`@based/sdk/db` handles limit and offset pagination through a singular `.range(start, end)` modifier. It tells the query boundary to return all results between the two distinct integer indices.

If you want the first 10 results, your range is `0` to `10`.

```typescript
// Fetch the first 25 matching users
const firstPage = await db
  .query('user')
  .sort('createdAt', 'desc')
  .range(0, 25)
  .get()

// Fetch the next 25 users (Page 2)
const secondPage = await db
  .query('user')
  .sort('createdAt', 'desc')
  .range(25, 50)
  .get()
```

## 14. Indexes & Sorting Performance

BasedDB applies rigorous optimization to ordering, but understanding _where_ things are sorted avoids massive performance traps.

### Sorting Collections (Stored Indexes)

When you sort a top-level query against a collection (a type), the database automatically constructs and stores a high-speed index for that sort parameter.

```typescript
// ✅ FAST: Uses a dedicated, stored index for the 'project' collection
const activeProjects = await db.query('project').sort('title', 'asc').get()
```

### Sorting References (Computed On-The-Fly)

Unlike collections, sorting inside nested graph references (via `.include()`) does **NOT** get stored as an index. These sorts are computed entirely on-the-fly.

For large reference arrays, this has **heavy performance implications**. Only sort references when absolutely necessary!

```typescript
// ❌ BAD: Sorting 10,000 reference edges on the fly for every workspace requested!
const workspaces = await db
  .query('workspace')
  .include((q) => q('drones').sort('batteryLevel', 'desc'))
  .get()

// ✅ GOOD: Filter first, skip sorting unless the UI strictly demands an ordered list of edges
const workspaces = await db
  .query('workspace')
  .include((q) => q('drones').filter('batteryLevel', '<', 10))
  .get()
```

### The `id` vs `createdAt` Optimization

Because database IDs in `@based/sdk/db` are deeply monotonic (ever-increasing based on write time), they natively represent insertion order.

**Sorting on `id` is completely instant because it is the primary physical key of the graph.** You should always prefer sorting on `id` instead of a custom `createdAt` timestamp.

```typescript
// ❌ SUB-OPTIMAL: Forces the database to maintain a secondary index for 'createdAt'
const recent = await db.query('messages').sort('createdAt', 'desc').get()

// ✅ BEST: Instant linear traversal backwards from the end of the collection
const recentFast = await db.query('messages').sort('id', 'desc').get()
```

### Aggregation Counts

As a final performance tip, if you need to know how many things represent a query or exist in a reference array, do not query the array and count in JavaScript.

The `count()` aggregation operation is deeply tied to the internal node storage and is an **instant operation** for both types and references.

```typescript
// ✅ BEST: Instant lookup internally!
const userSummary = await db
  .query('user', userId)
  .include((q) => q('workspaces').count())
  .get()
```

## 15. Error Handling & Validation

The database throws highly explicit, predictable errors when invalid operations are detected, generally completely bypassing JS loops through the C-engine bindings.

### Mutation and Validation Errors

If you attempt to create or update an entity with invalid data structurally, or provide data outside the bounds of `min`/`max`/`format`/`maxBytes`, the database instantly throws structured errors. Always use `try/catch` to handle these explicitly.

```typescript
async function updateProductSafely(id: number, payload: any) {
  try {
    await db.update('product', id, payload)
  } catch (error) {
    if (error.message.includes('Target product:')) {
      // Handle the NotExists error (mapped safely from native layer)
      console.error(`Product ${id} does not exist.`)
    } else if (error.message.includes('Invalid value at')) {
      // Handles array errors parsed from the native validation layer
      // e.g., "Invalid value at 'product.price'. Expected number received 'Too expensive'"
      console.error('Validation failed:', error.message)
    } else {
      throw error
    }
  }
}

// Updating an alias with an invalid email format
// Throws Error: Invalid value at 'user.email'. Expected format 'email' received 'not-an-email'
```

Furthermore, modifying or reading an ID that does not exist securely throws:

```typescript
try {
  await db.update('user', 99999999, { name: 'hacker' })
} catch (error) {
  // Catch: Target user:99999999 does not exist
  console.log(error.message)
}
```

### Querying Errors

Malformed queries failing pre-computation evaluation natively throw a structured exception explaining exactly what query segment is flawed.

```typescript
async function queryProductSafely() {
  try {
    // Querying a field that doesn't exist natively throws before traversing C bindings
    await db.query('product').filter('color', '=', 'blue').get()
  } catch (error) {
    // Catch: Query Error[product]\nFilter: field does not exist "color"
    console.error(error.message)
  }

  try {
    // Using an invalid filter operator for a type
    await db.query('product').filter('price', 'includes', 'cheap').get()
  } catch (error) {
    // Catch: Query Error[product]\nCannot use operator "includes" on field "price"
    console.error(error.message)
  }
}
```
