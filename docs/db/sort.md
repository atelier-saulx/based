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

- Numbers (`uint32`, `int8`, etc.)
- Cardinality
- Strings
- Timestamps
- Enums
- IDs

> Sorting Aggregated operations is not supported yet.

## Sorting by Property Type

### Numeric Sorting

```javascript
// Sorts numbers naturally
await db.query('user').sort('age').get()
// Returns: [ {id: 5, age: 1}, {id: 2, age: 50}, ... ]
```

### String Sorting

```javascript
// Lexicographical order
await db.query('user').sort('email').get()
// Returns: [ {email: 'a@a.a'}, {email: 'b@b.b'}, ... ]
```

### Timestamp Sorting

```javascript
// Chronological order
await db.query('event').sort('timestamp').get()
```

### ID Sorting

```javascript
// Sorts by node creation order
await db.query('user').sort('id').get()
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

**Performance Characteristics:**

- Index creation for 1M items completes in <500ms (string) / <250ms (numeric)
- Sorting operations complete in constant time after indexing
- Updates maintain index integrity automatically

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
