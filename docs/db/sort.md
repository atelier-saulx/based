# Sorting

## Overview

The sorting functionality provides efficient ways to order query results by various property types. This document covers the supported sorting operations. You can always get the latest functional examples at the [test files](https://github.com/atelier-saulx/based/tree/main/packages/db/test).

## Basic Sorting

### `.sort(property: string, direction?: 'asc' | 'desc')`

Orders results by the specified property.

**Examples:**

```javascript
// Ascending sort (default)
await db.query('user').sort('age').get()

// Descending sort
await db.query('user').sort('age', 'desc').get()
```

**Supported Types:**

- [Numbers](db/sort?id=numeric-sorting) (`uint32`, `int8`, etc.)
- Cardinality
- [Strings](db/sort?id=string-sorting)
- [Timestamps](db/sort?id=timestamp-sorting)
- Enums
- Aliases
- [IDs](db/sort?id=id-sorting)

> Sorting Aggregated operations is not supported yet.

## Sorting by Property Type

### Numeric Sorting

```javascript
// Sorts numbers naturally
await db.query('user').sort('age').get()
// Returns: [ {id: 5, age: 1}, {id: 2, age: 50}, ... ]
```

### String Sorting

The database provides efficient lexicographical sorting of string values with support for various string types and configurations.

#### Basic String Sorting

```javascript
// Ascending sort (default)
await db.query('article').sort('name').get()

// Descending sort
await db.query('article').sort('name', 'desc').get()
```

#### **Compressed String Sorting**

Strings can be stored with compression while maintaining full sorting capabilities:

```javascript
await db.setSchema({
  types: {
    article: {
      props: {
        article: {
          type: 'string',
          compression: 'deflate', // Enable compression
        },
      },
    },
  },
})

// Sorting works identically with compressed strings
await db.query('article').sort('article').get()
```

#### **Fixed-Length Strings**

Strings with length constraints are fully sortable:

```javascript
await db.setSchema({
  types: {
    article: {
      props: {
        name: {
          type: 'string',
          maxBytes: 20, // Fixed maximum length
        },
      },
    },
  },
})

await db.query('article').sort('name').get()
```

#### Special Cases

##### **Numeric Prefix Sorting**

```javascript
// Correctly sorts numeric prefixes:
// "1 article", "2 article", "10 article"
await db.query('article').sort('name').get()
```

##### **Random String Sorting**

```javascript
// Handles completely random strings
await db.query('article').sort('randomStringField').get()
```

#### Validate with `isSorted()`

```javascript
// Verify sort order
const results = await db
  .query('article')
  .include('name', 'nr')
  .sort('name', 'desc')
  .get()

// Test helper validates correct ordering
isSorted(results, 'name', 'desc')
```

#### Configuration Options

```javascript
await db.setSchema({
  types: {
    article: {
      props: {
        content: {
          type: 'string',
          compression: 'deflate', // Optional compression
          maxBytes: 1000, // Optional length limit
        },
      },
    },
  },
})
```

### Timestamp Sorting

```javascript
// Chronological order
await db.query('event').sort('timestamp').get()
```

### ID Sorting

The database provides efficient sorting capabilities by node IDs, which is particularly useful for organizing large datasets and managing relationships between nodes.

#### Basic ID Sorting

```javascript
// Sort nodes by their ID in ascending order (default creation order)
await db.query('user').sort('id').get()

// Sort specific IDs in custom order
await db.query('user', [id3, id1, id2]).sort('id').get()
```

#### Key Features

**1. Native ID Sorting**

- IDs are automatically sortable without explicit indexing
- Maintains creation order by default
- Efficient even with 100,000+ nodes

**2. Mixed Type Support**
ID sorting works consistently across all node types:

```javascript
await db.query('user').sort('id').get() // User nodes
await db.query('article').sort('id').get() // Article nodes
```

**3. References Sorting**
Sort referenced nodes within relationships:

```javascript
// Sort contributors by their IDs
await db
  .query('article', articleId)
  .include((s) => s('contributors').sort('id'))
  .get()
```

#### Common Patterns

**Pagination with Sorted IDs**

```javascript
const pageSize = 100
const page = 3

await db
  .query('user')
  .sort('id')
  .range(page * pageSize, (page + 1) * pageSize)
  .get()
```

**Sorted on Branched Queries (References)**

```javascript
// Get article with contributors sorted by ID
await db
  .query('article', articleId)
  .include((s) => s('contributors').sort('id'))
  .get()
```

> Combining with Other Sorts is not supported

```javascript
// Trying to do primary sort by timestamp, secondary by ID has no effect.
// Last .sort() call prevails.
await db.query('event').sort('timestamp').sort('id').get()
```

### Binary Data Sorting

The database supports sorting binary data fields using direct byte-by-byte comparison, enabling efficient organization of binary content.

#### Basic Usage

```javascript
// Sort binary data in ascending order (default)
await db.query('binary').sort('data').get()

// Sort binary data in descending order
await db.query('binary').sort('data', 'desc').get()
```

#### Sorting Behavior

- Compares binary data byte-by-byte from first to last
- Shorter buffers sort before longer buffers when initial bytes match

#### Example Results

```javascript
// Given buffers:
// [0,1,2], [1,2,3], [1,2,4]

// Ascending sort returns:
// [0,1,2], [1,2,3], [1,2,4]

// Descending sort returns:
// [1,2,4], [1,2,3], [0,1,2]
```

## Special Sorting Cases

### Sorting Unset/Empty Values

```javascript
// Empty strings sort after all values
await db.query('dialog').sort('fun', 'desc').get()
// Returns: [
//   {fun: '3'},
//   {fun: '2'},
//   {fun: '1'},
//   {fun: ''},  // Unset values
//   {fun: ''}
// ]
```

### Mixed Type Sorting

```javascript
// Handles numeric/string differences gracefully
await db.query('item').sort('value').get()
```

## Performance Considerations

### Index Creation

```javascript
// Explicit index creation (shown in test)
db.server.createSortIndex('user', 'age')
db.server.createSortIndex('user', 'name')

// Index removal
db.server.destroySortIndex('user', 'age')
```

## Advanced Patterns

### Sorting with Range Limiting

```javascript
// Pagination with sorting
await db
  .query('user')
  .sort('age')
  .range(0, 100) // First page
  .get()
```

### Sorting with Filtering

```javascript
// Filter then sort
await db.query('user').filter('age', '>', 30).sort('name').get()
```

### Sorting Nested Queries

```javascript
// Sort included references
await db
  .query('team')
  .include((q) => q('players').sort('score'))
  .get()
```

## Update and Delete Behavior

### Maintaining Sort Order

- Updates automatically reindex sorted properties
- Deletions maintain sort integrity
- New items are inserted in correct sorted position

**Example:**

```javascript
// Initial sort
const results = await db.query('user').sort('email').get()

// After update
db.update('user', id, { email: 'new@email.com' })
// Sort order automatically maintained
```
